using System;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.State;

namespace HanoiCity.Systems
{
    /// <summary>
    /// Money by cause and effect (docs/gdd/02 §6, docs/gdd/01 §kinh tế): jobs pay base + per km + tip
    /// and count toward the app's weekly bonus; owned businesses earn income_per_day x (1 + upgrade
    /// bonuses) x day factors (cold days, floods, Trung thu, closed for Tết, a viral video) x quality,
    /// minus upkeep, every game day; three loss months in a row force a sale; monthly bills (rent, money
    /// home, the hospital loan) are charged every BillingPeriodDays and what cannot be paid becomes arrears.
    /// </summary>
    public sealed class EconomySystem
    {
        readonly HanoiWorld world;

        /// <summary>(business, profit of the day after upkeep)</summary>
        public event Action<string, long> BusinessDay;
        public event Action<string> BusinessMustBeSold;
        /// <summary>(activity, bonus)</summary>
        public event Action<string, long> WeeklyBonusPaid;
        /// <summary>(bill, paid, shortfall)</summary>
        public event Action<HanoiBill, long, long> BillCharged;

        public EconomySystem(HanoiWorld world) { this.world = world; }

        public HanoiBusinessRow Business(string id) => world.Content.Get<HanoiBusinessRow>("businesses", HanoiRef.IdOf(id));

        public bool Owns(string id) => world.State.Businesses.ContainsKey(HanoiRef.IdOf(id));

        // ------------------------------------------------------------------ businesses

        public bool CanBuy(string id, out string reason)
        {
            var b = Business(id);
            reason = null;
            if (b == null) { reason = "unknown business"; return false; }
            if (Owns(b.Id)) { reason = "already owned"; return false; }
            if (!world.EvaluateCondition(b.Unlock)) { reason = "locked"; return false; }
            if (world.State.MoneyVnd < b.PriceVnd) { reason = "not enough money"; return false; }
            return true;
        }

        public bool Buy(string id)
        {
            if (!CanBuy(id, out var reason)) { world.Warn($"Cannot buy {id}: {reason}"); return false; }
            var b = Business(id);
            world.SpendMoney(b.PriceVnd);
            world.State.Businesses[b.Id] = new OwnedBusiness();
            world.State.Unlocked.Add("businesses:" + b.Id);
            world.NotifyStateChanged();
            return true;
        }

        public bool BuyUpgrade(string businessId, string upgradeId)
        {
            var b = Business(businessId);
            if (b == null || !world.State.Businesses.TryGetValue(b.Id, out var owned)) return false;
            var u = b.Upgrades.FirstOrDefault(x => x.Id == upgradeId);
            if (u == null || owned.Upgrades.Contains(u.Id) || !world.SpendMoney(u.CostVnd)) return false;
            owned.Upgrades.Add(u.Id);
            world.NotifyStateChanged();
            return true;
        }

        /// <summary>Sang nhượng: the business is sold for SaleShare of its price.</summary>
        public long Sell(string businessId, double saleShare = 0.7)
        {
            var b = Business(businessId);
            if (b == null || !world.State.Businesses.Remove(b.Id)) return 0;
            long paid = (long)Math.Round(b.PriceVnd * saleShare);
            world.AddMoney(paid);
            return paid;
        }

        /// <summary>Latest minigame quality 0-1.2 (cooking score...): scales tomorrow's income.</summary>
        public void SetQuality(string businessId, double quality)
        {
            if (world.State.Businesses.TryGetValue(HanoiRef.IdOf(businessId), out var owned)) owned.Quality = Math.Max(0, Math.Min(1.2, quality));
        }

        public void MakeViral(string businessId)
        {
            if (world.State.Businesses.TryGetValue(HanoiRef.IdOf(businessId), out var owned))
                owned.ViralUntil = world.Clock.Now.AddDays(world.Rules.ViralDays);
        }

        /// <summary>Income multiplier of one business for the current game day (weather, events, viral).</summary>
        public double DayFactor(HanoiBusinessRow b, OwnedBusiness owned)
        {
            var r = world.Rules;
            if (r.ClosedDuringEvents.Any(world.IsWorldEventActive)) return 0;
            double f = 1.0;
            if (b.Kind == HanoiBusinessKind.PhoShop && world.Weather.Condition == HanoiWeather.Cold) f *= r.ColdPhoFactor;
            if (world.IsWorldEventActive("mua_ngap")) f *= r.FloodFactor;
            if (world.IsWorldEventActive("trung_thu")) f *= r.MidAutumnFactor;
            if (owned.ViralUntil.HasValue && world.Clock.Now < owned.ViralUntil.Value) f *= 1.0 + r.ViralIncomeBonus;
            return f * owned.Quality;
        }

