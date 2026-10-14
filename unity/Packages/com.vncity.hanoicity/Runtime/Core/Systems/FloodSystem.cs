using System;
using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Geo;
using Newtonsoft.Json.Linq;

namespace HanoiCity.Systems
{
    /// <summary>
    /// Water of a flood layer (flood_layers.json) over time; twin of the UE FHanoiFloodModel and of
    /// tools/runtime_rules.py (golden file tests/golden/runtime_rules.json). River level: linear
    /// between timeline points. Rain: the last timeline point at or before t. Rain zones: a depth
    /// table at t_i = i * step_h integrated forward from 0, d += (rain * catchment - drain) / 1000 *
    /// step_h clamped to [0, max_depth_m], drain = drain_mm_h times pump_share once the river reaches
    /// gravity_block_river_m, rain and river read at t_i; linear between table points. River zones:
    /// river - floor_m, at least 0. Outside [0, duration_h] every depth is 0.
    /// </summary>
    public sealed class FloodModel
    {
        public const double Eps = 1e-9;
        public HanoiFloodLayerRow Layer { get; }
        readonly Dictionary<string, double[]> table = new Dictionary<string, double[]>();

        public FloodModel(HanoiFloodLayerRow layer)
        {
            Layer = layer;
            int n = (int)Math.Round(layer.DurationH / layer.StepH, MidpointRounding.ToEven);
            foreach (var z in layer.Zones.Where(z => z.Cause == HanoiFloodLayerZoneCause.Mua))
            {
                var col = new double[n + 1];
                double d = 0.0;
                for (int i = 0; i < n; i++)
                {
                    double t = i * layer.StepH;
                    double drain = (z.DrainMmH ?? 0) * (RiverAt(t) >= layer.Drainage.GravityBlockRiverM ? layer.Drainage.PumpShare : 1.0);
                    d = d + (RainAt(t) * (z.Catchment ?? 0) - drain) / 1000.0 * layer.StepH;
                    d = Math.Min(Math.Max(d, 0.0), z.MaxDepthM ?? 0);
                    col[i + 1] = d;
                }
                table[z.Id] = col;
            }
        }

        public double RiverAt(double t)
        {
            var tl = Layer.Timeline;
            if (t <= tl[0].TH) return tl[0].RiverM;
            for (int i = 0; i + 1 < tl.Count; i++)
            {
                var a = tl[i];
                var b = tl[i + 1];
                if (a.TH <= t && t < b.TH) return a.RiverM + (b.RiverM - a.RiverM) * (t - a.TH) / (b.TH - a.TH);
            }
            return tl[tl.Count - 1].RiverM;
        }

        public double RainAt(double t)
        {
            double rain = Layer.Timeline[0].RainMmH;
            foreach (var k in Layer.Timeline) if (k.TH <= t + Eps) rain = k.RainMmH;
            return rain;
        }

        public HanoiFloodLayerZone Zone(string id) => Layer.Zones.FirstOrDefault(z => z.Id == id);

        public double ZoneDepth(HanoiFloodLayerZone zone, double t)
        {
            if (t < 0 || t > Layer.DurationH + Eps) return 0.0;
            if (zone.Cause == HanoiFloodLayerZoneCause.Song) return Math.Max(0.0, RiverAt(t) - (zone.FloorM ?? 0));
            if (!table.TryGetValue(zone.Id, out var col)) return 0.0;
            double x = t / Layer.StepH;
            int i = Math.Min((int)Math.Floor(x + Eps), col.Length - 1);
            if (i >= col.Length - 1) return col[col.Length - 1];
            double f = x - i;
            return col[i] + (col[i + 1] - col[i]) * f;
        }

        public bool ClosureActive(HanoiFloodLayerClosure c, double t) =>
            t >= 0 && t <= Layer.DurationH + Eps && t + Eps >= c.FromH && RiverAt(t) >= c.RiverMAtLeast;

        /// <summary>A rain zone is deeper than slow_depth_m: the layer's world_events are on.</summary>
        public bool WorldEventsOn(double t) =>
            Layer.Zones.Any(z => z.Cause == HanoiFloodLayerZoneCause.Mua && ZoneDepth(z, t) > Layer.SlowDepthM);

        /// <summary>passable_depth_m of xe_may, o_to, xe_dap or di_bo.</summary>
        public double PassableDepth(string vehicleClass)
        {
            var p = Layer.PassableDepthM;
            switch (vehicleClass)
            {
                case FloodSystem.Car: return p.OTo;
                case FloodSystem.Bicycle: return p.XeDap;
                case FloodSystem.OnFoot: return p.DiBo;
                default: return p.XeMay;
            }
        }
    }

