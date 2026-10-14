using System;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Geo;
using HanoiCity.Time;
using HanoiCity.Weather;
using NUnit.Framework;

namespace HanoiCity.Tests
{
    public class GeoTimeTests
    {
        // Reference values from Content/Python/hanoi_geo.py (which tests compare with pyproj to < 1 µm).
        [TestCase(21.02781, 105.85231, -9.355601748159193, -109.61021885927767)]
        [TestCase(21.0243, 105.8576, 540.5585338914577, -498.2193763977848)]
        [TestCase(21.12, 105.72, -13754.657691798524, 10103.207557981834)]
        [TestCase(20.93, 105.95, 10152.238463980293, -10935.726992973592)]
        public void ProjectionMatchesThePythonTwin(double lat, double lon, double x, double y)
        {
            var tm = new HanoiTransverseMercator(21.0288, 105.8524);
            tm.Forward(lat, lon, out var gx, out var gy);
            Assert.That(gx, Is.EqualTo(x).Within(1e-6));
            Assert.That(gy, Is.EqualTo(y).Within(1e-6));
            tm.Inverse(gx, gy, out var la, out var lo);
            Assert.That(la, Is.EqualTo(lat).Within(1e-8));  // ~1 mm
            Assert.That(lo, Is.EqualTo(lon).Within(1e-8));
        }

        [Test]
        public void UnityFrameIsEastUpNorthAndRebases()
        {
            var f = new HanoiGeoFrame();
            var enu = new Double3(100, 200, 5);
            var u = f.EnuToUnity(enu);
            Assert.That((u.X, u.Y, u.Z), Is.EqualTo((100.0, 5.0, 200.0)));
            f.RebaseEnu = new Double3(90, 150, 0);
            u = f.EnuToUnity(enu);
            Assert.That((u.X, u.Y, u.Z), Is.EqualTo((10.0, 5.0, 50.0)));
            var back = f.UnityToEnu(u);
            Assert.That((back.X, back.Y, back.Z), Is.EqualTo((100.0, 200.0, 5.0)));
        }

        // Reference values from hanoi_geo.solar_position (NOAA), UTC.
        [TestCase(2026, 6, 21, 5, 0, 87.56071669739569, 351.0783536171398)]
        [TestCase(2026, 12, 21, 0, 0, 5.682520493203086, 117.80357201885863)]
        [TestCase(2026, 10, 14, 9, 30, 13.679498394039243, 255.45493045107295)]
        public void SunMatchesThePythonTwin(int y, int mo, int d, int h, int mi, double el, double az)
        {
            HanoiSun.Position(new DateTime(y, mo, d, h, mi, 0, DateTimeKind.Utc), 21.0288, 105.8524, out var e, out var a);
            Assert.That(e, Is.EqualTo(el).Within(1e-6));
            Assert.That(a, Is.EqualTo(az).Within(1e-5));  // azimuth near the zenith is ill-conditioned
        }

        [Test]
        public void SunRisesInTheEast()
        {
            var local7 = new DateTime(2026, 10, 14, 7, 0, 0);
            HanoiSun.Position(local7.AddHours(-7), 21.0288, 105.8524, out var el, out var az);
            Assert.That(el, Is.GreaterThan(0));
            HanoiSun.DirectionToSunUnity(el, az, out var x, out _, out _);
            Assert.That(x, Is.GreaterThan(0.5), "07:00 sun is toward +X (east)");
        }

        [Test]
        public void ClockFiresEveryHourAndDayItCrosses()
        {
            var c = new HanoiClock(new DateTime(2026, 10, 14, 22, 30, 0));
            var hours = new System.Collections.Generic.List<int>();
            int days = 0;
            c.HourChanged += h => hours.Add(h);
            c.DayChanged += d => days++;
            c.Advance(TimeSpan.FromHours(4));
            Assert.That(hours, Is.EqualTo(new[] { 23, 0, 1, 2 }));
            Assert.That(days, Is.EqualTo(1));
            c.Tick(60);  // one real minute at 30x = 30 game minutes
            Assert.That(c.Now, Is.EqualTo(new DateTime(2026, 10, 15, 3, 0, 0)));
            c.Restore(new DateTime(2026, 10, 20, 9, 0, 0));
            Assert.That(days, Is.EqualTo(1), "restoring a save does not replay days");
        }

        // Tết Nguyên đán (1-1) per the Vietnamese calendar (UTC+7). 2030 differs from China's Feb 3:
        // the new moon falls at 23:07 Hanoi time on Feb 2.
        [TestCase(2024, 2, 10)]
        [TestCase(2025, 1, 29)]
        [TestCase(2026, 2, 17)]
        [TestCase(2027, 2, 6)]
        [TestCase(2030, 2, 2)]
        public void TetIsLunarNewYear(int y, int m, int d)
        {
            var l = VietnameseLunarCalendar.FromSolar(new DateTime(y, m, d));
            Assert.That((l.Day, l.Month, l.IsLeapMonth, l.Year), Is.EqualTo((1, 1, false, y)));
            var eve = VietnameseLunarCalendar.FromSolar(new DateTime(y, m, d).AddDays(-1));
            Assert.That(eve.Month, Is.EqualTo(12));
            Assert.That(eve.IsLastDayOfMonth, "the day before Tết is giao thừa");
        }

