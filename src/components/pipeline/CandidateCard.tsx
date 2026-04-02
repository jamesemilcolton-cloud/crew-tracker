import { useState } from "react";
import { Candidate, STAGES_ORDER, STAGE_CONFIG, PipelineStage } from "@/lib/types";
import { Calendar, HelpCircle, Trash2, ChevronLeft, ChevronRight, Loader2, Link2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CandidateCardProps {
  candidate: Candidate;
  onClick: (candidate: Candidate) => void;
  onDropOff?: (candidate: Candidate) => void;
  onMoveStage?: (candidate: Candidate, direction: "forward" | "backward") => Promise<void>;
}

const REHASH_FORWARD_STAGES = STAGES_ORDER.slice(STAGES_ORDER.indexOf("rehash"));
const START_FORWARD_STAGES = STAGES_ORDER.slice(STAGES_ORDER.indexOf("start"));

export function CandidateCard({ candidate, onClick, onDropOff, onMoveStage }: CandidateCardProps) {
  const [moving, setMoving] = useState<"forward" | "backward" | null>(null);
  const [pulse, setPulse] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const { user } = useAuth();

  const showAccessIndicators = REHASH_FORWARD_STAGES.includes(candidate.stage);
  const hasStarted = START_FORWARD_STAGES.includes(candidate.stage);

  // Show invite button: stage is start or later, and no account linked yet
  const showInviteButton = hasStarted && !candidate.hasAccountLinked;

  const handleCopyInviteLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generatingInvite || !user) return;
    setGeneratingInvite(true);

    try {
      // Check for existing unused invite token
      const { data: existing } = await supabase
        .from("invite_tokens")
        .select("token")
        .eq("candidate_id", candidate.id)
        .eq("used", false)
        .maybeSingle();

      let tokenValue: string;

      if (existing?.token) {
        tokenValue = existing.token;
      } else {
        // Generate new token
        const { data: newToken, error } = await supabase
          .from("invite_tokens")
          .insert({ candidate_id: candidate.id, created_by: user.id } as any)
          .select("token")
          .single();

        if (error || !newToken) {
          toast.error("Failed to generate invite link");
          setGeneratingInvite(false);
          return;
        }
        tokenValue = (newToken as any).token;
      }

      const inviteUrl = `${window.location.origin}/signup?token=${tokenValue}`;
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy invite link");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const stageIdx = STAGES_ORDER.indexOf(candidate.stage);
  const isFirst = stageIdx === 0;
  const isLast = stageIdx === STAGES_ORDER.length - 1;

  const handleMove = async (e: React.MouseEvent, direction: "forward" | "backward") => {
    e.stopPropagation();
    if (moving || !onMoveStage) return;
    setMoving(direction);
    try {
      await onMoveStage(candidate, direction);
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
    } finally {
      setMoving(null);
    }
  };

  return (
    <div
      className={cn(
        "candidate-card animate-fade-in relative group cursor-pointer transition-all",
        pulse && "ring-2 ring-primary/50 scale-[1.02]"
      )}
      onClick={() => onClick(candidate)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground truncate">{candidate.name}</h4>
          <span className="text-[10px] text-muted-foreground font-mono">{candidate.candidateId}</span>
        </div>
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

      {/* Invite link button */}
      {showInviteButton && (
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 w-full mt-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
            inviteCopied
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          onClick={handleCopyInviteLink}
          disabled={generatingInvite}
        >
          {generatingInvite ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : inviteCopied ? (
            <><Check className="w-3.5 h-3.5" /> Link Copied</>
          ) : (
            <><Link2 className="w-3.5 h-3.5" /> Copy Invite Link</>
          )}
        </button>
      )}

      {/* Stage navigation arrows */}
      {onMoveStage && (
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30">
          {!isFirst ? (
            <button
              className={cn(
                "flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted/50",
                moving && "pointer-events-none opacity-50"
              )}
              title={`Move to ${STAGE_CONFIG[STAGES_ORDER[stageIdx - 1]].label}`}
              disabled={!!moving}
              onClick={(e) => handleMove(e, "backward")}
            >
              {moving === "backward" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Back</span>
            </button>
          ) : (
            <div />
          )}
          {!isLast ? (
            <button
              className={cn(
                "flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted/50",
                moving && "pointer-events-none opacity-50"
              )}
              title={`Move to ${STAGE_CONFIG[STAGES_ORDER[stageIdx + 1]].label}`}
              disabled={!!moving}
              onClick={(e) => handleMove(e, "forward")}
            >
              <span className="hidden sm:inline">Next</span>
              {moving === "forward" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
}