    /// <summary>
    /// Runs a flood layer in the world (c3_07 Đêm nước lên); twin of UHanoiFloodSubsystem. A mission
    /// step with params.flood_layer naming a flood_layers id starts it at the game time the step
    /// starts ("live" is chapter 1's weather-driven flooding, not handled here). It is saved
    /// (ActiveFloodLayer / FloodLayerStart), resumes on load and ends after duration_h game hours.
    /// Every FloodUpdateGameMinutes: road graph edges in a zone are blocked at the xe_may passable
    /// depth and slowed above slow_depth_m, edges in an active closure are blocked; the layer's
    /// world_events (mua_ngap) follow WorldEventsOn. Each tick, the player: a motorbike or bicycle in
    /// water at its passable depth stalls (mission event xe_chet_may, VehicleStalled); riding into an
    /// active closure from outside is its traffic_rule violation in front of the police posted there,
    /// unless the active step prices that crossing itself (params.apply_fine); being inside already
    /// when it starts is not (bãi giữa is evacuated, not fined).
    /// </summary>
    public sealed class FloodSystem
    {
        public const string Motorbike = "xe_may", Car = "o_to", Bicycle = "xe_dap", OnFoot = "di_bo";
        public const string StallEvent = "xe_chet_may";

        readonly HanoiWorld world;
        double lastUpdateH = -1;
        bool worldEventsOn;
        readonly HashSet<string> playerInClosures = new HashSet<string>();
        string playerStalledZone;
        bool playerSeeded;

        public FloodModel Model { get; private set; }
        public bool IsActive => Model != null;
        public string ActiveLayer => Model?.Layer.Id;

        public event Action<string, bool> LayerChanged;
        public event Action<string, double> VehicleStalled;
        public event Action<string, bool> ClosureEntered;

        public FloodSystem(HanoiWorld world)
        {
            this.world = world;
            world.Missions.StepStarted += OnStepStarted;
        }

        void OnStepStarted(string missionId, int index, HanoiMissionStep step)
        {
            if (step.Params is JObject p && (string)p["flood_layer"] is string id && id != "live") Start(id);
        }

        public bool Start(string layerId)
        {
            var row = world.Content.Get<HanoiFloodLayerRow>("flood_layers", HanoiRef.IdOf(layerId));
            if (row == null) return false;
            if (IsActive) ClearWorld();
            Model = new FloodModel(row);
            playerSeeded = false;
            world.State.ActiveFloodLayer = row.Id;
            world.State.FloodLayerStart = world.Clock.Now;
            world.NotifyStateChanged();
            lastUpdateH = -1;
            LayerChanged?.Invoke(row.Id, true);
            UpdateWorld();
            return true;
        }

        /// <summary>After a load: picks up the saved layer.</summary>
        public void Resume()
        {
            var id = world.State.ActiveFloodLayer;
            if (string.IsNullOrEmpty(id)) return;
            var row = world.Content.Get<HanoiFloodLayerRow>("flood_layers", id);
            if (row == null) { world.State.ActiveFloodLayer = null; return; }
            Model = new FloodModel(row);
            playerSeeded = false;
            lastUpdateH = -1;
            LayerChanged?.Invoke(row.Id, true);
            UpdateWorld();
        }

        public void Stop()
        {
            if (!IsActive) return;
            var id = Model.Layer.Id;
            ClearWorld();
            Model = null;
            world.State.ActiveFloodLayer = null;
            world.NotifyStateChanged();
            LayerChanged?.Invoke(id, false);
        }

        /// <summary>Drops the running layer without touching the saved state (before a load).</summary>
        public void Clear()
        {
            if (IsActive) ClearWorld();
            Model = null;
        }

        void ClearWorld()
        {
            foreach (var g in world.TrafficGraphs) g.ClearEdgeOverrides();
            foreach (var ev in Model.Layer.WorldEvents) world.SetWorldEventActive(ev.Id, false);
            worldEventsOn = false;
            playerInClosures.Clear();
            playerStalledZone = null;
            playerSeeded = false;
        }

        /// <summary>Game hours since the layer started.</summary>
        public double TimeH => IsActive ? (world.Clock.Now - world.State.FloodLayerStart).TotalHours : 0;

        public double RiverLevelM => IsActive ? Model.RiverAt(TimeH) : 0;

        public double ZoneDepthM(string zoneId)
        {
            var z = Model?.Zone(zoneId);
            return z == null ? 0 : Model.ZoneDepth(z, TimeH);
        }

        public bool ClosureActive(string closureId)
        {
            var c = Model?.Layer.Closures.FirstOrDefault(x => x.Id == closureId);
            return c != null && Model.ClosureActive(c, TimeH);
        }

        Double3? Center(HanoiGeo location, HanoiRef landmark)
        {
            var g = location ?? (landmark != null ? world.Content.ResolveLocation(landmark) : null);
            return g == null ? (Double3?)null : world.Geo.GeoToEnu(g);
        }

