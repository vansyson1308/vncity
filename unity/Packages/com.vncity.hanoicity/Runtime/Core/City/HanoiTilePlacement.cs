using System;
using System.Collections.Generic;
using System.Linq;

namespace HanoiCity.City
{
    /// <summary>A plan box in metres: (x0, x1) east-west, (n0, n1) the other plan axis.</summary>
    public struct PlanBox
    {
        public double X0, X1, Y0, Y1;
        public PlanBox(double x0, double x1, double y0, double y1) { X0 = x0; X1 = x1; Y0 = y0; Y1 = y1; }

        public double Area => Math.Max(0, X1 - X0) * Math.Max(0, Y1 - Y0);

        public static double IoU(PlanBox a, PlanBox b)
        {
            double ix = Math.Max(0, Math.Min(a.X1, b.X1) - Math.Max(a.X0, b.X0));
            double iy = Math.Max(0, Math.Min(a.Y1, b.Y1) - Math.Max(a.Y0, b.Y0));
            double inter = ix * iy, union = a.Area + b.Area - inter;
            return union > 0 ? inter / union : 0;
        }
    }

    /// <summary>One importer hypothesis: local plan (x, z) = M * (east, north), with or without the glTF node offset baked in.</summary>
    public struct TileMapping
    {
        /// <summary>Signed permutation rows: localX = M00 e + M01 n, localZ = M10 e + M11 n.</summary>
        public int M00, M01, M10, M11;
        public bool Baked;

        public TileMapping(int m00, int m01, int m10, int m11, bool baked) { M00 = m00; M01 = m01; M10 = m10; M11 = m11; Baked = baked; }

        public override string ToString() => $"(({M00}, {M01}), ({M10}, {M11})) baked={Baked}";
    }

    /// <summary>Transform that puts an imported tile in the Unity frame (X east, Z north, Y up): world = T * R(yaw) * S * local.</summary>
    public struct TilePlacementResult
    {
        public TileMapping Mapping;
        /// <summary>Position in ENU plan metres (the Unity layer subtracts the floating origin): (east, north).</summary>
        public double OffsetEast, OffsetNorth;
        /// <summary>Degrees about Unity +Y (clockwise seen from above, +Z toward +X).</summary>
        public double YawDeg;
        /// <summary>-1 when the local Z axis must be mirrored.</summary>
        public double ScaleZ;
    }

    /// <summary>
    /// Measures how the glTF importer landed tiles instead of trusting it (the same idea as
    /// import_city.py / hanoi_geo.solve_mapping for UE): the tile glb is X = east, Y = up, Z = -north with
    /// the tile offset in the node translation. glTFast mirrors glTF X to go left-handed, so the expected
    /// local plan is (-east, -north) with the offset baked; UnityGLTF-style importers mirror Z, giving
    /// (east, north). Hypotheses are ranked by summed IoU of the measured mesh plan boxes against the
    /// buildings' known extent (semantics/footprints_X_Y.json) over several tiles at different offsets;
    /// near-ties keep the first (expected) hypothesis.
    /// </summary>
    public static class HanoiTilePlacement
    {
        public const double TieIoU = 0.005;

        static readonly int[][] PlaneMaps =
        {
            new[] { -1, 0, 0, -1 },  // glTFast: X mirrored -> 180 degrees about Y. Expected; wins ties.
            new[] { 1, 0, 0, 1 },    // Z mirrored (UnityGLTF): already east/north
            new[] { 1, 0, 0, -1 }, new[] { -1, 0, 0, 1 },
            new[] { 0, 1, 1, 0 }, new[] { 0, 1, -1, 0 }, new[] { 0, -1, 1, 0 }, new[] { 0, -1, -1, 0 },
        };

        public static IEnumerable<TileMapping> Candidates()
        {
            foreach (bool baked in new[] { true, false })
                foreach (var m in PlaneMaps)
                    yield return new TileMapping(m[0], m[1], m[2], m[3], baked);
        }

