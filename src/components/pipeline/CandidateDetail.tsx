import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { X, Phone, Calendar, Star, TrendingUp, Clock, Edit2, Save, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface CandidateDetailProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdate: (updated: Candidate) => void;
}

export function CandidateDetail({ candidate, onClose, onUpdate }: CandidateDetailProps) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(candidate.notes);
  const [stage, setStage] = useState(candidate.stage);
  const [status, setStatus] = useState(candidate.status);
  const [potentialStartDate, setPotentialStartDate] = useState(candidate.potentialStartDate);
  const [editingHistoryIdx, setEditingHistoryIdx] = useState<number | null>(null);

  const handleSave = () => {
    const historyUpdate = stage !== candidate.stage
      ? [...candidate.history, { from: candidate.stage, to: stage, date: new Date().toISOString().split("T")[0], note: "Manually updated" }]
      : candidate.history;

    onUpdate({
      ...candidate,
      notes,
      stage,
      status,
      potentialStartDate,
      history: historyUpdate,
    });
    setEditing(false);
  };

  const handleToggleSalesPitch = () => {
    onUpdate({ ...candidate, hasSalesPitchAccess: !candidate.hasSalesPitchAccess });
  };

  const handleToggleEvoApp = () => {
    onUpdate({ ...candidate, hasEvoAppAccess: !candidate.hasEvoAppAccess });
  };

  const handleHistoryDateChange = (idx: number, newDate: Date | undefined) => {
    if (!newDate) return;
    const updatedHistory = [...candidate.history];
    updatedHistory[idx] = { ...updatedHistory[idx], date: newDate.toISOString().split("T")[0] };
    onUpdate({ ...candidate, history: updatedHistory });
    setEditingHistoryIdx(null);
  };

  const handleStartDateChange = (newDate: Date | undefined) => {
    if (!newDate) return;
    const dateStr = newDate.toISOString().split("T")[0];
    setPotentialStartDate(dateStr);
    onUpdate({ ...candidate, potentialStartDate: dateStr });
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

        {/* Editable potential start date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Start: </span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-primary hover:underline text-sm">
                {potentialStartDate
                  ? new Date(potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "Set date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={potentialStartDate ? new Date(potentialStartDate) : undefined}
                onSelect={handleStartDateChange}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary/20 text-primary">{STAGE_CONFIG[candidate.stage].label}</Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">{candidate.source}</Badge>
          {candidate.status && (
            <Badge className={`${
              candidate.status === "Offered" ? "bg-status-offered/20 text-status-offered" :
              candidate.status === "Declined" ? "bg-status-declined/20 text-status-declined" :
              "bg-status-dropped/20 text-status-dropped"
            }`}>
              {candidate.status}
            </Badge>
          )}
          {candidate.closeToPromotion && (
            <Badge className="bg-stage-bell/20 text-stage-bell">
              <Star className="w-3 h-3 mr-1" fill="currentColor" />Near Promotion
            </Badge>
          )}
        </div>

        {/* Rehash confirmations */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Access Confirmations</h4>
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
            <span className="text-sm text-muted-foreground">Sales Pitch Access</span>
            <Switch checked={candidate.hasSalesPitchAccess} onCheckedChange={handleToggleSalesPitch} />
          </div>
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
            <span className="text-sm text-muted-foreground">EVO App Access</span>
            <Switch checked={candidate.hasEvoAppAccess} onCheckedChange={handleToggleEvoApp} />
          </div>
        </div>

        {/* Status selector */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Status</h4>
          <select
            value={candidate.status || ""}
            onChange={(e) => {
              const val = e.target.value as any;
              onUpdate({ ...candidate, status: val || undefined });
            }}
            className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">None</option>
            <option value="Offered">Offered</option>
            <option value="Declined">Declined</option>
            <option value="Dropped">Dropped</option>
          </select>
        </div>

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
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <Popover open={editingHistoryIdx === i} onOpenChange={(open) => setEditingHistoryIdx(open ? i : null)}>
                        <PopoverTrigger asChild>
                          <button className="text-muted-foreground hover:text-primary transition-colors underline decoration-dotted">
                            {h.date}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={new Date(h.date)}
                            onSelect={(d) => handleHistoryDateChange(i, d)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-foreground mx-1">
                        {STAGE_CONFIG[h.from].label} → {STAGE_CONFIG[h.to].label}
                      </span>
                    </div>
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
