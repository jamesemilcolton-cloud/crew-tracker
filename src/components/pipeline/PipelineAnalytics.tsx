import { useMemo } from "react";
import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { KPITarget } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Target, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { format, subWeeks, startOfWeek, isWithinInterval, parseISO } from "date-fns";

export type TrendRange = "this-week" | "prev-week" | "4-weeks" | "8-weeks" | "12-weeks" | "all";

export const TREND_OPTIONS: { value: TrendRange; label: string; weeks: number }[] = [
  { value: "this-week", label: "This Week", weeks: 1 },
  { value: "prev-week", label: "Previous Week", weeks: 2 },
  { value: "4-weeks", label: "Last 4 Weeks", weeks: 4 },
  { value: "8-weeks", label: "Last 8 Weeks", weeks: 8 },
  { value: "12-weeks", label: "Last 12 Weeks", weeks: 12 },
  { value: "all", label: "All Time", weeks: 24 },
];

const FUNNEL_STAGES: PipelineStage[] = [
  "2nd-round",
  "final-round",
  "rehash",
  "sunday-call",
  "start",
  "bell",
  "promoted",
];

const FUNNEL_COLORS: Record<string, string> = {
  "2nd-round": "hsl(217 91% 60%)",
  "final-round": "hsl(239 84% 67%)",
  "rehash": "hsl(38 92% 50%)",
  "sunday-call": "hsl(25 95% 53%)",
  "start": "hsl(152 69% 40%)",
  "bell": "hsl(45 93% 47%)",
  "promoted": "hsl(280 67% 55%)",
};

interface PipelineAnalyticsProps {
  candidates: Candidate[];
  trendRange: TrendRange;
}

