import { useState, useMemo, useCallback } from "react";
import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage, StageChange } from "@/lib/types";
import { ChannelConversion } from "./ChannelConversion";
import { CandidateCard } from "./CandidateCard";
import { CandidateDetail } from "./CandidateDetail";
import { PipelineAnalytics, TrendRange } from "./PipelineAnalytics";
import { NewCandidateForm, AddCandidatePayload } from "./NewCandidateForm";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, Clock, Trash2, RotateCcw, AlertTriangle, UserPlus, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PipelineBoardProps {
  trendRange: TrendRange;
  candidates: Candidate[];
  onAddCandidate: (candidate: Omit<Candidate, "id" | "history" | "createdAt">) => Promise<any>;
  onUpdateCandidate: (id: string, updates: Partial<Candidate>, stageChange?: any) => Promise<any>;
  onArchiveCandidate: (id: string) => Promise<void>;
  onDropCandidate: (id: string, reason: string) => Promise<void>;
  onRestoreCandidate: (id: string) => Promise<void>;
  onMoveStage: (candidate: Candidate, direction: "forward" | "backward", movementDate?: string) => Promise<void>;
  loading?: boolean;
  signupDate?: Date;
}

export function PipelineBoard({ trendRange, candidates, onAddCandidate, onUpdateCandidate, onArchiveCandidate, onDropCandidate, onRestoreCandidate, onMoveStage, loading, signupDate }: PipelineBoardProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [dropOffCandidate, setDropOffCandidate] = useState<Candidate | null>(null);
  const [dropOffReason, setDropOffReason] = useState("");
  const [dropping, setDropping] = useState(false);
  const [obDropCandidateId, setObDropCandidateId] = useState<string | null>(null);
  const [obDropName, setObDropName] = useState("");

  const activeCandidates = useMemo(() => candidates.filter(c => c.status !== "Dropped" && c.status !== "dropped" && c.stage !== "prospect"), [candidates]);
  const droppedCandidates = useMemo(() => candidates.filter(c => c.status === "Dropped" || c.status === "dropped"), [candidates]);
  const personalProspects = useMemo(() => candidates.filter(c => c.stage === "prospect" && c.status !== "Dropped" && c.status !== "dropped"), [candidates]);
  const [obTakingId, setObTakingId] = useState<string | null>(null);

  // Stage movement date selector state
  const [pendingMove, setPendingMove] = useState<{ candidate: Candidate; direction: "forward" | "backward" } | null>(null);
  const [movementDate, setMovementDate] = useState<Date>(new Date());
  const [movingStage, setMovingStage] = useState(false);

  const columns = useMemo(() => {
    return STAGES_ORDER.map((stage) => ({
      stage,
      config: STAGE_CONFIG[stage],
      candidates: activeCandidates.filter((c) => c.stage === stage),
    }));
  }, [activeCandidates]);

  const upcomingStarts = useMemo(() => {
    const preStartStages: PipelineStage[] = ["rehash", "contact_before_start"];
    return activeCandidates
      .filter((c) => preStartStages.includes(c.stage))
      .sort((a, b) => {
        if (a.potentialStartDate && b.potentialStartDate) return new Date(a.potentialStartDate).getTime() - new Date(b.potentialStartDate).getTime();
        if (a.potentialStartDate) return -1;
        return 1;
      });
  }, [activeCandidates]);

  const handleUpdate = async (updated: Candidate) => {
    const original = candidates.find((c) => c.id === updated.id);
    let stageChange: StageChange | undefined;
    if (original && original.stage !== updated.stage) {
      stageChange = { from: original.stage, to: updated.stage, date: new Date().toISOString().split("T")[0], note: "Manually updated" };
    }
    await onUpdateCandidate(updated.id, updated, stageChange);
    setSelectedCandidate(updated);
  };

  const handleAdd = async (candidate: AddCandidatePayload) => {
    const { droppedDuringOB, ...candidateData } = candidate;
    const result = await onAddCandidate(candidateData);

    if (droppedDuringOB && result?.data?.id) {
      const newId = result.data.id;
      // Step B: Insert stage history (obs entry)
      await supabase.from("candidate_stage_history").insert({
        candidate_id: newId,
        from_stage: "new",
        to_stage: "obs",
        note: "Dropped during OB",
      });
      // Step C & D: Store ID and open drop-off reason modal
      setObDropCandidateId(newId);
      setObDropName(candidateData.name);
      setDropOffReason("");
    }
  };

  const handleArchive = async (id: string) => {
    await onArchiveCandidate(id);
    setSelectedCandidate(null);
  };

  const handleMoveStage = useCallback(async (candidate: Candidate, direction: "forward" | "backward") => {
    // Show date selector modal instead of moving directly
    setPendingMove({ candidate, direction });
    setMovementDate(new Date());
  }, []);

  const handleConfirmMove = async () => {
    if (!pendingMove) return;
    setMovingStage(true);
    try {
      const dateStr = format(movementDate, "yyyy-MM-dd");
      await onMoveStage(pendingMove.candidate, pendingMove.direction, dateStr);
      toast.success(`Moved ${pendingMove.candidate.name} ${pendingMove.direction}`);
      setPendingMove(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to move candidate");
    } finally {
      setMovingStage(false);
    }
  };

  const handleConfirmDropOff = async () => {
    if (!dropOffCandidate || !dropOffReason.trim()) return;
    setDropping(true);
    try {
      await onDropCandidate(dropOffCandidate.id, dropOffReason.trim());
      toast.success(`${dropOffCandidate.name} dropped from pipeline`);
      setDropOffCandidate(null);
      setDropOffReason("");
    } catch {
      toast.error("Failed to drop candidate");
    } finally {
      setDropping(false);
    }
  };

  const handleRestore = async (candidate: Candidate) => {
    try {
      await onRestoreCandidate(candidate.id);
      toast.success(`${candidate.name} restored to pipeline`);
    } catch {
      toast.error("Failed to restore candidate");
    }
  };

  const handleConfirmObDrop = async () => {
    if (!obDropCandidateId || !dropOffReason.trim()) return;
    setDropping(true);
    try {
      await onDropCandidate(obDropCandidateId, dropOffReason.trim());
      toast.success("OB logged and marked as dropped.");
      setObDropCandidateId(null);
      setObDropName("");
      setDropOffReason("");
    } catch {
      toast.error("Failed to mark candidate as dropped");
    } finally {
      setDropping(false);
    }
  };

  const handleObTaken = async (candidate: Candidate) => {
    setObTakingId(candidate.id);
    try {
      await onUpdateCandidate(candidate.id, { ...candidate, stage: "obs" as PipelineStage }, {
        from: "prospect" as PipelineStage,
        to: "obs" as PipelineStage,
        date: new Date().toISOString().split("T")[0],
        note: "Marked as OB Taken",
      });
      toast.success(`${candidate.name} moved to OBS`);
    } catch {
      toast.error("Failed to move candidate");
    } finally {
      setObTakingId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading pipeline...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end px-1">
        <NewCandidateForm onAdd={handleAdd} />
      </div>

      {/* Drop Off Confirmation Modal */}
      <Dialog open={!!dropOffCandidate} onOpenChange={(open) => { if (!open) { setDropOffCandidate(null); setDropOffReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Drop Off Candidate
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to drop <span className="font-semibold text-foreground">{dropOffCandidate?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="drop-reason">Reason for Drop Off <span className="text-destructive">*</span></Label>
            <Textarea
              id="drop-reason"
              value={dropOffReason}
              onChange={(e) => setDropOffReason(e.target.value)}
              placeholder="Enter reason for dropping this candidate..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDropOffCandidate(null); setDropOffReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!dropOffReason.trim() || dropping}
              onClick={handleConfirmDropOff}
            >
              {dropping ? "Dropping…" : "Confirm Drop Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OB Drop Reason Modal */}
      <Dialog open={!!obDropCandidateId} onOpenChange={(open) => { if (!open) { setObDropCandidateId(null); setObDropName(""); setDropOffReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Drop Off Reason — OB
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{obDropName}</span> will be logged as an OB and moved to Drop Off. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="ob-drop-reason">Reason for Drop Off <span className="text-destructive">*</span></Label>
            <Textarea
              id="ob-drop-reason"
              value={dropOffReason}
              onChange={(e) => setDropOffReason(e.target.value)}
              placeholder="Enter reason for dropping this candidate..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setObDropCandidateId(null); setObDropName(""); setDropOffReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!dropOffReason.trim() || dropping}
              onClick={handleConfirmObDrop}
            >
              {dropping ? "Dropping…" : "Confirm Drop Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Movement Date Selector Modal */}
      <Dialog open={!!pendingMove} onOpenChange={(open) => { if (!open) setPendingMove(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Select Movement Date
            </DialogTitle>
            <DialogDescription>
              Moving <span className="font-semibold text-foreground">{pendingMove?.candidate.name}</span> {pendingMove?.direction} to{" "}
              <span className="font-semibold text-foreground">
                {pendingMove && STAGE_CONFIG[STAGES_ORDER[STAGES_ORDER.indexOf(pendingMove.candidate.stage) + (pendingMove.direction === "forward" ? 1 : -1)]]?.label}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <Calendar
              mode="single"
              selected={movementDate}
              onSelect={(d) => d && setMovementDate(d)}
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{format(movementDate, "do MMMM yyyy")}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>Cancel</Button>
            <Button disabled={movingStage} onClick={handleConfirmMove}>
              {movingStage ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {movingStage ? "Moving…" : "Confirm Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {personalProspects.length > 0 && (
        <div className="md:hidden">
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Potential Personal Recruits</h3>
              <span className="text-[10px] text-muted-foreground font-mono">{personalProspects.length}</span>
            </div>
            <div className="space-y-2">
              {personalProspects.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">Added {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" disabled={obTakingId === c.id} onClick={() => handleObTaken(c)}>
                      {obTakingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      OB Taken
                    </Button>
                    <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Drop off" onClick={() => setDropOffCandidate(c)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE: stacked layout */}
      <div className="md:hidden">
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Upcoming Starts</h3>
            <span className="text-[10px] text-muted-foreground font-mono">{upcomingStarts.length}</span>
          </div>
          <div className="space-y-2">
            {upcomingStarts.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4 opacity-50">No upcoming starts</p>
            )}
            {upcomingStarts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedCandidate(c)}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{STAGE_CONFIG[c.stage].label}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-primary">
                  <CalendarIcon className="w-3 h-3" />
                  {c.potentialStartDate
                    ? new Date(c.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                    : "TBD"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <PipelineAnalytics candidates={candidates} trendRange={trendRange} signupDate={signupDate} />
      </div>

      {/* DESKTOP pipeline board — no drag & drop */}
      <div className="hidden md:flex gap-4 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2 custom-scrollbar">
          {columns.map(({ stage, config, candidates: stageCandidates }) => (
            <div key={stage} className="pipeline-column flex-shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(var(${config.colorVar}))` }} />
                <h3 className="text-xs font-medium text-foreground">{config.label}</h3>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">{stageCandidates.length}</span>
              </div>
              <div className="space-y-0 max-h-[55vh] overflow-y-auto custom-scrollbar">
                {stageCandidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} onClick={setSelectedCandidate} onDropOff={setDropOffCandidate} onMoveStage={handleMoveStage} />
                ))}
                {stageCandidates.length === 0 && (
                  <div className="text-[11px] text-muted-foreground text-center py-6 opacity-50">No candidates</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {selectedCandidate && (
          <div className="flex-shrink-0 w-72">
            <CandidateDetail candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} onUpdate={handleUpdate} onArchive={handleArchive} onDropOff={(c) => { setSelectedCandidate(null); setDropOffCandidate(c); }} />
          </div>
        )}
      </div>

      {/* Mobile pipeline stages */}
      <div className="md:hidden space-y-3 overflow-x-hidden">
        {columns.map(({ stage, config, candidates: stageCandidates }) => (
          <div key={stage} className="glass-panel p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(var(${config.colorVar}))` }} />
              <h3 className="text-xs font-medium text-foreground">{config.label}</h3>
              <span className="text-[10px] text-muted-foreground font-mono ml-auto">{stageCandidates.length}</span>
            </div>
            <div className="space-y-1">
              {stageCandidates.map((candidate) => (
                <CandidateCard key={candidate.id} candidate={candidate} onClick={setSelectedCandidate} onDropOff={setDropOffCandidate} onMoveStage={handleMoveStage} />
              ))}
              {stageCandidates.length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-4 opacity-50">No candidates</div>
              )}
            </div>
          </div>
        ))}
        {selectedCandidate && (
          <CandidateDetail candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} onUpdate={handleUpdate} onArchive={handleArchive} />
        )}
      </div>

      {/* DESKTOP BOTTOM: Funnel + Upcoming Starts + Potential Personal Recruits */}
      <div className="hidden md:flex gap-4">
        <div className="flex-1 min-w-0">
          <PipelineAnalytics candidates={candidates} trendRange={trendRange} signupDate={signupDate} />
        </div>
        <div className="flex-shrink-0 w-72 space-y-4">
          <div className="glass-panel p-4 overflow-y-auto custom-scrollbar max-h-[50vh]">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Upcoming Starts</h3>
              <span className="text-[10px] text-muted-foreground font-mono">{upcomingStarts.length}</span>
            </div>
            <div className="space-y-2">
              {upcomingStarts.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-4 opacity-50">No upcoming starts</p>
              )}
              {upcomingStarts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedCandidate(c)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{STAGE_CONFIG[c.stage].label}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-primary">
                    <CalendarIcon className="w-3 h-3" />
                    {c.potentialStartDate
                      ? new Date(c.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "TBD"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Potential Personal Recruits */}
          {personalProspects.length > 0 && (
            <div className="glass-panel p-4 overflow-y-auto custom-scrollbar max-h-[50vh]">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium text-foreground">Potential Personal Recruits</h3>
                <span className="text-[10px] text-muted-foreground font-mono">{personalProspects.length}</span>
              </div>
              <div className="space-y-2">
                {personalProspects.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">Added {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" disabled={obTakingId === c.id} onClick={() => handleObTaken(c)}>
                        {obTakingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        OB Taken
                      </Button>
                      <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Drop off" onClick={() => setDropOffCandidate(c)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DROP OFF SECTION — always visible */}
      <section className="mt-4">
        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border/50">
          <Trash2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Drop Off</h3>
          <span className="text-[10px] text-muted-foreground font-mono">{droppedCandidates.length}</span>
        </div>
        {droppedCandidates.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 opacity-50">No dropped candidates yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {droppedCandidates.map((c) => (
              <div key={c.id} className="glass-panel p-3 opacity-60 hover:opacity-80 transition-opacity">
                <div className="flex items-start justify-between mb-1.5">
                  <h4 className="font-medium text-sm text-foreground truncate flex-1">{c.name}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                    title="Restore to pipeline"
                    onClick={() => handleRestore(c)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                    {STAGE_CONFIG[c.stage]?.label || c.stage}
                  </Badge>
                  {c.dropOffDate && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.dropOffDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                {c.dropOffReason && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{c.dropOffReason}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lifetime Channel Conversion */}
      <ChannelConversion candidates={candidates} />
    </div>
  );
}
