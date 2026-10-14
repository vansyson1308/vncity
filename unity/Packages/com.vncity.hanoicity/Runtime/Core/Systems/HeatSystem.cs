using System;
using HanoiCity.Content;

namespace HanoiCity.Systems
{
    /// <summary>
    /// CSGT (traffic police) attention, the non-violent wanted level (docs/gdd/02 §1). Port of
    /// UHanoiHeatSubsystem: violations add heat 0-5 and fines; heat decays once the player has been out
    /// of police sight for HeatDecayDelaySeconds; camera-enforced rules caught on camera fine without
    /// a chase (phạt nguội); being pulled over pays what can be paid.
    /// </summary>
    public sealed class HeatSystem
    {
        readonly HanoiWorld world;
        bool seen;
        double secondsUnseen;

        public double Heat { get; private set; }
        public int Stars => Math.Max(0, Math.Min(5, (int)Math.Ceiling(Heat - 1e-9)));

        /// <summary>(heat, stars)</summary>
        public event Action<double, int> HeatChanged;
        /// <summary>(rule, noticed, fine)</summary>
        public event Action<string, bool, long> Violation;
        public event Action<long> PulledOverPaid;

        public HeatSystem(HanoiWorld world) { this.world = world; }

        public void Tick(double realSeconds)
        {
            if (seen || Heat <= 0) { secondsUnseen = 0; return; }
            secondsUnseen += realSeconds;
            if (secondsUnseen > world.Rules.HeatDecayDelaySeconds) SetHeat(Heat - world.Rules.HeatDecayPerSecond * realSeconds);
        }

        double MaxHeat =>
            world.State.Flags.Contains(world.Rules.PermanentHeatCapFlag) ? Math.Max(0, world.Rules.MaxHeat - 1) : world.Rules.MaxHeat;

        void SetHeat(double value)
        {
            int oldStars = Stars;
            double old = Heat;
            Heat = Math.Max(0, Math.Min(MaxHeat, value));
            if (Stars != oldStars || (old > 0 && Heat <= 0)) HeatChanged?.Invoke(Heat, Stars);
        }

        public void AddHeat(double amount)
        {
            secondsUnseen = 0;
            SetHeat(Heat + amount);
        }

        public void SetSeenByPolice(bool value)
        {
            seen = value;
            if (seen) secondsUnseen = 0;
        }

        /// <summary>Adds an unpaid fine and licence points; restarts the clean-record counter.</summary>
        public void AddFine(long fineVnd, int licencePoints)
        {
            world.State.UnpaidFinesVnd += fineVnd;
            world.State.LicencePoints = Math.Max(0, world.State.LicencePoints - licencePoints);
            world.RecordFine();
        }

        /// <summary>A traffic rule's fine without a chase (random event "fine" effects, camera fines).</summary>
        public long ApplyRuleFine(string ruleId, bool inCar)
        {
            var rule = world.Content.TrafficRule(HanoiRef.IdOf(ruleId));
            if (rule == null) { world.Warn($"Unknown traffic rule {ruleId}"); return 0; }
            long fine = (inCar ? rule.FineVnd.Car : rule.FineVnd.Motorbike) ?? 0;
            AddFine(fine, rule.LicencePoints ?? 0);
            return fine;
        }

        /// <summary>
        /// A rule was broken. inCar picks the car fine; seenByPolice forces notice; inCameraZone triggers
        /// camera_enforced rules. Returns true if noticed.
        /// </summary>
        public bool ReportViolation(string ruleId, bool inCar, bool seenByPolice, bool inCameraZone)
        {
            var rule = world.Content.TrafficRule(HanoiRef.IdOf(ruleId));
            if (rule == null) { world.Warn($"Unknown traffic rule {ruleId}"); return false; }
            long fine = (inCar ? rule.FineVnd.Car : rule.FineVnd.Motorbike) ?? 0;
            bool noticed = false;
            if (seenByPolice || world.Random.NextDouble() < (rule.Detection.BaseNoticeChance ?? 0))
            {
                noticed = true;
                AddHeat(rule.Heat ?? 0);
                AddFine(fine, rule.LicencePoints ?? 0);
            }
            else if ((rule.Detection.CameraEnforced ?? false) && inCameraZone)
            {
                noticed = true;  // the camera fine arrives later; no chase
                AddFine(fine, rule.LicencePoints ?? 0);
            }
            Violation?.Invoke(rule.Id, noticed, noticed ? fine : 0);
            return noticed;
        }

        /// <summary>Police stopped the player: pay what can be paid, clear heat. Returns the amount paid.</summary>
        public long PulledOver()
        {
            var s = world.State;
            long paid = Math.Min(s.MoneyVnd, s.UnpaidFinesVnd);
            s.MoneyVnd -= paid;
            s.UnpaidFinesVnd -= paid;
            world.NotifyStateChanged();
            SetHeat(0);
            PulledOverPaid?.Invoke(paid);
            return paid;
        }

        internal void Reset() { Heat = 0; secondsUnseen = 0; seen = false; }
    }
}