        /// <summary>Plan box the mesh would have in local space under a hypothesis, given the expected ENU box.</summary>
        public static PlanBox ExpectedLocalBox(TileMapping m, PlanBox expectedEnu, double tileOriginEast, double tileOriginNorth)
        {
            double de = m.Baked ? 0 : tileOriginEast, dn = m.Baked ? 0 : tileOriginNorth;
            double xmin = double.MaxValue, xmax = double.MinValue, ymin = double.MaxValue, ymax = double.MinValue;
            foreach (var e in new[] { expectedEnu.X0 - de, expectedEnu.X1 - de })
                foreach (var n in new[] { expectedEnu.Y0 - dn, expectedEnu.Y1 - dn })
                {
                    double lx = m.M00 * e + m.M01 * n, lz = m.M10 * e + m.M11 * n;
                    xmin = Math.Min(xmin, lx); xmax = Math.Max(xmax, lx);
                    ymin = Math.Min(ymin, lz); ymax = Math.Max(ymax, lz);
                }
            return new PlanBox(xmin, xmax, ymin, ymax);
        }

        public struct Sample
        {
            /// <summary>Imported mesh bounds in local (x, z), metres.</summary>
            public PlanBox MeasuredLocal;
            public double TileOriginEast, TileOriginNorth;
            /// <summary>Expected ENU plan box of the tile's buildings.</summary>
            public PlanBox ExpectedEnu;
        }

        public sealed class Solution
        {
            public TileMapping Mapping;
            public double Total;
            public List<double> Scores = new List<double>();
            public TileMapping RunnerUp;
            public double RunnerUpTotal;
            public bool Ambiguous => Scores.Count == 0 || Scores.Min() < 0.6 || Total - RunnerUpTotal < 0.05 * Scores.Count;
        }

        public static Solution Solve(IList<Sample> samples)
        {
            var ranked = new List<(double total, int order, TileMapping m, List<double> scores)>();
            int i = 0;
            foreach (var m in Candidates())
            {
                var scores = samples.Select(s => PlanBox.IoU(ExpectedLocalBox(m, s.ExpectedEnu, s.TileOriginEast, s.TileOriginNorth), s.MeasuredLocal)).ToList();
                ranked.Add((scores.Sum(), i++, m, scores));
            }
            var expected = ranked[0];
            var sorted = ranked.OrderByDescending(r => r.total).ThenBy(r => r.order).ToList();
            if (expected.total >= sorted[0].total - TieIoU * samples.Count)
            {
                sorted.Remove(expected);
                sorted.Insert(0, expected);
            }
            return new Solution
            {
                Mapping = sorted[0].m, Total = sorted[0].total, Scores = sorted[0].scores,
                RunnerUp = sorted.Count > 1 ? sorted[1].m : sorted[0].m, RunnerUpTotal = sorted.Count > 1 ? sorted[1].total : 0,
            };
        }

        /// <summary>
        /// Transform for a tile imported under mapping m: world plan = Minv * local (+ tile origin if the
        /// importer dropped the node offset). Minv = M^T (signed permutation), decomposed as a rotation
        /// about Y times an optional mirror of local Z.
        /// </summary>
        public static TilePlacementResult Place(TileMapping m, double tileOriginEast, double tileOriginNorth)
        {
            // A = M^T maps local (x, z) to world (east, north).
            double a00 = m.M00, a01 = m.M10, a10 = m.M01, a11 = m.M11;
            double sz = 1;
            if (a00 * a11 - a01 * a10 < 0)
            {
                sz = -1;  // A = R * diag(1, -1): R = A * diag(1, -1)
                a01 = -a01;
                a11 = -a11;
            }
            // Unity yaw theta: x' = x cos + z sin, z' = -x sin + z cos -> R = [[c, s], [-s, c]].
            double yaw = Math.Atan2(a01, a00) * 180.0 / Math.PI;
            return new TilePlacementResult
            {
                Mapping = m,
                OffsetEast = m.Baked ? 0 : tileOriginEast,
                OffsetNorth = m.Baked ? 0 : tileOriginNorth,
                YawDeg = Math.Round(yaw, 6) + 0.0,
                ScaleZ = sz,
            };
        }

        /// <summary>Apply a placement to a local point (x, z) -> world (east, north). For tests and debug drawing.</summary>
        public static (double east, double north) Apply(TilePlacementResult p, double x, double z)
        {
            z *= p.ScaleZ;
            double t = p.YawDeg * Math.PI / 180.0, c = Math.Cos(t), s = Math.Sin(t);
            return (x * c + z * s + p.OffsetEast, -x * s + z * c + p.OffsetNorth);
        }
    }
}
