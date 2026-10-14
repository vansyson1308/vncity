using System;
using System.Globalization;
using HanoiCity.Content;
using Newtonsoft.Json.Linq;

namespace HanoiCity.Weather
{
    /// <summary>Current weather. Mirrors the live/weather.py feed (GET /weather) and FHanoiWeatherState.</summary>
    [Serializable]
    public sealed class HanoiWeatherState
    {
        public HanoiWeather Condition = HanoiWeather.Clear;
        public double TemperatureC = 27.0;
        /// <summary>0-1</summary>
        public double Humidity = 0.75;
        public double PrecipMmH;
        /// <summary>0-1</summary>
        public double CloudCover = 0.3;
        public double WindKmh = 8.0;
        /// <summary>"Nồm ẩm" damp spell: condensation, wet floors and walls (late winter / spring).</summary>
        public bool Nom;
        /// <summary>"open-meteo", "climatology", "manual"...</summary>
        public string Source = "";
        public DateTime TimeUtc;

        public HanoiWeatherState Clone() => (HanoiWeatherState)MemberwiseClone();
    }

    /// <summary>Something that produces weather for a Hanoi local time; Done may be called later (HTTP).</summary>
    public interface IHanoiWeatherProvider
    {
        void RequestWeather(DateTime hanoiLocal, Action<HanoiWeatherState> done);
    }

    /// <summary>Small deterministic RNG (SplitMix64), identical on Mono, IL2CPP and .NET.</summary>
    public sealed class HanoiRandom
    {
        ulong state;

        public HanoiRandom(ulong seed) { state = seed; }

        public ulong NextULong()
        {
            ulong z = state += 0x9E3779B97F4A7C15UL;
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            return z ^ (z >> 31);
        }

        /// <summary>[0, 1)</summary>
        public double NextDouble() => (NextULong() >> 11) * (1.0 / 9007199254740992.0);

        public double Range(double min, double max) => min + (max - min) * NextDouble();

        /// <summary>Integer in [min, max] inclusive.</summary>
        public int RangeInclusive(int min, int max) => min + (int)(NextDouble() * (max - min + 1));
    }

    /// <summary>
    /// Baked Hanoi (Láng station) monthly normals; deterministic per game day. Same tables and decision
    /// order as UHanoiClimatologyWeather::Sample (the random stream differs: FRandomStream is UE-only).
    /// </summary>
    public sealed class HanoiClimatologyWeather : IHanoiWeatherProvider
    {
        static readonly double[] MeanTempC = { 16.4, 17.2, 20.0, 23.9, 27.4, 28.9, 29.2, 28.6, 27.5, 24.9, 21.5, 18.2 };
        static readonly double[] DailyRangeC = { 5, 4.5, 4.5, 5.5, 6.5, 6, 6, 5.5, 5.5, 6, 6, 6 };
        static readonly double[] RainDayShare = { 0.28, 0.38, 0.48, 0.42, 0.45, 0.50, 0.53, 0.55, 0.45, 0.30, 0.22, 0.18 };
        static readonly double[] DrizzleShareOfRain = { 0.7, 0.8, 0.8, 0.4, 0.1, 0.05, 0.05, 0.05, 0.1, 0.2, 0.4, 0.6 };
        static readonly double[] StormShareOfRain = { 0, 0, 0.02, 0.1, 0.25, 0.3, 0.35, 0.35, 0.25, 0.1, 0.02, 0 };
        static readonly double[] NomShare = { 0.05, 0.35, 0.4, 0.15, 0, 0, 0, 0, 0, 0, 0, 0.02 };
        static readonly double[] HumidityNormal = { 0.80, 0.84, 0.88, 0.87, 0.82, 0.81, 0.82, 0.85, 0.83, 0.79, 0.77, 0.77 };

        public void RequestWeather(DateTime hanoiLocal, Action<HanoiWeatherState> done) => done(Sample(hanoiLocal));

