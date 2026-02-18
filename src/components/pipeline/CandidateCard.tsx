import { Candidate, STAGES_ORDER } from "@/lib/types";
import { Calendar, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CandidateCardProps {
  candidate: Candidate;
  onClick: (candidate: Candidate) => void;
}

const REHASH_FORWARD_STAGES = STAGES_ORDER.slice(STAGES_ORDER.indexOf("rehash"));

export function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  const showAccessIndicators = REHASH_FORWARD_STAGES.includes(candidate.stage);

  return (
    <div
      className="candidate-card animate-fade-in"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("candidateId", candidate.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onClick(candidate)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm text-foreground truncate flex-1">{candidate.name}</h4>
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
          {candidate.source}
        </Badge>
      </div>

      {/* Potential start date indicator */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>
          {candidate.potentialStartDate
            ? new Date(candidate.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : "Start date ?"}
        </span>
      </div>

      {/* Access indicators - only from rehash forward */}
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
