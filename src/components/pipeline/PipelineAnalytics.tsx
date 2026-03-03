import { useMemo } from "react";
import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage, KPI_TARGETS } from "@/lib/types";
import { Target, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { getCalendarWeekBounds, getLastNWeeksBounds } from "@/lib/utils";

export type TrendRange = "this-week" | "prev-week" | "4-weeks" | "8-weeks" | "12-weeks" | "all";

export const TREND_OPTIONS: { value: TrendRange; label: string; weeks: number }[] = [
  { value: "this-week", label: "This Week", weeks: 0 },
  { value: "prev-week", label: "Previous Week", weeks: 1 },
  { value: "4-weeks", label: "Last 4 Weeks", weeks: 4 },
  { value: "8-weeks", label: "Last 8 Weeks", weeks: 8 },
  { value: "12-weeks", label: "Last 12 Weeks", weeks: 12 },
  { value: "all", label: "All Time", weeks: 0 },
];

const FUNNEL_COLORS: Record<string, string> = {
  obs: "hsl(217 91% 60%)",
  questionnaire: "hsl(200 80% 55%)",
  bottom_line: "hsl(260 70% 60%)",
  final: "hsl(239 84% 67%)",
  rehash: "hsl(320 65% 55%)",
  contact_before_start: "hsl(38 92% 50%)",
  start: "hsl(152 69% 40%)",
  solo: "hsl(45 93% 47%)",
  promoted: "hsl(280 67% 55%)",
};

// Stages used for funnel KPI (excluding promoted which is tracked separately)
const FUNNEL_STAGES = STAGES_ORDER.filter((s) => s !== "promoted");

interface PipelineAnalyticsProps {
  candidates: Candidate[];
  trendRange: TrendRange;
  signupDate?: Date;
}

export function PipelineAnalytics({ candidates, trendRange, signupDate }: PipelineAnalyticsProps) {
  const [collapsed, setCollapsed] = useState(false);

  const dateRange = useMemo(() => {
    if (trendRange === "this-week") {
      return getCalendarWeekBounds(0);
    }
    if (trendRange === "prev-week") {
      return getCalendarWeekBounds(-1);
    }
    if (trendRange === "all") {
      const { end } = getCalendarWeekBounds(0);
      return { start: signupDate ?? new Date(0), end };
    }
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    return getLastNWeeksBounds(option.weeks);
  }, [trendRange, signupDate]);

  // Stage counts using current stage snapshot per candidate (not raw history count)
  // This prevents inflation when candidates move backward and forward
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES_ORDER.forEach((s) => { counts[s] = 0; });

    candidates.forEach((c) => {
      // Skip prospects — they haven't entered the pipeline yet
      if (c.stage === "prospect" && !c.history.some((h) => h.to === "obs")) return;

      // For OBS: count if created within range AND actually reached OBS stage
      const created = new Date(c.createdAt);
      const reachedObs = c.stage !== "prospect" || c.history.some((h) => h.to === "obs");
      if (created >= dateRange.start && created <= dateRange.end && reachedObs) {
        counts["obs"]++;
      }

      // For other stages: determine the latest stage this candidate reached within the date range
      // by walking history chronologically and tracking the final position
      const historyInRange = c.history.filter((h) => {
        const d = parseISO(h.date);
        return d >= dateRange.start && d <= dateRange.end;
      });

      if (historyInRange.length > 0) {
        // The last history entry in range gives us the candidate's final position for this period
        const lastEntry = historyInRange[historyInRange.length - 1];
        const finalStage = lastEntry.to;
        // Count the candidate once at their final stage (not at every intermediate stage)
        if (finalStage !== "obs") {
          counts[finalStage]++;
        }
        // Also count all stages between obs and final stage that were "passed through" 
        // by checking if the candidate's final stage index is >= each stage's index
        const finalIdx = STAGES_ORDER.indexOf(finalStage as PipelineStage);
        for (let si = 1; si < finalIdx; si++) {
          counts[STAGES_ORDER[si]]++;
        }
      }
    });
    return counts;
  }, [candidates, dateRange]);

  const dateRangeLabel = useMemo(() => {
    return `${format(dateRange.start, "do MMM")} – ${format(dateRange.end, "do MMM")}`;
  }, [dateRange]);

  // Funnel data (excluding promoted)
  const funnelData = useMemo(() => {
    const baseCount = stageCounts["obs"];
    return FUNNEL_STAGES.map((stage, i) => {
      const count = stageCounts[stage] || 0;
      const prevCount = i > 0 ? (stageCounts[FUNNEL_STAGES[i - 1]] || 0) : null;
      const stepConversion = prevCount && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
      return {
        stage,
        label: STAGE_CONFIG[stage].label,
        count,
        pct: baseCount > 0 ? Math.round((count / baseCount) * 100) : 0,
        stepConversion,
        color: FUNNEL_COLORS[stage],
      };
    });
  }, [stageCounts]);

  const maxFunnelCount = useMemo(() => Math.max(...funnelData.map((d) => d.count), 1), [funnelData]);

  // OBS override check
  const obsCount = stageCounts["obs"] || 0;
  const isLowObs = obsCount <= 2;

  // Focus area: find the stage transition with the biggest gap vs KPI target
  const focusArea = useMemo(() => {
    if (isLowObs) return { label: "Primary Focus: Increase OBS volume", actual: obsCount, target: 0, isObsOverride: true };

    let worstGap = 0;
    let worstLabel = "";
    let worstActual = 0;
    let worstTarget = 0;

    for (let i = 1; i < FUNNEL_STAGES.length; i++) {
      const from = FUNNEL_STAGES[i - 1];
      const to = FUNNEL_STAGES[i];
      const key = `${from}→${to}`;
      const target = KPI_TARGETS[key];
      if (target === null || target === undefined) continue;

      const prevCount = stageCounts[from] || 0;
      const currCount = stageCounts[to] || 0;
      const actual = prevCount > 0 ? Math.round((currCount / prevCount) * 100) : 0;
      const gap = target - actual;

      if (gap > worstGap) {
        worstGap = gap;
        worstLabel = `${STAGE_CONFIG[from].label} → ${STAGE_CONFIG[to].label}`;
        worstActual = actual;
        worstTarget = target;
      }
    }

    return worstGap > 0 ? { label: worstLabel, actual: worstActual, target: worstTarget, isObsOverride: false } : null;
  }, [stageCounts, isLowObs, obsCount]);


  // Promotion tracking (separate metric using lifetime data)
  const promotionPct = useMemo(() => {
    // Use all candidates regardless of date range for lifetime rolling data
    const startedCount = candidates.filter((c) => {
      const stageIdx = STAGES_ORDER.indexOf(c.stage);
      return stageIdx >= STAGES_ORDER.indexOf("start") || c.history.some((h) => STAGES_ORDER.indexOf(h.to) >= STAGES_ORDER.indexOf("start"));
    }).length;

    const promotedCount = candidates.filter((c) => c.stage === "promoted" || c.history.some((h) => h.to === "promoted")).length;

    return startedCount > 0 ? Math.round((promotedCount / startedCount) * 100) : null;
  }, [candidates]);

  // KPI target labels for funnel display
  const kpiTargetForStep = (i: number): number | null => {
    if (i === 0) return null;
    const from = FUNNEL_STAGES[i - 1];
    const to = FUNNEL_STAGES[i];
    return KPI_TARGETS[`${from}→${to}`] ?? null;
  };

  const kpiGapForStep = (i: number, actualPct: number | null): number | null => {
    const target = kpiTargetForStep(i);
    if (target === null || actualPct === null) return null;
    return target - actualPct;
  };

  return (
    <div className="glass-panel">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Funnel Analytics
          <span className="text-xs font-normal text-muted-foreground">({dateRangeLabel})</span>
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* Funnel Visualisation */}
          <div className="bg-muted/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">Recruitment Funnel</h4>
            <div className="space-y-2">
              {funnelData.map((item, i) => {
                const widthPct = Math.max((item.count / maxFunnelCount) * 100, 8);
                const target = kpiTargetForStep(i);
                const gap = kpiGapForStep(i, item.stepConversion);
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
                    <div className="w-36 shrink-0 text-right">
                      {i === 0 ? (
                        <span className="text-[10px] font-medium text-muted-foreground">baseline</span>
                      ) : item.stepConversion !== null ? (
                        <span className="text-[10px] font-medium">
                          <span className={target !== null && item.stepConversion < target ? "text-destructive" : "text-primary"}>
                            {item.stepConversion}%
                          </span>
                          {target !== null && (
                            <>
                              <span className="text-muted-foreground ml-1">/ {target}%</span>
                              {gap !== null && gap > 0 && (
                                <span className="text-destructive ml-1">(-{gap}%)</span>
                              )}
                            </>
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Promotion tracking - separate */}
            <div className="mt-3 pt-2 border-t border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right">
                  <span className="text-[11px] text-muted-foreground leading-tight">Start → Promoted</span>
                </div>
                <div className="flex-1">
                  <span className="text-[11px] font-medium text-accent-foreground">
                    {promotionPct !== null ? `${promotionPct}%` : "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-1">(lifetime rolling, no target)</span>
                </div>
              </div>
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


          {/* Focus Area */}
          {focusArea && (
            <div className="bg-status-waiting/10 border border-status-waiting/20 rounded-md p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-status-waiting">
                <AlertTriangle className="w-3.5 h-3.5" />
                {focusArea.isObsOverride
                  ? focusArea.label
                  : `Focus Area: Improve ${focusArea.label} conversion (Currently ${focusArea.actual}% vs Target ${focusArea.target}%)`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
