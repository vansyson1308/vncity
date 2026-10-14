using System;
using System.Collections.Generic;

namespace HanoiCity
{
    /// <summary>
    /// Every tuning number of the runtime in one place (the Unity layer copies them from the
    /// HanoiSettings asset). Defaults: the UE settings (UHanoiCitySettings) where one exists, else the
    /// GDD or tools/playtest.py value named in the comment. Numbers the GDD does not fix are marked
    /// "tuning" and are guesses to adjust in playtests.
    /// </summary>
    [Serializable]
    public sealed class HanoiRules
    {
        // ---- georeference (manifest.georeference; setup writes it)
        public double OriginLat = 21.0288;
        public double OriginLon = 105.8524;
        public double OriginHeightM;

        // ---- time (docs/gdd/01: one game day = 48 real minutes)
        public double TimeScale = 30.0;
        public bool SyncToRealHanoiTime;
        public double StartHour = 7.0;
        /// <summary>Real seconds between polls of a live weather feed.</summary>
        public double WeatherPollSeconds = 900.0;

        // ---- missions
        public double MissionArriveRadiusM = 15.0;
        public long StartingMoneyVnd = 500000;
        /// <summary>Game days without a fine before the flag ho_so_sach_90_ngay is set.</summary>
        public int CleanRecordDays = 90;
        public string CleanRecordFlag = "ho_so_sach_90_ngay";

        // ---- CSGT attention (docs/gdd/02 §1)
        public double MaxHeat = 5.0;
        public double HeatDecayDelaySeconds = 20.0;
        public double HeatDecayPerSecond = 0.05;
        /// <summary>Content flag (reward of s12) that lowers the heat cap by one star for good.</summary>
        public string PermanentHeatCapFlag = "giam_chu_y_vinh_vien_1";

        // ---- skills (docs/gdd/02 §10)
        /// <summary>Levels gained each time a random-event choice or a job trains a skill (tuning).</summary>
        public int SkillGainPerTraining = 2;

        // ---- random street events (docs/gdd/02 §7.1)
        public double RandomEventLandmarkRadiusM = 150.0;
        /// <summary>Real seconds an event waits for the player when it has no duration_s (tuning).</summary>
        public double RandomEventDefaultDurationS = 90.0;
        /// <summary>GTA-style: nothing random spawns while a mission runs.</summary>
        public bool RandomEventsDuringMissions;

        // ---- collectibles (docs/gdd/02 §11)
        public double CollectRadiusM = 30.0;
        /// <summary>"Chụp khớp trên 85%" opens the old photo over the new one.</summary>
        public double PhotoMatchThreshold = 0.85;
        public int Tape22Photos = 60;
        public int Tape23Photos = 90;
        /// <summary>Tape 24 (the 49 Hàng Chiếu answer): this many photos once chapter Tape24Chapter is reached...</summary>
        public int Tape24Photos = 30;
        public int Tape24Chapter = 3;
        /// <summary>...or ông Thắng tells it in chapter 4 (docs/gdd/02 §11).</summary>
        public string Tape24Flag = "khoi_nghe_thang_ke_het";
        /// <summary>Coupons are hidden this far (at most) from their coordinate, in a spot named by hidden_in.</summary>
        public double CouponHideRadiusM = 20.0;

        // ---- economy (docs/gdd/02 §6, docs/gdd/01 §kinh tế)
        /// <summary>"Lỗ 3 tháng liền thì phải sang nhượng lại."</summary>
        public int BusinessLossDaysBeforeSale = 90;
        /// <summary>"Video viral +30% trong 3 tuần."</summary>
        public double ViralIncomeBonus = 0.30;
        public int ViralDays = 21;
        /// <summary>Income factor on cold days for pho shops ("rét thì phở đông", tuning).</summary>
        public double ColdPhoFactor = 1.2;
        /// <summary>Income factor for every business while events:mua_ngap is on ("mưa ngập thì vắng", tuning).</summary>
        public double FloodFactor = 0.6;
        /// <summary>Income factor while events:trung_thu is on ("Trung thu đông", tuning).</summary>
        public double MidAutumnFactor = 1.3;
        /// <summary>Events during which businesses close (income 0, upkeep still paid): "Tết đóng cửa".</summary>
        public List<string> ClosedDuringEvents = new List<string> { "tet_nguyen_dan" };
        /// <summary>App weekly bonus counts jobs rated at least this (activities pay.weekly_bonus_vnd).</summary>
        public double WeeklyBonusMinRating = 4.8;
        /// <summary>Game days between monthly bills.</summary>
        public int BillingPeriodDays = 30;
        /// <summary>Recurring costs (tools/playtest.py MINH_MONTHLY: rent, money home to his mother, the 180 tr hospital loan in 60 instalments).</summary>
        public List<HanoiBill> MonthlyBills = new List<HanoiBill>
        {
            new HanoiBill { Id = "minh_tro", Character = "minh", AmountVnd = 2500000 },
            new HanoiBill { Id = "minh_gui_me", Character = "minh", AmountVnd = 2000000 },
            new HanoiBill { Id = "minh_no_vien_phi", Character = "minh", AmountVnd = 4000000, Instalments = 60 },
        };
    }

    [Serializable]
    public sealed class HanoiBill
    {
        public string Id = "";
        /// <summary>Whose bill it is (shown on the phone); money is shared like FHanoiPlayerState.MoneyVnd.</summary>
        public string Character = "";
        public long AmountVnd;
        /// <summary>0 = forever.</summary>
        public int Instalments;
    }
}