        [Test]
        public void LeapMonthAndMidAutumn()
        {
            var l = VietnameseLunarCalendar.FromSolar(new DateTime(2025, 7, 25));
            Assert.That((l.Day, l.Month, l.IsLeapMonth), Is.EqualTo((1, 6, true)), "2025 has a leap 6th month");
            var tt = VietnameseLunarCalendar.FromSolar(new DateTime(2026, 9, 25));
            Assert.That((tt.Day, tt.Month), Is.EqualTo((15, 8)), "Trung thu 2026");
        }

        static HanoiEventRow Ev(string id) => TestPaths.RealContent.Get<HanoiEventRow>("events", id);

        [Test]
        public void CalendarTurnsEventsOnAndOff()
        {
            var clear = new HanoiWeatherState();
            // 2026-10-16 is a Friday.
            Assert.That(WorldEventCalendar.IsActive(Ev("pho_di_bo_cuoi_tuan"), new DateTime(2026, 10, 16, 20, 0, 0), clear));
            Assert.That(WorldEventCalendar.IsActive(Ev("pho_di_bo_cuoi_tuan"), new DateTime(2026, 10, 15, 20, 0, 0), clear), Is.False);
            Assert.That(WorldEventCalendar.IsActive(Ev("pho_di_bo_ban_ngay"), new DateTime(2026, 10, 17, 10, 0, 0), clear));
            // Giao thừa 2026 = 16 Feb 22:00 to 17 Feb 01:00; Tết lasts three days.
            Assert.That(WorldEventCalendar.IsActive(Ev("giao_thua"), new DateTime(2026, 2, 16, 23, 30, 0), clear));
            Assert.That(WorldEventCalendar.IsActive(Ev("giao_thua"), new DateTime(2026, 2, 17, 0, 30, 0), clear));
            Assert.That(WorldEventCalendar.IsActive(Ev("giao_thua"), new DateTime(2026, 2, 17, 1, 30, 0), clear), Is.False);
            Assert.That(WorldEventCalendar.IsActive(Ev("tet_nguyen_dan"), new DateTime(2026, 2, 19, 12, 0, 0), clear));
            Assert.That(WorldEventCalendar.IsActive(Ev("tet_nguyen_dan"), new DateTime(2026, 2, 20, 12, 0, 0), clear), Is.False);
            Assert.That(WorldEventCalendar.IsActive(Ev("trung_thu"), new DateTime(2026, 9, 25, 20, 0, 0), clear));
            Assert.That(WorldEventCalendar.IsActive(Ev("giai_phong_thu_do"), new DateTime(2026, 10, 10, 8, 0, 0), clear));
            var nom = new HanoiWeatherState { Nom = true };
            Assert.That(WorldEventCalendar.IsActive(Ev("mua_nom"), new DateTime(2026, 3, 1), nom));
            Assert.That(WorldEventCalendar.IsAutomatic(Ev("bui_min_cao")), Is.False, "air quality has no feed yet");
        }

        [Test]
        public void WorldFollowsTheCalendarButManualOverridesWin()
        {
            var w = Worlds.Real(new DateTime(2026, 10, 16, 18, 30, 0));  // Friday
            Assert.That(w.IsWorldEventActive("pho_di_bo_cuoi_tuan"), Is.False);
            w.Clock.Advance(TimeSpan.FromHours(1));
            Assert.That(w.IsWorldEventActive("pho_di_bo_cuoi_tuan"));
            w.SetWorldEventActive("events:bui_min_cao", true);
            Assert.That(w.IsWorldEventActive("bui_min_cao"));
        }

        [Test]
        public void WeatherFeedAndClimatology()
        {
            Assert.That(HanoiWeatherFeed.TryParse(
                "{\"time_utc\": \"2026-10-12T19:00:00Z\", \"local_hour\": 2.0, \"condition\": \"drizzle\", \"temperature_c\": 24.1, " +
                "\"humidity\": 0.86, \"precip_mm_h\": 0.3, \"cloud_cover\": 0.9, \"wind_kmh\": 9.0, \"nom\": false, \"source\": \"open-meteo\"}", out var s));
            Assert.That(s.Condition, Is.EqualTo(HanoiWeather.Drizzle));
            Assert.That(s.TimeUtc, Is.EqualTo(new DateTime(2026, 10, 12, 19, 0, 0, DateTimeKind.Utc)));
            Assert.That(HanoiWeatherFeed.TryParse("{\"condition\": \"snow\"}", out _), Is.False);
            var a = HanoiClimatologyWeather.Sample(new DateTime(2026, 7, 1, 14, 0, 0));
            var b = HanoiClimatologyWeather.Sample(new DateTime(2026, 7, 1, 14, 0, 0));
            Assert.That(a.TemperatureC, Is.EqualTo(b.TemperatureC), "deterministic per day");
            var temps = Enumerable.Range(1, 28).Select(d => HanoiClimatologyWeather.Sample(new DateTime(2026, 1, d, 6, 0, 0)).TemperatureC).ToList();
            Assert.That(temps.Average(), Is.InRange(10.0, 18.0), "January mornings are cool");
        }
    }
}