        /// <summary>Deepest water at an ENU point (m) and the zone it comes from.</summary>
        public double DepthAt(Double3 enu, out string zoneId)
        {
            zoneId = null;
            if (!IsActive) return 0;
            double t = TimeH, best = 0;
            foreach (var z in Model.Layer.Zones)
            {
                var c = Center(z.Location, z.Landmark);
                if (!c.HasValue || Double3.PlanDistance(c.Value, enu) > z.RadiusM) continue;
                double d = Model.ZoneDepth(z, t);
                if (d > best) { best = d; zoneId = z.Id; }
            }
            return best;
        }

        public bool IsPassableAt(Double3 enu, string vehicleClass) =>
            !IsActive || DepthAt(enu, out _) < Model.PassableDepth(vehicleClass);

        /// <summary>1 in dry streets, slow_speed_factor in slowing water, 0 where the vehicle cannot pass.</summary>
        public double SpeedFactorAt(Double3 enu, string vehicleClass)
        {
            if (!IsActive) return 1;
            double d = DepthAt(enu, out _);
            if (d >= Model.PassableDepth(vehicleClass)) return 0;
            return d > Model.Layer.SlowDepthM ? Model.Layer.SlowSpeedFactor : 1;
        }

        public void Tick()
        {
            if (!IsActive) return;
            double t = TimeH;
            if (t > Model.Layer.DurationH) { Stop(); return; }
            if (lastUpdateH < 0 || Math.Abs(t - lastUpdateH) >= world.Rules.FloodUpdateGameMinutes / 60.0) UpdateWorld();
            UpdatePlayer(t);
        }

        void UpdateWorld()
        {
            double t = TimeH;
            lastUpdateH = t;
            UpdateTraffic(t);
            bool on = Model.WorldEventsOn(t);
            if (on == worldEventsOn) return;
            worldEventsOn = on;
            foreach (var ev in Model.Layer.WorldEvents) world.SetWorldEventActive(ev.Id, on);
        }

        void UpdateTraffic(double t)
        {
            if (world.TrafficGraphs.Count == 0) return;
            var closed = Model.Layer.Closures
                .Where(c => Model.ClosureActive(c, t))
                .Select(c => (center: Center(null, c.Landmark), r: c.RadiusM))
                .Where(c => c.center.HasValue)
                .ToList();
            foreach (var g in world.TrafficGraphs)
            {
                for (int e = 0; e < g.Edges.Count; e++)
                {
                    var mid = g.EdgeMidpoint(e);
                    bool blocked = closed.Any(c => Double3.PlanDistance(c.center.Value, mid) <= c.r);
                    double factor = 1;
                    if (!blocked)
                    {
                        double d = DepthAt(mid, out _);
                        // AI traffic is mostly motorbikes: the xe_may depth closes the street to it.
                        blocked = d >= Model.PassableDepth(Motorbike);
                        factor = d > Model.Layer.SlowDepthM ? Model.Layer.SlowSpeedFactor : 1;
                    }
                    g.SetEdgeBlocked(e, blocked);
                    g.SetEdgeSpeedFactor(e, factor);
                }
            }
        }

        public string PlayerVehicleClass
        {
            get
            {
                var p = world.Player;
                if (p == null || !p.OnVehicle) return OnFoot;
                return p.InCar ? Car : p.OnBicycle ? Bicycle : Motorbike;
            }
        }

        void UpdatePlayer(double t)
        {
            var player = world.Player;
            if (player == null || !player.HasPawn) return;
            var pos = player.PositionEnu;
            string vehicle = PlayerVehicleClass;
            bool riding = vehicle == Motorbike || vehicle == Bicycle;

            double depth = DepthAt(pos, out var zone);
            if (riding && depth >= Model.PassableDepth(vehicle))
            {
                if (playerStalledZone != zone)
                {
                    playerStalledZone = zone;
                    VehicleStalled?.Invoke(zone, depth);
                    world.Missions.ReportEvent(StallEvent);
                }
            }
            else if (depth < Model.Layer.SlowDepthM) playerStalledZone = null;

            // Riding into an active closure breaks its rule in front of the police posted there; being
            // inside already when it starts does not (the people of bãi giữa are let out).
            foreach (var c in Model.Layer.Closures)
            {
                var center = Center(null, c.Landmark);
                bool inside = center.HasValue && Double3.PlanDistance(center.Value, pos) <= c.RadiusM;
                if (inside && playerInClosures.Add(c.Id))
                {
                    if (!playerSeeded || !Model.ClosureActive(c, t)) continue;
                    ClosureEntered?.Invoke(c.Id, true);
                    bool stepPricesIt = !string.IsNullOrEmpty(world.Missions.GetActiveStepParamString("apply_fine"));
                    if (vehicle != OnFoot && !stepPricesIt && c.TrafficRule != null)
                        world.Heat.ReportViolation(c.TrafficRule.Id, vehicle == Car, true, false);
                }
                else if (!inside && playerInClosures.Remove(c.Id)) ClosureEntered?.Invoke(c.Id, false);
            }
            playerSeeded = true;
        }
    }
}
