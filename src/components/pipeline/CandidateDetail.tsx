import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { X, Phone, Calendar, Star, TrendingUp, Clock, AlertTriangle, Edit2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface CandidateDetailProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdate: (updated: Candidate) => void;
}

export function CandidateDetail({ candidate, onClose, onUpdate }: CandidateDetailProps) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(candidate.notes);
  const [stage, setStage] = useState(candidate.stage);

  const handleSave = () => {
    onUpdate({
      ...candidate,
      notes,
      stage,
      history: stage !== candidate.stage
        ? [...candidate.history, { from: candidate.stage, to: stage, date: new Date().toISOString().split("T")[0], note: "Manually updated" }]
        : candidate.history,
    });
    setEditing(false);
  };

  return (
    <div className="glass-panel-elevated p-6 animate-slide-in-right h-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">{candidate.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="w-4 h-4" />
          <span>{candidate.phone}</span>
        </div>

        {candidate.potentialStartDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Start: {new Date(candidate.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary/20 text-primary">{STAGE_CONFIG[candidate.stage].label}</Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">{candidate.source}</Badge>
          {candidate.hasSalesPitchAccess && (
            <Badge className="bg-accent text-accent-foreground">
              <TrendingUp className="w-3 h-3 mr-1" />Sales Pitch
            </Badge>
          )}
          {candidate.closeToPromotion && (
            <Badge className="bg-stage-bell/20 text-stage-bell">
              <Star className="w-3 h-3 mr-1" fill="currentColor" />Near Promotion
            </Badge>
          )}
        </div>

        {candidate.dropReason && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              Drop Reason
            </div>
            <p className="text-sm text-destructive/80">{candidate.dropReason}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-foreground">Notes</h4>
            <button onClick={() => editing ? handleSave() : setEditing(true)} className="text-primary hover:text-primary/80 transition-colors">
              {editing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </button>
          </div>
          {editing ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg p-3 text-sm text-foreground resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{candidate.notes}</p>
          )}
        </div>

        {editing && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Move to Stage</h4>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as PipelineStage)}
              className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STAGES_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
        )}

        {editing && (
          <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Save Changes
          </Button>
        )}

        {candidate.history.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">History</h4>
            <div className="space-y-2">
              {candidate.history.map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">{h.date}</span>
                    <span className="text-foreground mx-1">
                      {STAGE_CONFIG[h.from].label} → {STAGE_CONFIG[h.to].label}
                    </span>
                    {h.note && <p className="text-muted-foreground mt-0.5">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