        public static HanoiWeatherState Sample(DateTime local)
        {
            int m = local.Month - 1;
            var day = new HanoiRandom((ulong)(local.Year * 1000 + local.DayOfYear));
            double hour = local.Hour + local.Minute / 60.0;
            var w = new HanoiWeatherState { Source = "climatology", TimeUtc = DateTime.SpecifyKind(local.AddHours(-7), DateTimeKind.Utc) };
            double dayOffset = day.Range(-2.5, 2.5);
            bool rainDay = day.NextDouble() < RainDayShare[m];
            double rainKind = day.NextDouble();
            int rainStart = day.RangeInclusive(0, 23);
            int rainHours = day.RangeInclusive(1, 6);
            w.Nom = day.NextDouble() < NomShare[m];
            double diurnal = Math.Cos((hour - 14.0) / 24.0 * 2.0 * Math.PI);
            w.TemperatureC = MeanTempC[m] + dayOffset + 0.5 * DailyRangeC[m] * diurnal;
            w.Humidity = Math.Max(0, Math.Min(1, HumidityNormal[m] + (w.Nom ? 0.12 : 0) - 0.1 * diurnal));
            w.WindKmh = day.Range(4, 14);
            w.CloudCover = rainDay ? 0.9 : day.Range(0.1, 0.7);
            bool rainingNow = rainDay && (((int)hour - rainStart + 24) % 24) < rainHours;
            bool fogRoll = day.NextDouble() < 0.4;
            if (rainingNow)
            {
                if (rainKind < DrizzleShareOfRain[m]) { w.Condition = HanoiWeather.Drizzle; w.PrecipMmH = 0.3; }
                else if (rainKind > 1.0 - StormShareOfRain[m]) { w.Condition = HanoiWeather.Storm; w.PrecipMmH = 20; w.WindKmh *= 3; }
                else { w.Condition = HanoiWeather.Rain; w.PrecipMmH = 4; }
            }
            else if ((m <= 2 || m == 11) && hour >= 5 && hour < 9 && fogRoll) w.Condition = HanoiWeather.Fog;
            else if (w.TemperatureC >= 35) w.Condition = HanoiWeather.Hot;
            else if (w.TemperatureC <= 13) w.Condition = HanoiWeather.Cold;
            else w.Condition = w.CloudCover > 0.6 ? HanoiWeather.Cloudy : HanoiWeather.Clear;
            return w;
        }
    }

    /// <summary>Parser for the live/weather.py feed; the HTTP part lives in the Unity layer (UnityWebRequest).</summary>
    public static class HanoiWeatherFeed
    {
        /// <summary>False if the JSON is not an object with a known condition.</summary>
        public static bool TryParse(string json, out HanoiWeatherState state)
        {
            state = null;
            JObject o;
            try { o = JObject.Parse(json); }
            catch (Exception) { return false; }
            var condition = (string)o["condition"];
            if (!TryParseCondition(condition, out var c)) return false;
            state = new HanoiWeatherState { Condition = c, Source = (string)o["source"] ?? "" };
            if (o["temperature_c"] != null) state.TemperatureC = (double)o["temperature_c"];
            if (o["humidity"] != null) state.Humidity = (double)o["humidity"];
            if (o["precip_mm_h"] != null) state.PrecipMmH = (double)o["precip_mm_h"];
            if (o["cloud_cover"] != null) state.CloudCover = (double)o["cloud_cover"];
            if (o["wind_kmh"] != null) state.WindKmh = (double)o["wind_kmh"];
            if (o["nom"] != null) state.Nom = (bool)o["nom"];
            var t = o["time_utc"];
            if (t != null)
            {
                if (t.Type == JTokenType.Date) state.TimeUtc = ((DateTime)t).ToUniversalTime();
                else if (DateTime.TryParse((string)t, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
                    state.TimeUtc = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            }
            return true;
        }

        /// <summary>Content enum string ("drizzle") -> HanoiWeather.</summary>
        public static bool TryParseCondition(string value, out HanoiWeather condition)
        {
            condition = HanoiWeather.Unset;
            if (string.IsNullOrEmpty(value)) return false;
            try
            {
                condition = new JValue(value).ToObject<HanoiWeather>();
                return condition != HanoiWeather.Unset;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
