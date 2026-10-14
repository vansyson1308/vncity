using System;

namespace HanoiCity.Geo
{
    /// <summary>Double-precision 3-vector (no UnityEngine in the core). ENU metres unless noted.</summary>
    [Serializable]
    public struct Double3
    {
        public double X, Y, Z;

        public Double3(double x, double y, double z) { X = x; Y = y; Z = z; }

        public static Double3 operator +(Double3 a, Double3 b) => new Double3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
        public static Double3 operator -(Double3 a, Double3 b) => new Double3(a.X - b.X, a.Y - b.Y, a.Z - b.Z);

        /// <summary>Distance in plan (x, y), ignoring height: what "arrived" means for a mission target.</summary>
        public static double PlanDistance(Double3 a, Double3 b)
        {
            double dx = a.X - b.X, dy = a.Y - b.Y;
            return Math.Sqrt(dx * dx + dy * dy);
        }

        public override string ToString() => $"({X:0.###}, {Y:0.###}, {Z:0.###})";
    }

    /// <summary>
    /// Transverse Mercator on WGS84 (k0 = 1): the pipeline's "+proj=tmerc +lat_0 +lon_0 +k=1 +x_0=0
    /// +y_0=0 +ellps=WGS84". Krueger series in n to third order (Karney 2011), the same code as
    /// HanoiGeoSubsystem.cpp and Content/Python/hanoi_geo.py (which tests compare with pyproj).
    /// </summary>
    public sealed class HanoiTransverseMercator
    {
        const double SemiMajor = 6378137.0;
        const double Flattening = 1.0 / 298.257223563;

        public double Lat0Deg { get; }
        public double Lon0Deg { get; }

        readonly double n, a, y0;
        readonly double[] alpha = new double[3], beta = new double[3], delta = new double[3];

        public HanoiTransverseMercator(double lat0Deg = 21.0288, double lon0Deg = 105.8524)
        {
            Lat0Deg = lat0Deg;
            Lon0Deg = lon0Deg;
            n = Flattening / (2.0 - Flattening);
            double n2 = n * n, n3 = n2 * n;
            a = SemiMajor / (1.0 + n) * (1.0 + n2 / 4.0 + n2 * n2 / 64.0);
            alpha[0] = n / 2.0 - 2.0 / 3.0 * n2 + 5.0 / 16.0 * n3;
            alpha[1] = 13.0 / 48.0 * n2 - 3.0 / 5.0 * n3;
            alpha[2] = 61.0 / 240.0 * n3;
            beta[0] = n / 2.0 - 2.0 / 3.0 * n2 + 37.0 / 96.0 * n3;
            beta[1] = 1.0 / 48.0 * n2 + 1.0 / 15.0 * n3;
            beta[2] = 17.0 / 480.0 * n3;
            delta[0] = 2.0 * n - 2.0 / 3.0 * n2 - 2.0 * n3;
            delta[1] = 7.0 / 3.0 * n2 - 8.0 / 5.0 * n3;
            delta[2] = 56.0 / 15.0 * n3;
            y0 = 0.0;
            y0 = Northing(Rad(lat0Deg), 0.0, out _);
        }

        static double Rad(double d) => d * Math.PI / 180.0;
        static double Deg(double r) => r * 180.0 / Math.PI;
        static double Atanh(double x) => 0.5 * Math.Log((1.0 + x) / (1.0 - x));

        double Northing(double phi, double lambda, out double easting)
        {
            double k = 2.0 * Math.Sqrt(n) / (1.0 + n);
            double sinPhi = Math.Sin(phi);
            double t = Math.Sinh(Atanh(sinPhi) - k * Atanh(k * sinPhi));
            double xiP = Math.Atan2(t, Math.Cos(lambda));
            double etaP = Atanh(Math.Sin(lambda) / Math.Sqrt(1.0 + t * t));
            double xi = xiP, eta = etaP;
            for (int j = 1; j <= 3; ++j)
            {
                xi += alpha[j - 1] * Math.Sin(2.0 * j * xiP) * Math.Cosh(2.0 * j * etaP);
                eta += alpha[j - 1] * Math.Cos(2.0 * j * xiP) * Math.Sinh(2.0 * j * etaP);
            }
            easting = a * eta;
            return a * xi - y0;
        }

