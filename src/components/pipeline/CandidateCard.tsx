import { Candidate, STAGE_CONFIG, PipelineStage } from "@/lib/types";
import { Star, Calendar, TrendingUp, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CandidateCardProps {
  candidate: Candidate;
  onClick: (candidate: Candidate) => void;
}

const statusColors: Record<string, string> = {
  Offered: "bg-status-offered/20 text-status-offered",
  Declined: "bg-status-declined/20 text-status-declined",
  Dropped: "bg-status-dropped/20 text-status-dropped",
};

export function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  const isRehash = candidate.stage === "rehash";

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
        {candidate.closeToPromotion && (
          <Star className="w-3.5 h-3.5 text-stage-bell flex-shrink-0 ml-1" fill="currentColor" />
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {candidate.status && (
          <Badge className={`text-[10px] px-1.5 py-0 h-4 ${statusColors[candidate.status] || ""}`}>
            {candidate.status}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
          {candidate.source}
        </Badge>
      </div>

      {candidate.potentialStartDate && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>{new Date(candidate.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        </div>
      )}

      {/* Rehash stage indicators */}
      {isRehash && (
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

      {candidate.hasSalesPitchAccess && !isRehash && (
        <div className="flex items-center gap-1 text-[11px] text-accent-foreground mt-1">
          <TrendingUp className="w-3 h-3" />
          <span>Sales pitch access</span>
        </div>
      )}
    </div>
  );
}
