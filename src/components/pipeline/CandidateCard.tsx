import { Candidate, STAGES_ORDER } from "@/lib/types";
import { Calendar, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CandidateCardProps {
  candidate: Candidate;
  onClick: (candidate: Candidate) => void;
}

const OFFERED_FORWARD_STAGES = STAGES_ORDER.slice(STAGES_ORDER.indexOf("contact_before_start"));
const START_FORWARD_STAGES = STAGES_ORDER.slice(STAGES_ORDER.indexOf("start"));

export function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  const showAccessIndicators = OFFERED_FORWARD_STAGES.includes(candidate.stage);
  const hasStarted = START_FORWARD_STAGES.includes(candidate.stage);
  let isDragging = false;

  return (
    <div
      className="candidate-card animate-fade-in cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        isDragging = true;
        e.dataTransfer.setData("candidateId", candidate.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        setTimeout(() => { isDragging = false; }, 0);
      }}
      onClick={(e) => {
        if (isDragging) {
          e.preventDefault();
          return;
        }
        onClick(candidate);
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm text-foreground truncate flex-1">{candidate.name}</h4>
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
    </div>
  );
}
