import { Candidate, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { Calendar, HelpCircle, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CandidateCardProps {
  candidate: Candidate;
  onClick: (candidate: Candidate) => void;
  onDropOff?: (candidate: Candidate) => void;
  onMoveStage?: (candidate: Candidate, direction: "forward" | "backward") => void;
}

const REHASH_FORWARD_STAGES = STAGES_ORDER.slice(STAGES_ORDER.indexOf("rehash"));
const START_FORWARD_STAGES = STAGES_ORDER.slice(STAGES_ORDER.indexOf("start"));

export function CandidateCard({ candidate, onClick, onDropOff, onMoveStage }: CandidateCardProps) {
  const showAccessIndicators = REHASH_FORWARD_STAGES.includes(candidate.stage);
  const hasStarted = START_FORWARD_STAGES.includes(candidate.stage);

  const stageIdx = STAGES_ORDER.indexOf(candidate.stage);
  const isFirst = stageIdx === 0;
  const isLast = stageIdx === STAGES_ORDER.length - 1;

  return (
    <div
      className="candidate-card animate-fade-in relative group cursor-pointer"
      onClick={() => onClick(candidate)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm text-foreground truncate flex-1">{candidate.name}</h4>
        {onDropOff && (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0 ml-1"
            title="Drop off candidate"
            onClick={(e) => {
              e.stopPropagation();
              onDropOff(candidate);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
          {candidate.source}
        </Badge>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>
          {hasStarted
            ? `Started ${candidate.potentialStartDate ? new Date(candidate.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "today"}`
            : candidate.potentialStartDate
              ? new Date(candidate.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              : "Start date ?"}
        </span>
      </div>

      {showAccessIndicators && (
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-0.5 text-[10px]">
            <HelpCircle className="w-3 h-3 text-muted-foreground" />
            <span className={candidate.hasSalesPitchAccess ? "text-status-passed" : "text-muted-foreground"}>
              Sales Pitch{candidate.hasSalesPitchAccess ? " ✓" : " ?"}
            </span>
          </div>
          <div className="flex items-center gap-0.5 text-[10px]">
            <HelpCircle className="w-3 h-3 text-muted-foreground" />
            <span className={candidate.hasEvoAppAccess ? "text-status-passed" : "text-muted-foreground"}>
              EVO App{candidate.hasEvoAppAccess ? " ✓" : " ?"}
            </span>
          </div>
        </div>
      )}

      {/* Stage navigation arrows */}
      {onMoveStage && (
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30">
          {!isFirst ? (
            <button
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted/50"
              title={`Move to ${STAGES_ORDER[stageIdx - 1]}`}
              onClick={(e) => {
                e.stopPropagation();
                onMoveStage(candidate, "backward");
              }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          ) : (
            <div />
          )}
          {!isLast ? (
            <button
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted/50"
              title={`Move to ${STAGES_ORDER[stageIdx + 1]}`}
              onClick={(e) => {
                e.stopPropagation();
                onMoveStage(candidate, "forward");
              }}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
}
