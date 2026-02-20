import { useState, useMemo, useCallback } from "react";
import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage, StageChange } from "@/lib/types";
import { CandidateCard } from "./CandidateCard";
import { CandidateDetail } from "./CandidateDetail";
import { PipelineAnalytics, TrendRange } from "./PipelineAnalytics";
import { NewCandidateForm } from "./NewCandidateForm";
import { Calendar, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PipelineBoardProps {
  trendRange: TrendRange;
  candidates: Candidate[];
  onAddCandidate: (candidate: Omit<Candidate, "id" | "history" | "createdAt">) => Promise<any>;
  onUpdateCandidate: (id: string, updates: Partial<Candidate>, stageChange?: any) => Promise<any>;
  onArchiveCandidate: (id: string) => Promise<void>;
  loading?: boolean;
  onDataDeleted?: () => void;
}

export function PipelineBoard({ trendRange, candidates, onAddCandidate, onUpdateCandidate, onArchiveCandidate, loading, onDataDeleted }: PipelineBoardProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();

  const columns = useMemo(() => {
    return STAGES_ORDER.map((stage) => ({
      stage,
      config: STAGE_CONFIG[stage],
      candidates: candidates.filter((c) => c.stage === stage),
    }));
  }, [candidates]);

  const upcomingStarts = useMemo(() => {
    const preStartStages: PipelineStage[] = ["offered"];
    return candidates
      .filter((c) => preStartStages.includes(c.stage))
      .sort((a, b) => {
        if (a.potentialStartDate && b.potentialStartDate) return new Date(a.potentialStartDate).getTime() - new Date(b.potentialStartDate).getTime();
        if (a.potentialStartDate) return -1;
        return 1;
      });
  }, [candidates]);

  const handleUpdate = async (updated: Candidate) => {
    const original = candidates.find((c) => c.id === updated.id);
    let stageChange: StageChange | undefined;
    if (original && original.stage !== updated.stage) {
      stageChange = { from: original.stage, to: updated.stage, date: new Date().toISOString().split("T")[0], note: "Manually updated" };
    }
    await onUpdateCandidate(updated.id, updated, stageChange);
    setSelectedCandidate(updated);
  };

  const handleAdd = async (candidate: Omit<Candidate, "id" | "history" | "createdAt">) => {
    await onAddCandidate(candidate);
  };

  const handleArchive = async (id: string) => {
    await onArchiveCandidate(id);
    setSelectedCandidate(null);
  };

  const handleDrop = useCallback(async (targetStage: PipelineStage, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStage(null);
    const candidateId = e.dataTransfer.getData("candidateId");
    if (!candidateId) return;
    const c = candidates.find((c) => c.id === candidateId);
    if (!c || c.stage === targetStage) return;
    const currentIdx = STAGES_ORDER.indexOf(c.stage);
    const targetIdx = STAGES_ORDER.indexOf(targetStage);
    if (targetIdx <= currentIdx) return;
    const stageChange: StageChange = { from: c.stage, to: targetStage, date: new Date().toISOString().split("T")[0] };
    const updatedStartDate = (targetStage === "start" && !c.potentialStartDate) ? new Date().toISOString().split("T")[0] : c.potentialStartDate;
    await onUpdateCandidate(candidateId, {
      stage: targetStage,
      potentialStartDate: targetStage === "start" ? (c.potentialStartDate || new Date().toISOString().split("T")[0]) : updatedStartDate,
    }, stageChange);
  }, [candidates, onUpdateCandidate]);

  const handleDragOver = useCallback((stage: PipelineStage, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverStage(null); }, []);

  const handleDeleteAllData = async () => {
    if (!user || deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      // Delete in order: stage history, candidates, linkedin activity, ad uploads (cv_downloads depend on ad_uploads), cv_downloads
      const { data: myAds } = await supabase.from("ad_uploads").select("id").eq("user_id", user.id);
      const adIds = (myAds ?? []).map(a => a.id);
      if (adIds.length > 0) {
        await supabase.from("cv_downloads").delete().in("ad_upload_id", adIds);
      }
      await supabase.from("cv_downloads").delete().eq("user_id", user.id);

      const { data: myCandidates } = await supabase.from("candidates").select("id").eq("user_id", user.id);
      const candidateIds = (myCandidates ?? []).map(c => c.id);
      if (candidateIds.length > 0) {
        await supabase.from("candidate_stage_history").delete().in("candidate_id", candidateIds);
      }
      await supabase.from("candidates").delete().eq("user_id", user.id);
      await supabase.from("linkedin_activity").delete().eq("user_id", user.id);
      await supabase.from("ad_uploads").delete().eq("user_id", user.id);

      toast.success("All your data has been deleted.");
      setDeleteOpen(false);
      setDeleteConfirm("");
      onDataDeleted?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete data.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading pipeline...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirm(""); }}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <Trash2 className="w-4 h-4" />
              Delete All My Data
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete All My Data</DialogTitle>
              <DialogDescription>
                This will permanently delete all your candidates, LinkedIn logs, crew members, and activity history. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm:</p>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteConfirm !== "DELETE" || deleting}
                onClick={handleDeleteAllData}
              >
                {deleting ? "Deleting…" : "Permanently Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <NewCandidateForm onAdd={handleAdd} />
      </div>

      {/* TOP SECTION: Pipeline Board */}
      <div className="flex gap-4 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2 custom-scrollbar">
          {columns.map(({ stage, config, candidates: stageCandidates }) => (
            <div
              key={stage}
              className={`pipeline-column flex-shrink-0 transition-all duration-200 ${dragOverStage === stage ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
              onDrop={(e) => handleDrop(stage, e)}
              onDragOver={(e) => handleDragOver(stage, e)}
              onDragLeave={handleDragLeave}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(var(${config.colorVar}))` }} />
                <h3 className="text-xs font-medium text-foreground">{config.label}</h3>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">{stageCandidates.length}</span>
              </div>
              <div className="space-y-0 max-h-[55vh] overflow-y-auto custom-scrollbar">
                {stageCandidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} onClick={setSelectedCandidate} />
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
            <CandidateDetail candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} onUpdate={handleUpdate} onArchive={handleArchive} />
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: Funnel Chart + Upcoming Starts side by side */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <PipelineAnalytics candidates={candidates} trendRange={trendRange} />
        </div>
        <div className="flex-shrink-0 w-72">
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
                    <Calendar className="w-3 h-3" />
                    {c.potentialStartDate
                      ? new Date(c.potentialStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "TBD"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}