        public long DailyProfit(string businessId)
        {
            var b = Business(businessId);
            if (b == null || !world.State.Businesses.TryGetValue(b.Id, out var owned)) return 0;
            double bonus = b.Upgrades.Where(u => owned.Upgrades.Contains(u.Id)).Sum(u => u.IncomeBonus ?? 0);
            long income = (long)Math.Round((b.IncomePerDayVnd ?? 0) * (1.0 + bonus) * DayFactor(b, owned));
            return income - (b.UpkeepPerDayVnd ?? 0);
        }

        // ------------------------------------------------------------------ jobs

        /// <summary>A job of an activity (ride, delivery...) was done. Returns the pay. rating 0-5, tip capped at tip_max_vnd.</summary>
        public long CompleteJob(string activityId, double km, double rating = 5.0, long tipVnd = 0)
        {
            var a = world.Content.Get<HanoiActivityRow>("activities", HanoiRef.IdOf(activityId));
            if (a == null) return 0;
            var p = a.Pay;
            long pay = (p.BaseVnd ?? 0) + (long)Math.Round((p.PerKmVnd ?? 0) * Math.Max(0, km)) + Math.Max(0, Math.Min(tipVnd, p.TipMaxVnd ?? 0));
            world.AddMoney(pay);
            if ((p.WeeklyBonusVnd ?? 0) > 0 && (!(p.Rating ?? false) || rating >= world.Rules.WeeklyBonusMinRating))
            {
                world.State.WeeklyJobs.TryGetValue(a.Id, out var n);
                world.State.WeeklyJobs[a.Id] = n + 1;
            }
            world.Skills.TrainFromActivity(a.Id);
            return pay;
        }

        // ------------------------------------------------------------------ the day boundary

        internal void OnDayChanged(DateTime day)
        {
            var s = world.State;
            foreach (var id in s.Businesses.Keys.ToList())
            {
                long profit = DailyProfit(id);
                var owned = s.Businesses[id];
                long moved = world.AddMoney(profit);
                if (profit < 0 && moved > profit) s.ArrearsVnd += moved - profit;  // could not cover upkeep
                owned.LifetimeProfitVnd += profit;
                owned.LossDays = profit < 0 ? owned.LossDays + 1 : 0;
                BusinessDay?.Invoke(id, profit);
                if (owned.LossDays >= world.Rules.BusinessLossDaysBeforeSale) BusinessMustBeSold?.Invoke(id);
            }

            if (s.WeekStart.Ticks == 0) s.WeekStart = day;
            if ((day - s.WeekStart).TotalDays >= 7)
            {
                foreach (var a in world.Content.All<HanoiActivityRow>("activities"))
                {
                    long bonus = a.Pay.WeeklyBonusVnd ?? 0;
                    if (bonus <= 0) continue;
                    s.WeeklyJobs.TryGetValue(a.Id, out var n);
                    if (n >= (a.Pay.WeeklyBonusMinJobs ?? 1))
                    {
                        world.AddMoney(bonus);
                        WeeklyBonusPaid?.Invoke(a.Id, bonus);
                    }
                }
                s.WeeklyJobs.Clear();
                s.WeekStart = day;
            }

            if (s.LastBillingDay.Ticks == 0) s.LastBillingDay = day;
            if ((day - s.LastBillingDay).TotalDays >= world.Rules.BillingPeriodDays)
            {
                s.LastBillingDay = day;
                foreach (var bill in world.Rules.MonthlyBills) Charge(bill);
            }
        }

        void Charge(HanoiBill bill)
        {
            var s = world.State;
            s.BillsPaid.TryGetValue(bill.Id, out var paidCount);
            if (bill.Instalments > 0 && paidCount >= bill.Instalments) return;
            long due = bill.AmountVnd;
            long paid = Math.Min(due, s.MoneyVnd);
            s.MoneyVnd -= paid;
            s.ArrearsVnd += due - paid;
            s.BillsPaid[bill.Id] = paidCount + 1;
            world.NotifyStateChanged();
            BillCharged?.Invoke(bill, paid, due - paid);
        }
    }
}
