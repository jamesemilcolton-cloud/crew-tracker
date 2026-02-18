import { useState } from "react";
import { Candidate, STAGE_CONFIG, PipelineStage } from "@/lib/types";
import { User, Phone, Calendar, Star, TrendingUp, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CandidateCardProps {
  candidate: Candidate;
  onClick: (candidate: Candidate) => void;
}

const statusColors: Record<string, string> = {
  Waiting: "bg-status-waiting/20 text-status-waiting",
  Passed: "bg-status-passed/20 text-status-passed",
  Offered: "bg-status-offered/20 text-status-offered",
  Declined: "bg-status-declined/20 text-status-declined",
};

export function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  return (
    <div className="candidate-card animate-fade-in" onClick={() => onClick(candidate)}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm text-foreground truncate flex-1">{candidate.name}</h4>
        {candidate.closeToPromotion && (
          <Star className="w-3.5 h-3.5 text-stage-bell flex-shrink-0 ml-1" fill="currentColor" />
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <Badge className={`text-[10px] px-1.5 py-0 h-4 ${statusColors[candidate.status] || ""}`}>
          {candidate.status}
        </Badge>
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

      {candidate.hasSalesPitchAccess && (
        <div className="flex items-center gap-1 text-[11px] text-accent-foreground mt-1">
          <TrendingUp className="w-3 h-3" />
          <span>Sales pitch access</span>
        </div>
      )}
    </div>
  );
}
