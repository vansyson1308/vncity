using System;

namespace HanoiCity.Time
{
    /// <summary>A date of the Vietnamese lunar calendar (âm lịch).</summary>
    public struct LunarDate
    {
        public int Day, Month, Year;
        public bool IsLeapMonth;
        /// <summary>29 or 30.</summary>
        public int MonthLength;

        public bool IsLastDayOfMonth => Day == MonthLength;
        public override string ToString() => $"{Day}-{Month}{(IsLeapMonth ? " (nhuận)" : "")}/{Year}";
    }

    /// <summary>
    /// Solar -> Vietnamese lunar date, Hồ Ngọc Đức's astronomical algorithm (new moons and solar terms
    /// from Jean Meeus, "Astronomical Algorithms") with the UTC+7 meridian, which is what makes
    /// Vietnamese Tết differ from Chinese New Year in some years. Valid roughly 1800-2199.
    /// </summary>
    public static class VietnameseLunarCalendar
    {
        const double TimeZone = 7.0;

        static long Floor(double x) => (long)Math.Floor(x);

        public static long JulianDayNumber(int dd, int mm, int yy)
        {
            long a = (14 - mm) / 12;
            long y = yy + 4800 - a;
            long m = mm + 12 * a - 3;
            long jd = dd + (153 * m + 2) / 5 + 365 * y + y / 4 - y / 100 + y / 400 - 32045;
            if (jd < 2299161) jd = dd + (153 * m + 2) / 5 + 365 * y + y / 4 - 32083;
            return jd;
        }

        static double NewMoon(long k)
        {
            double t = k / 1236.85, t2 = t * t, t3 = t2 * t, dr = Math.PI / 180.0;
            double jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
            jd1 += 0.00033 * Math.Sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);
            double m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
            double mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
            double f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
            double c1 = (0.1734 - 0.000393 * t) * Math.Sin(m * dr) + 0.0021 * Math.Sin(2 * dr * m);
            c1 = c1 - 0.4068 * Math.Sin(mpr * dr) + 0.0161 * Math.Sin(dr * 2 * mpr);
            c1 -= 0.0004 * Math.Sin(dr * 3 * mpr);
            c1 = c1 + 0.0104 * Math.Sin(dr * 2 * f) - 0.0051 * Math.Sin(dr * (m + mpr));
            c1 = c1 - 0.0074 * Math.Sin(dr * (m - mpr)) + 0.0004 * Math.Sin(dr * (2 * f + m));
            c1 = c1 - 0.0004 * Math.Sin(dr * (2 * f - m)) - 0.0006 * Math.Sin(dr * (2 * f + mpr));
            c1 = c1 + 0.0010 * Math.Sin(dr * (2 * f - mpr)) + 0.0005 * Math.Sin(dr * (2 * mpr + m));
            double deltat = t < -11
                ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
                : -0.000278 + 0.000265 * t + 0.000262 * t2;
            return jd1 + c1 - deltat;
        }

        static long NewMoonDay(long k) => Floor(NewMoon(k) + 0.5 + TimeZone / 24.0);

        static double SunLongitudeRad(double jdn)
        {
            double t = (jdn - 2451545.0) / 36525.0, t2 = t * t, dr = Math.PI / 180.0;
            double m = 357.52910 + 35999.05030 * t - 0.0001559 * t2 - 0.00000048 * t * t2;
            double l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
            double dl = (1.914600 - 0.004817 * t - 0.000014 * t2) * Math.Sin(dr * m);
            dl += (0.019993 - 0.000101 * t) * Math.Sin(dr * 2 * m) + 0.000290 * Math.Sin(dr * 3 * m);
            double l = (l0 + dl) * dr;
            return l - Math.PI * 2 * Floor(l / (Math.PI * 2));
        }

        /// <summary>Solar term index 0-11 (30° sectors of the sun's longitude) at local midnight of a day.</summary>
        static long SunSector(long dayNumber) => Floor(SunLongitudeRad(dayNumber - 0.5 - TimeZone / 24.0) / Math.PI * 6);

        static long LunarMonth11(int yy)
        {
            double off = JulianDayNumber(31, 12, yy) - 2415021;
            long k = Floor(off / 29.530588853);
            long nm = NewMoonDay(k);
            if (SunSector(nm) >= 9) nm = NewMoonDay(k - 1);
            return nm;
        }

        static int LeapMonthOffset(long a11)
        {
            long k = Floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
            long last;
            int i = 1;
            long arc = SunSector(NewMoonDay(k + i));
            do
            {
                last = arc;
                i++;
                arc = SunSector(NewMoonDay(k + i));
            } while (arc != last && i < 14);
            return i - 1;
        }

        static long MonthStart(long dayNumber)
        {
            long k = Floor((dayNumber - 2415021.076998695) / 29.530588853);
            long start = NewMoonDay(k + 1);
            if (start > dayNumber) start = NewMoonDay(k);
            return start;
        }

        public static LunarDate FromSolar(DateTime date)
        {
            int dd = date.Day, mm = date.Month, yy = date.Year;
            long dayNumber = JulianDayNumber(dd, mm, yy);
            long monthStart = MonthStart(dayNumber);
            long a11 = LunarMonth11(yy), b11 = a11;
            int lunarYear;
            if (a11 >= monthStart)
            {
                lunarYear = yy;
                a11 = LunarMonth11(yy - 1);
            }
            else
            {
                lunarYear = yy + 1;
                b11 = LunarMonth11(yy + 1);
            }
            int lunarDay = (int)(dayNumber - monthStart + 1);
            int diff = (int)Floor((monthStart - a11) / 29.0);
            bool leap = false;
            int lunarMonth = diff + 11;
            if (b11 - a11 > 365)
            {
                int leapDiff = LeapMonthOffset(a11);
                if (diff >= leapDiff)
                {
                    lunarMonth = diff + 10;
                    if (diff == leapDiff) leap = true;
                }
            }
            if (lunarMonth > 12) lunarMonth -= 12;
            if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
            long nextStart = MonthStart(monthStart + 31);
            return new LunarDate
            {
                Day = lunarDay, Month = lunarMonth, Year = lunarYear, IsLeapMonth = leap,
                MonthLength = (int)(nextStart - monthStart),
            };
        }
    }
}
