import { useMemo } from "react";
import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { KPITarget } from "@/lib/types";
import { mockKPITargets } from "@/lib/mock-data";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Target, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { format, subWeeks, startOfWeek, endOfWeek } from "date-fns";

export type TrendRange = "this-week" | "prev-week" | "4-weeks" | "8-weeks" | "12-weeks" | "all";

export const TREND_OPTIONS: { value: TrendRange; label: string; weeks: number }[] = [
  { value: "this-week", label: "This Week", weeks: 1 },
  { value: "prev-week", label: "Previous Week", weeks: 2 },
  { value: "4-weeks", label: "Last 4 Weeks", weeks: 4 },
  { value: "8-weeks", label: "Last 8 Weeks", weeks: 8 },
  { value: "12-weeks", label: "Last 12 Weeks", weeks: 12 },
  { value: "all", label: "All Time", weeks: 24 },
];

interface PipelineAnalyticsProps {
  candidates: Candidate[];
  trendRange: TrendRange;
  startEmpty?: boolean;
}

export function PipelineAnalytics({ candidates, trendRange, startEmpty = false }: PipelineAnalyticsProps) {
  const [collapsed, setCollapsed] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
    const thisSaturday = new Date(thisMonday);
    thisSaturday.setDate(thisMonday.getDate() + 5);

    if (trendRange === "this-week") {
      return { start: thisMonday, end: thisSaturday };
    }
    if (trendRange === "prev-week") {
      const prevMonday = subWeeks(thisMonday, 1);
      const prevSaturday = new Date(prevMonday);
      prevSaturday.setDate(prevMonday.getDate() + 5);
      return { start: prevMonday, end: prevSaturday };
    }
    if (trendRange === "all") {
      return { start: new Date(0), end: thisSaturday };
    }
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    const rangeStart = startOfWeek(subWeeks(now, option.weeks), { weekStartsOn: 1 });
    return { start: rangeStart, end: thisSaturday };
  }, [trendRange]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const created = new Date(c.createdAt);
      return created >= dateRange.start && created <= dateRange.end;
    });
  }, [candidates, dateRange]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const stagesNoDropped = STAGES_ORDER.filter((s) => s !== "dropped");
    STAGES_ORDER.forEach((s) => { counts[s] = 0; });
    filteredCandidates.forEach((c) => {
      if (c.stage === "dropped") {
        counts["dropped"]++;
        return;
      }
      // Count this candidate for their current stage and all prior stages in the funnel
      const currentIdx = stagesNoDropped.indexOf(c.stage);
      if (currentIdx >= 0) {
        for (let i = 0; i <= currentIdx; i++) {
          counts[stagesNoDropped[i]]++;
        }
      }
    });
    return counts;
  }, [filteredCandidates]);


  const trendData = useMemo(() => {
    if (startEmpty) {
      const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
      return Array.from({ length: option.weeks }, (_, i) => ({
        week: `W${option.weeks - i}`,
        interviews: 0,
        starts: 0,
        drops: 0,
      })).reverse();
    }
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    const count = option.weeks;
    return Array.from({ length: count }, (_, i) => ({
      week: `W${count - i}`,
      interviews: 5 + Math.floor(Math.random() * 8),
      starts: 1 + Math.floor(Math.random() * 4),
      drops: Math.floor(Math.random() * 3),
    })).reverse();
  }, [trendRange, startEmpty]);

  const kpis = useMemo(() => {
    if (startEmpty) {
      return mockKPITargets.map((kpi) => ({ ...kpi, actual: 0 }));
    }
    return mockKPITargets;
  }, [startEmpty]);

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

    if (trendRange === "this-week") {
      return `${format(thisMonday, "do MMM")} – ${format(thisSaturday, "do MMM")}`;
    }
    if (trendRange === "prev-week") {
      const prevMonday = subWeeks(thisMonday, 1);
      const prevSaturday = new Date(prevMonday);
      prevSaturday.setDate(prevMonday.getDate() + 5);
      return `${format(prevMonday, "do MMM")} – ${format(prevSaturday, "do MMM")}`;
    }
    // Multi-week ranges: from N weeks ago Monday to this Saturday
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    const rangeStart = startOfWeek(subWeeks(now, option.weeks), { weekStartsOn: 1 });
    return `${format(rangeStart, "do MMM")} – ${format(thisSaturday, "do MMM")}`;
  }, [trendRange]);

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
          {/* Stage counts */}
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
            {STAGES_ORDER.map((stage) => {
              const base = stageCounts["2nd-round"];
              const pct = base > 0 && stage !== "2nd-round"
                ? Math.round((stageCounts[stage] / base) * 100)
                : null;
              return (
                <div key={stage} className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-lg font-bold text-foreground">{stageCounts[stage]}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{STAGE_CONFIG[stage].label.split("(")[0].trim()}</div>
                  {pct !== null && (
                    <div className="text-[9px] font-medium text-primary mt-0.5">{pct}%</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Trend chart */}
            <div className="bg-muted/20 rounded-lg p-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Weekly Trends</h4>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={trendData}>
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(222 44% 8%)", border: "1px solid hsl(222 30% 16%)", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(210 40% 96%)" }}
                  />
                  <Line type="monotone" dataKey="interviews" stroke="hsl(172 66% 50%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="starts" stroke="hsl(152 69% 40%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="drops" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* KPI vs Actual + Focus Area */}
            <div className="bg-muted/20 rounded-lg p-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">KPI vs Actual</h4>
              <div className="space-y-1.5 mb-3">
                {kpis.slice(0, 4).map((kpi, i) => (
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
