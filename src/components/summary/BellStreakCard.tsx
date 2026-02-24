import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { format, subDays, parseISO } from "date-fns";

interface DailyTotal {
  date: string;
  salesCount: number;
  repProfit: number;
}

function qualifies(d: DailyTotal): boolean {
  return d.salesCount >= 3 && d.repProfit >= 150;
}

function calcStreak(dailyTotals: Map<string, DailyTotal>): number {
  // Walk backwards from yesterday (today may not be complete)
  const today = new Date();
  let streak = 0;

  // Check today first
  const todayStr = format(today, "yyyy-MM-dd");
  const todayData = dailyTotals.get(todayStr);
  if (todayData && qualifies(todayData)) {
    streak = 1;
  }

  // Walk backwards from yesterday
  for (let i = 1; i <= 90; i++) {
    const d = subDays(today, i);
    const dayOfWeek = d.getDay(); // 0 = Sunday
    const dateStr = format(d, "yyyy-MM-dd");
    const data = dailyTotals.get(dateStr);

    if (dayOfWeek === 0) {
      // Sunday: if no data, skip (don't break or continue streak)
      if (!data) continue;
      // If data exists but doesn't qualify, streak breaks
      if (!qualifies(data)) {
        if (streak === 0) continue; // haven't started yet
        break;
      }
      streak++;
    } else {
      if (!data || !qualifies(data)) {
        break;
      }
      streak++;
    }
  }

  return streak;
}

type Tier = "none" | "low" | "mid" | "high" | "elite";

function getTier(streak: number): Tier {
  if (streak <= 0) return "none";
  if (streak <= 2) return "low";
  if (streak <= 6) return "mid";
  if (streak <= 13) return "high";
  return "elite";
}

const TIER_CONFIG: Record<Exclude<Tier, "none">, {
  color: string;
  glowColor: string;
  label: (n: number) => string;
  flameSize: string;
  animClass: string;
}> = {
  low: {
    color: "hsl(25 95% 55%)",
    glowColor: "hsl(25 95% 55% / 0.15)",
    label: (n) => `Bell Streak: ${n} Day${n > 1 ? "s" : ""}`,
    flameSize: "w-8 h-8",
    animClass: "animate-pulse",
  },
  mid: {
    color: "hsl(25 95% 50%)",
    glowColor: "hsl(25 95% 50% / 0.2)",
    label: (n) => `Bell Streak: ${n} Days`,
    flameSize: "w-10 h-10",
    animClass: "animate-[pulse_1.5s_ease-in-out_infinite]",
  },
  high: {
    color: "hsl(210 90% 55%)",
    glowColor: "hsl(210 90% 55% / 0.2)",
    label: (n) => `Bell Streak: ${n} Days`,
    flameSize: "w-12 h-12",
    animClass: "animate-[pulse_2s_ease-in-out_infinite]",
  },
  elite: {
    color: "hsl(270 80% 60%)",
    glowColor: "hsl(270 80% 60% / 0.25)",
    label: (n) => `Elite Bell Streak – ${n} Days`,
    flameSize: "w-14 h-14",
    animClass: "animate-[pulse_2.5s_ease-in-out_infinite]",
  },
};

function FlameIcon({ tier, className }: { tier: Exclude<Tier, "none">; className?: string }) {
  const config = TIER_CONFIG[tier];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${config.flameSize} ${className || ""}`}
      style={{ filter: `drop-shadow(0 0 8px ${config.color})` }}
    >
      <path
        d="M12 2C12 2 4 10 4 15C4 19.4183 7.58172 23 12 23C16.4183 23 20 19.4183 20 15C20 10 12 2 12 2Z"
        fill={config.color}
        opacity="0.9"
      />
      <path
        d="M12 6C12 6 8 12 8 15C8 17.7614 9.79086 20 12 20C14.2091 20 16 17.7614 16 15C16 12 12 6 12 6Z"
        fill="currentColor"
        className="text-background"
        opacity="0.3"
      />
      {tier === "elite" && (
        <>
          <circle cx="10" cy="14" r="0.5" fill="white" opacity="0.6" className="animate-[ping_3s_ease-in-out_infinite]" />
          <circle cx="14" cy="12" r="0.4" fill="white" opacity="0.5" className="animate-[ping_4s_ease-in-out_infinite_0.5s]" />
          <circle cx="12" cy="16" r="0.3" fill="white" opacity="0.4" className="animate-[ping_3.5s_ease-in-out_infinite_1s]" />
        </>
      )}
    </svg>
  );
}

export function BellStreakCard() {
  const { user } = useAuth();
  const [dailyTotals, setDailyTotals] = useState<Map<string, DailyTotal>>(new Map());
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

    supabase
      .from("sales_transactions")
      .select("date, isa_upfront")
      .eq("user_id", user.id)
      .gte("date", ninetyDaysAgo)
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return; }
        const map = new Map<string, DailyTotal>();
        (data || []).forEach((tx) => {
          const existing = map.get(tx.date) || { date: tx.date, salesCount: 0, repProfit: 0 };
          existing.salesCount += 1;
          existing.repProfit += Number(tx.isa_upfront);
          map.set(tx.date, existing);
        });
        setDailyTotals(map);
        setLoading(false);
        // Fade in after data loads
        setTimeout(() => setVisible(true), 50);
      });
  }, [user]);

  const streak = useMemo(() => calcStreak(dailyTotals), [dailyTotals]);
  const tier = getTier(streak);

  if (loading) return null;

  const activeTier = tier === "none" ? "low" : tier;
  const config = tier === "none"
    ? { ...TIER_CONFIG.low, color: "hsl(0 0% 45%)", glowColor: "transparent", label: () => "Bell Streak: 0 Days", animClass: "" }
    : TIER_CONFIG[tier];

  return (
    <Card
      className="border-border/50 bg-card/80 overflow-hidden transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        boxShadow: tier === "none" ? "none" : `0 0 30px -5px ${config.glowColor}`,
      }}
    >
      <CardContent className="py-4 px-5">
        <div className="flex items-center gap-4">
          <div
            className={`relative flex-shrink-0 ${config.animClass}`}
            style={{ transition: "all 0.5s ease", opacity: tier === "none" ? 0.4 : 1 }}
          >
            <FlameIcon tier={activeTier} />
            {/* Glow backdrop */}
            <div
              className="absolute inset-0 rounded-full blur-xl -z-10"
              style={{ background: config.glowColor }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className="text-sm font-bold tracking-tight"
              style={{ color: config.color }}
            >
              {config.label(streak)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              3+ sales &amp; £150+ rep profit per day
            </span>
          </div>
          <div className="ml-auto">
            <div
              className="text-3xl font-black tabular-nums"
              style={{ color: config.color }}
            >
              {streak}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
