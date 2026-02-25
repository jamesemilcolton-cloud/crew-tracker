import { useMemo } from "react";
import { Candidate, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { BarChart3 } from "lucide-react";

interface ChannelConversionProps {
  candidates: Candidate[];
}

interface ChannelMetrics {
  added: number;
  reachedOB: number;
  reachedStart: number;
  addedToOB: number | null;
  obToStart: number | null;
  addedToStart: number | null;
}

function calcMetrics(candidates: Candidate[]): ChannelMetrics {
  const added = candidates.length;

  // Reached OB = created at obs stage (all candidates start at obs) — so all added count
  // But exclude those who were never actually at obs (shouldn't happen since stage defaults to obs)
  const reachedOB = candidates.filter((c) => {
    // All candidates are created at obs stage, so they all reached OB
    return true;
  }).length;

  const startIdx = STAGES_ORDER.indexOf("start");
  const reachedStart = candidates.filter((c) => {
    const currentIdx = STAGES_ORDER.indexOf(c.stage as PipelineStage);
    if (currentIdx >= startIdx) return true;
    // Check history for ever reaching start or beyond
    return c.history.some((h) => STAGES_ORDER.indexOf(h.to as PipelineStage) >= startIdx);
  }).length;

  return {
    added,
    reachedOB,
    reachedStart,
    addedToOB: added > 0 ? Math.round((reachedOB / added) * 100) : null,
    obToStart: reachedOB > 0 ? Math.round((reachedStart / reachedOB) * 100) : null,
    addedToStart: added > 0 ? Math.round((reachedStart / added) * 100) : null,
  };
}

export function ChannelConversion({ candidates }: ChannelConversionProps) {
  const channels = useMemo(() => {
    const office = candidates.filter((c) => c.source === "Office");
    const linkedin = candidates.filter((c) => c.source === "LinkedIn");
    const personal = candidates.filter((c) => c.source === "Personal");

    return [
      { label: "Office", metrics: calcMetrics(office) },
      { label: "LinkedIn", metrics: calcMetrics(linkedin) },
      { label: "Personal", metrics: calcMetrics(personal) },
    ];
  }, [candidates]);

  return (
    <div className="glass-panel p-4 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Recruitment Channel Effectiveness (Lifetime)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {channels.map(({ label, metrics }) => (
          <div key={label} className="bg-muted/20 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{label}</h4>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Added</span>
                <span className="font-mono font-medium text-foreground">{metrics.added}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Reached OB</span>
                <span className="font-mono font-medium text-foreground">{metrics.reachedOB}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Reached Start</span>
                <span className="font-mono font-medium text-foreground">{metrics.reachedStart}</span>
              </div>
            </div>

            <div className="border-t border-border/30 pt-2 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Added → OB</span>
                <span className="font-mono font-medium text-primary">
                  {metrics.addedToOB !== null ? `${metrics.addedToOB}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">OB → Start</span>
                <span className="font-mono font-medium text-primary">
                  {metrics.obToStart !== null ? `${metrics.obToStart}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Added → Start</span>
                <span className="font-mono font-medium text-primary">
                  {metrics.addedToStart !== null ? `${metrics.addedToStart}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