export function PipelineAnalytics({ candidates, trendRange }: PipelineAnalyticsProps) {
  const [collapsed, setCollapsed] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
    const thisSaturday = new Date(thisMonday);
    thisSaturday.setDate(thisMonday.getDate() + 5);

    if (trendRange === "this-week") return { start: thisMonday, end: thisSaturday };
    if (trendRange === "prev-week") {
      const prevMonday = subWeeks(thisMonday, 1);
      const prevSaturday = new Date(prevMonday);
      prevSaturday.setDate(prevMonday.getDate() + 5);
      return { start: prevMonday, end: prevSaturday };
    }
    if (trendRange === "all") return { start: new Date(0), end: thisSaturday };
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    const rangeStart = startOfWeek(subWeeks(now, option.weeks), { weekStartsOn: 1 });
    return { start: rangeStart, end: thisSaturday };
  }, [trendRange]);

  // History-driven stage counts: count how many candidates passed through each stage within date range
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES_ORDER.forEach((s) => { counts[s] = 0; });

    candidates.forEach((c) => {
      const created = new Date(c.createdAt);
      if (created >= dateRange.start && created <= dateRange.end) {
        counts["2nd-round"]++;
      }
      c.history.forEach((h) => {
        const d = parseISO(h.date);
        if (d >= dateRange.start && d <= dateRange.end) {
          counts[h.to]++;
        }
      });
    });
    return counts;
  }, [candidates, dateRange]);

  // Weekly trend data from actual history
  const trendData = useMemo(() => {
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    const count = option.weeks;
    const now = new Date();
    const thisMonday = startOfWeek(now, { weekStartsOn: 1 });

    return Array.from({ length: count }, (_, i) => {
      const weekStart = subWeeks(thisMonday, count - 1 - i);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      let interviews = 0;
      let starts = 0;
      let promotions = 0;

      candidates.forEach((c) => {
        const created = new Date(c.createdAt);
        if (isWithinInterval(created, { start: weekStart, end: weekEnd })) {
          interviews++;
        }
        c.history.forEach((h) => {
          const d = parseISO(h.date);
          if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
            if (h.to === "start") starts++;
            if (h.to === "promoted") promotions++;
          }
        });
      });

      return {
        week: `W${format(weekStart, "w")}`,
        interviews,
        starts,
        promotions,
      };
    });
  }, [candidates, trendRange]);

  // History-driven KPIs
  const kpis = useMemo((): KPITarget[] => {
    const interviewsInRange = candidates.filter((c) => {
      const d = new Date(c.createdAt);
      return d >= dateRange.start && d <= dateRange.end;
    }).length;

    let startsInRange = 0;
    let promotionsInRange = 0;
    let offersInRange = 0;

    candidates.forEach((c) => {
      c.history.forEach((h) => {
        const d = parseISO(h.date);
        if (d >= dateRange.start && d <= dateRange.end) {
          if (h.to === "start") startsInRange++;
          if (h.to === "promoted") promotionsInRange++;
        }
      });
      if (c.status === "Offered") {
        offersInRange++;
      }
    });

    return [
      { label: "2nd Round Interviews", target: 10, actual: interviewsInRange },
      { label: "Starts", target: 6, actual: startsInRange },
      { label: "Offers Made", target: 8, actual: offersInRange },
      { label: "Promotions", target: 2, actual: promotionsInRange },
    ];
  }, [candidates, dateRange]);

  const worstGap = useMemo(() => {
    return kpis.reduce((worst, kpi) => {
      const gap = kpi.target - kpi.actual;
      return gap > (worst.target - worst.actual) ? kpi : worst;
    }, kpis[0]);
  }, [kpis]);

  const dateRangeLabel = useMemo(() => {
    const now = new Date();
    const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
    const thisSaturday = new Date(thisMonday);
    thisSaturday.setDate(thisMonday.getDate() + 5);

    if (trendRange === "this-week") return `${format(thisMonday, "do MMM")} – ${format(thisSaturday, "do MMM")}`;
    if (trendRange === "prev-week") {
      const prevMonday = subWeeks(thisMonday, 1);
      const prevSaturday = new Date(prevMonday);
      prevSaturday.setDate(prevMonday.getDate() + 5);
      return `${format(prevMonday, "do MMM")} – ${format(prevSaturday, "do MMM")}`;
    }
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    const rangeStart = startOfWeek(subWeeks(now, option.weeks), { weekStartsOn: 1 });
    return `${format(rangeStart, "do MMM")} – ${format(thisSaturday, "do MMM")}`;
  }, [trendRange]);

  // Funnel data for visualization
  const funnelData = useMemo(() => {
    const baseCount = stageCounts["2nd-round"];
    return FUNNEL_STAGES.map((stage) => {
      const count = stageCounts[stage] || 0;
      const pct = baseCount > 0 ? Math.round((count / baseCount) * 100) : 0;
      return {
        stage,
        label: STAGE_CONFIG[stage].label.split("(")[0].trim(),
        count,
        pct,
        color: FUNNEL_COLORS[stage],
      };
    });
  }, [stageCounts]);

  const maxFunnelCount = useMemo(() => Math.max(...funnelData.map((d) => d.count), 1), [funnelData]);

  return (
    <div className="glass-panel mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Pipeline Analytics
          <span className="text-xs font-normal text-muted-foreground">({dateRangeLabel})</span>
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* Funnel Visualisation */}
          <div className="bg-muted/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">Recruitment Funnel</h4>
            <div className="space-y-2">
              {funnelData.map((item, i) => {
                const widthPct = Math.max((item.count / maxFunnelCount) * 100, 8);
                const prevCount = i > 0 ? funnelData[i - 1].count : null;
                const stepConversion = prevCount && prevCount > 0 ? Math.round((item.count / prevCount) * 100) : null;
                return (
                  <div key={item.stage} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-right">
                      <span className="text-[11px] text-muted-foreground leading-tight">{item.label}</span>
                    </div>
                    <div className="flex-1 relative">
                      <div
                        className="h-7 rounded-md flex items-center px-2.5 transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: item.color,
                          opacity: 0.85,
                          minWidth: "40px",
                        }}
                      >
                        <span className="text-xs font-bold text-background whitespace-nowrap">{item.count}</span>
                      </div>
                    </div>
                    <div className="w-16 shrink-0 text-right">
                      {i === 0 ? (
                        <span className="text-[10px] font-medium text-muted-foreground">baseline</span>
                      ) : stepConversion !== null ? (
                        <span className="text-[10px] font-medium text-primary">{stepConversion}%</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {funnelData[0].count > 0 && (
              <div className="mt-3 pt-2 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span>Overall: {funnelData[0].count} → {funnelData[funnelData.length - 1].count}</span>
                <span className="text-primary font-medium">
                  {Math.round((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100)}% end-to-end
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Trend chart */}
            <div className="bg-muted/20 rounded-lg p-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Weekly Trends (from history)</h4>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={trendData}>
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(222 44% 8%)", border: "1px solid hsl(222 30% 16%)", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(210 40% 96%)" }}
                  />
                  <Line type="monotone" dataKey="interviews" stroke="hsl(172 66% 50%)" strokeWidth={2} dot={false} name="Interviews" />
                  <Line type="monotone" dataKey="starts" stroke="hsl(152 69% 40%)" strokeWidth={2} dot={false} name="Starts" />
                  <Line type="monotone" dataKey="promotions" stroke="hsl(280 67% 55%)" strokeWidth={2} dot={false} name="Promotions" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* KPI vs Actual */}
            <div className="bg-muted/20 rounded-lg p-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">KPI vs Actual</h4>
              <div className="space-y-1.5 mb-3">
                {kpis.map((kpi, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{kpi.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-foreground">{kpi.actual}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="font-mono text-muted-foreground">{kpi.target}</span>
                      {kpi.actual >= kpi.target ? (
                        <TrendingUp className="w-3 h-3 text-status-passed" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-status-declined" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-status-waiting/10 border border-status-waiting/20 rounded-md p-2">
                <div className="flex items-center gap-1 text-[10px] font-medium text-status-waiting mb-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  Focus Area
                </div>
                <p className="text-[11px] text-muted-foreground">{worstGap.label}: {worstGap.actual}/{worstGap.target}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
