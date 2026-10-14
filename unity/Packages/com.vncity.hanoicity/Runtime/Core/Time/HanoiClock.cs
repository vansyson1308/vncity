using System;

namespace HanoiCity.Time
{
    /// <summary>
    /// Game clock in Hanoi local time (UTC+7, no DST). Scaled by TimeScale (30 = one game day in
    /// 48 real minutes, docs/gdd/01), or locked to the real Hanoi clock. Twin of the clock half of
    /// UHanoiTimeWeatherSubsystem. Times are DateTime with Kind = Unspecified meaning Hanoi local.
    /// </summary>
    public sealed class HanoiClock
    {
        public static readonly TimeSpan UtcOffset = TimeSpan.FromHours(7);

        public DateTime Now { get; private set; }
        public double TimeScale { get; set; }
        public bool SyncToRealTime { get; set; }

        /// <summary>Fires with the new hour (0-23) once per hour boundary crossed (a 4-hour skip fires 4 times).</summary>
        public event Action<int> HourChanged;
        /// <summary>Fires with the new local date whenever the day changes.</summary>
        public event Action<DateTime> DayChanged;

        DateTime lastHourStamp;
        DateTime lastDay;

        public HanoiClock(DateTime start, double timeScale = 30.0)
        {
            Now = DateTime.SpecifyKind(start, DateTimeKind.Unspecified);
            TimeScale = timeScale;
            lastHourStamp = HourStamp(Now);
            lastDay = Now.Date;
        }

        static DateTime HourStamp(DateTime t) => new DateTime(t.Year, t.Month, t.Day, t.Hour, 0, 0);

        /// <summary>Today's date (real Hanoi calendar) at startHour.</summary>
        public static HanoiClock StartingToday(double startHour, double timeScale = 30.0)
        {
            var local = DateTime.UtcNow + UtcOffset;
            return new HanoiClock(local.Date.AddHours(startHour), timeScale);
        }

        public double HourOfDay => Now.Hour + Now.Minute / 60.0 + Now.Second / 3600.0 + Now.Millisecond / 3600000.0;

        public DateTime Utc => DateTime.SpecifyKind(Now - UtcOffset, DateTimeKind.Utc);

        /// <summary>Advance by real seconds (scaled), or snap to the real clock when synced.</summary>
        public void Tick(double realSeconds)
        {
            if (SyncToRealTime) Set(DateTime.UtcNow + UtcOffset);
            else Advance(TimeSpan.FromSeconds(realSeconds * TimeScale));
        }

        /// <summary>Skip game time (a choice that costs 30 minutes, sleeping, wait_until).</summary>
        public void Advance(TimeSpan gameTime)
        {
            if (gameTime < TimeSpan.Zero) return;
            Set(Now + gameTime);
        }

        /// <summary>Jump to a saved time without firing hour/day events (loading a save).</summary>
        public void Restore(DateTime local)
        {
            Now = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
            lastHourStamp = HourStamp(Now);
            lastDay = Now.Date;
        }

        public void Set(DateTime local)
        {
            Now = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
            // Fire once per crossed boundary so hourly rolls (random events) and daily ticks
            // (business_tick, bills) never skip one when time jumps.
            var stamp = HourStamp(Now);
            if (stamp < lastHourStamp || (stamp - lastHourStamp).TotalDays > 400)
            {
                lastHourStamp = stamp;  // set back (load) or a huge jump: resync without replaying
                lastDay = Now.Date;
                return;
            }
            while (lastHourStamp < stamp)
            {
                lastHourStamp = lastHourStamp.AddHours(1);
                if (lastHourStamp.Date > lastDay)
                {
                    lastDay = lastHourStamp.Date;
                    DayChanged?.Invoke(lastDay);
                }
                HourChanged?.Invoke(lastHourStamp.Hour);
            }
        }
    }
}
