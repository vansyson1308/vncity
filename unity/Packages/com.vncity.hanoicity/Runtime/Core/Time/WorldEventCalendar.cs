using System;
using System.Collections.Generic;
using HanoiCity.Content;
using HanoiCity.Weather;

namespace HanoiCity.Time
{
    /// <summary>
    /// Decides which world events (collection "events") are on at a game time: lunar dates (Tết,
    /// Trung thu, giao thừa = last day of lunar month 12 even when it has 29 days), solar dates,
    /// weekdays (0 = Monday: [4, 5, 6] is Friday-Sunday, the weekend walking street), hours that wrap
    /// past midnight, duration_days, and live weather feeds. The UE harness leaves this to gameplay
    /// (SetWorldEventActive); here HanoiWorld calls it every game hour, and events the calendar
    /// cannot know (air quality) stay manual.
    /// </summary>
    public static class WorldEventCalendar
    {
        /// <summary>True when the event is on at local time t. Manual-only triggers return false.</summary>
        public static bool IsActive(HanoiEventRow ev, DateTime t, HanoiWeatherState weather)
        {
            var tr = ev.Trigger;
            if (tr == null) return false;
            if (!string.IsNullOrEmpty(tr.LiveFeed)) return LiveFeedActive(tr.LiveFeed, weather);
            int duration = Math.Max(1, tr.DurationDays ?? 1);
            bool hasDate = !string.IsNullOrEmpty(tr.LunarDate) || !string.IsNullOrEmpty(tr.SolarDate);
            bool hasWeekday = tr.Weekday != null && tr.Weekday.Count > 0;
            if (!hasDate && !hasWeekday && tr.Hours == null) return false;
            // A window that starts on day s can still be running on t.Date (duration, or hours past midnight).
            for (int back = 0; back <= duration; ++back)
            {
                var start = t.Date.AddDays(-back);
                if (!StartsOn(tr, start)) continue;
                for (int i = 0; i < duration; ++i)
                {
                    if (InWindow(tr.Hours, start.AddDays(i), t)) return true;
                }
            }
            return false;
        }

        static bool StartsOn(HanoiEventTrigger tr, DateTime day)
        {
            if (!string.IsNullOrEmpty(tr.SolarDate))
            {
                ParseDayMonth(tr.SolarDate, out int d, out int m);
                if (day.Day != d || day.Month != m) return false;
            }
            if (!string.IsNullOrEmpty(tr.LunarDate))
            {
                ParseDayMonth(tr.LunarDate, out int d, out int m);
                var lunar = VietnameseLunarCalendar.FromSolar(day);
                if (lunar.IsLeapMonth || lunar.Month != m) return false;
                // "30-12" means the last day of the month: giao thừa falls on the 29th in short years.
                bool dayMatches = d >= 30 ? lunar.IsLastDayOfMonth : lunar.Day == d;
                if (!dayMatches) return false;
            }
            if (tr.Weekday != null && tr.Weekday.Count > 0 && !tr.Weekday.Contains(MondayZero(day))) return false;
            return true;
        }

        /// <summary>Hours window of one day: [day + from, day + to), to &lt;= from runs into the next day.</summary>
        static bool InWindow(HanoiHourRange hours, DateTime day, DateTime t)
        {
            double from = hours?.From ?? 0, to = hours?.To ?? 24;
            if (to <= from) to += 24;
            var a = day.AddHours(from);
            var b = day.AddHours(to);
            return t >= a && t < b;
        }

        public static int MondayZero(DateTime day) => ((int)day.DayOfWeek + 6) % 7;

        static void ParseDayMonth(string s, out int day, out int month)
        {
            var parts = s.Split('-');
            day = int.Parse(parts[0]);
            month = int.Parse(parts[1]);
        }

        /// <summary>Thresholds for the live feeds named in events.json.</summary>
        public static bool LiveFeedActive(string feed, HanoiWeatherState w)
        {
            if (w == null) return false;
            switch (feed)
            {
                case "weather.nom_am": return w.Nom;
                case "weather.storm": return w.Condition == HanoiWeather.Storm;
                case "weather.heavy_rain": return w.Condition == HanoiWeather.Storm || w.PrecipMmH >= 10.0;
                case "weather.heatwave": return w.Condition == HanoiWeather.Hot || w.TemperatureC >= 35.0;
                case "weather.cold_snap": return w.Condition == HanoiWeather.Cold || w.TemperatureC <= 13.0;
                default: return false;  // air.aqi_unhealthy etc.: no feed yet, gameplay sets it
            }
        }

        /// <summary>Ids of every event the calendar turns on at t.</summary>
        public static List<string> ActiveIds(IEnumerable<HanoiEventRow> events, DateTime t, HanoiWeatherState weather)
        {
            var on = new List<string>();
            foreach (var e in events) if (IsActive(e, t, weather)) on.Add(e.Id);
            return on;
        }

        /// <summary>True when the calendar owns this event (otherwise only SetWorldEventActive changes it).</summary>
        public static bool IsAutomatic(HanoiEventRow ev)
        {
            var tr = ev.Trigger;
            if (tr == null) return false;
            if (!string.IsNullOrEmpty(tr.LiveFeed)) return tr.LiveFeed.StartsWith("weather.", StringComparison.Ordinal);
            return !string.IsNullOrEmpty(tr.LunarDate) || !string.IsNullOrEmpty(tr.SolarDate)
                || (tr.Weekday != null && tr.Weekday.Count > 0);
        }
    }
}
