using System;

namespace HanoiCity.Time
{
    /// <summary>NOAA solar position. Same algorithm as UHanoiTimeWeatherSubsystem::ComputeSunPosition and hanoi_geo.solar_position.</summary>
    public static class HanoiSun
    {
        static double Rad(double d) => d * Math.PI / 180.0;
        static double Deg(double r) => r * 180.0 / Math.PI;
        static double Mod(double a, double m) { a %= m; return a < 0 ? a + m : a; }

        static readonly DateTime J2000 = new DateTime(2000, 1, 1, 12, 0, 0, DateTimeKind.Utc);

        public static double JulianDay(DateTime utc) => 2451545.0 + (DateTime.SpecifyKind(utc, DateTimeKind.Utc) - J2000).TotalDays;

        /// <summary>Elevation (degrees above the horizon) and azimuth (degrees clockwise from north).</summary>
        public static void Position(DateTime utc, double latDeg, double lonDeg, out double elevationDeg, out double azimuthDeg)
        {
            double jc = (JulianDay(utc) - 2451545.0) / 36525.0;
            double l0 = Mod(280.46646 + jc * (36000.76983 + jc * 0.0003032), 360.0);
            double m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
            double e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
            double mr = Rad(m);
            double c = Math.Sin(mr) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
                + Math.Sin(2.0 * mr) * (0.019993 - 0.000101 * jc) + Math.Sin(3.0 * mr) * 0.000289;
            double omega = Rad(125.04 - 1934.136 * jc);
            double appLong = l0 + c - 0.00569 - 0.00478 * Math.Sin(omega);
            double obliq = 23.0 + (26.0 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60.0) / 60.0;
            double obliqCorr = Rad(obliq + 0.00256 * Math.Cos(omega));
            double decl = Math.Asin(Math.Sin(obliqCorr) * Math.Sin(Rad(appLong)));
            double y = Math.Pow(Math.Tan(obliqCorr / 2.0), 2);
            double l0r = Rad(l0);
            double eqTime = 4.0 * Deg(y * Math.Sin(2.0 * l0r) - 2.0 * e * Math.Sin(mr)
                + 4.0 * e * y * Math.Sin(mr) * Math.Cos(2.0 * l0r) - 0.5 * y * y * Math.Sin(4.0 * l0r)
                - 1.25 * e * e * Math.Sin(2.0 * mr));
            var u = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
            double minutesUtc = u.Hour * 60.0 + u.Minute + u.Second / 60.0 + u.Millisecond / 60000.0;
            double tst = Mod(minutesUtc + eqTime + 4.0 * lonDeg, 1440.0);
            double ha = tst / 4.0 - 180.0;
            double lat = Rad(latDeg), har = Rad(ha);
            double cosZen = Math.Max(-1.0, Math.Min(1.0, Math.Sin(lat) * Math.Sin(decl) + Math.Cos(lat) * Math.Cos(decl) * Math.Cos(har)));
            double zen = Math.Acos(cosZen);
            double denom = Math.Cos(lat) * Math.Sin(zen);
            double az = 180.0;
            if (Math.Abs(denom) > 1e-9)
            {
                double x = Math.Max(-1.0, Math.Min(1.0, (Math.Sin(lat) * Math.Cos(zen) - Math.Sin(decl)) / denom));
                double a = Deg(Math.Acos(x));
                az = ha > 0.0 ? Mod(a + 180.0, 360.0) : Mod(540.0 - a, 360.0);
            }
            elevationDeg = 90.0 - Deg(zen);
            azimuthDeg = az;
        }

        /// <summary>
        /// Unit vector pointing at the sun in the Unity frame (X east, Y up, Z north). A directional light
        /// looks along the opposite direction: Quaternion.LookRotation(-ToSun).
        /// </summary>
        public static void DirectionToSunUnity(double elevationDeg, double azimuthDeg, out double x, out double y, out double z)
        {
            double el = Rad(elevationDeg), az = Rad(azimuthDeg);
            x = Math.Sin(az) * Math.Cos(el);
            y = Math.Sin(el);
            z = Math.Cos(az) * Math.Cos(el);
        }
    }
}