        /// <summary>WGS84 degrees -> local metres (x = east, y = north).</summary>
        public void Forward(double latDeg, double lonDeg, out double x, out double y)
        {
            y = Northing(Rad(latDeg), Rad(lonDeg - Lon0Deg), out x);
        }

        /// <summary>Local metres -> WGS84 degrees.</summary>
        public void Inverse(double x, double y, out double latDeg, out double lonDeg)
        {
            double xi = (y + y0) / a, eta = x / a;
            double xiP = xi, etaP = eta;
            for (int j = 1; j <= 3; ++j)
            {
                xiP -= beta[j - 1] * Math.Sin(2.0 * j * xi) * Math.Cosh(2.0 * j * eta);
                etaP -= beta[j - 1] * Math.Cos(2.0 * j * xi) * Math.Sinh(2.0 * j * eta);
            }
            double chi = Math.Asin(Math.Sin(xiP) / Math.Cosh(etaP));
            double phi = chi;
            for (int j = 1; j <= 3; ++j) phi += delta[j - 1] * Math.Sin(2.0 * j * chi);
            latDeg = Deg(phi);
            lonDeg = Lon0Deg + Deg(Math.Atan2(Math.Sinh(etaP), Math.Cos(xiP)));
        }
    }

    /// <summary>
    /// City georeference with a floating origin. Frames:
    ///  - Geo: WGS84 degrees + AltM (metres above the city origin height).
    ///  - ENU: pipeline metres, x east, y north, z up (docs/pipeline-outputs.md), double precision.
    ///  - Unity: metres, X = east, Y = up, Z = north, relative to <see cref="RebaseEnu"/>:
    ///    Unity = (x - rx, z - rz, y - ry). Unity positions are 32-bit floats; the inner districts span
    ///    ~24 km, so the Unity layer rebases (HanoiFloatingOrigin) to keep the camera within a few km
    ///    of (0, 0, 0). Everything that must be exact (mission arrival, collectibles) compares ENU doubles.
    /// Yaw: pipeline degrees CCW from east turn a mesh's forward (+X, game/assets/asset_specs.json)
    /// toward that heading; the Unity yaw (degrees about +Y, clockwise seen from above) that does the
    /// same for a mesh whose forward is Unity local +X is -yaw. glTFast mirrors glTF X on import, so a
    /// prop's forward may land on local -X: the point-set renderer adds yaw_offset_deg (180) for that.
    /// </summary>
    public sealed class HanoiGeoFrame
    {
        public HanoiTransverseMercator Projection { get; private set; }
        public double OriginHeightM { get; private set; }

        /// <summary>ENU point that is Unity (0, 0, 0) right now.</summary>
        public Double3 RebaseEnu { get; set; }

        public HanoiGeoFrame(double originLat = 21.0288, double originLon = 105.8524, double originHeightM = 0.0)
        {
            SetOrigin(originLat, originLon, originHeightM);
        }

        public void SetOrigin(double lat, double lon, double heightM)
        {
            Projection = new HanoiTransverseMercator(lat, lon);
            OriginHeightM = heightM;
        }

        public Double3 GeoToEnu(double lat, double lon, double altM = 0.0)
        {
            Projection.Forward(lat, lon, out var x, out var y);
            return new Double3(x, y, altM);
        }

        public Double3 GeoToEnu(Content.HanoiGeo g) => GeoToEnu(g.Lat, g.Lon, g.AltM);

        public Content.HanoiGeo EnuToGeo(Double3 enu)
        {
            Projection.Inverse(enu.X, enu.Y, out var lat, out var lon);
            return new Content.HanoiGeo(lat, lon, enu.Z);
        }

        /// <summary>ENU metres -> Unity metres (X east, Y up, Z north) relative to the rebase point.</summary>
        public Double3 EnuToUnity(Double3 enu) => new Double3(enu.X - RebaseEnu.X, enu.Z - RebaseEnu.Z, enu.Y - RebaseEnu.Y);

        public Double3 UnityToEnu(Double3 u) => new Double3(u.X + RebaseEnu.X, u.Z + RebaseEnu.Y, u.Y + RebaseEnu.Z);

        public static double EnuYawToUnityYaw(double yawDeg) => -yawDeg;
    }
}
