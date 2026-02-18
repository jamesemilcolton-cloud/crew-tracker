import { useState, useMemo, useCallback } from "react";
import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { CandidateCard } from "./CandidateCard";
import { CandidateDetail } from "./CandidateDetail";
import { PipelineAnalytics, TrendRange } from "./PipelineAnalytics";
import { NewCandidateForm } from "./NewCandidateForm";
import { Calendar, Clock, ChevronDown } from "lucide-react";


interface PipelineBoardProps {
  startEmpty?: boolean;
  trendRange: TrendRange;
  candidates: Candidate[];
  onCandidatesChange: (candidates: Candidate[]) => void;
}

export function PipelineBoard({ startEmpty = false, trendRange, candidates, onCandidatesChange }: PipelineBoardProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(true);

  const columns = useMemo(() => {
    return STAGES_ORDER.map((stage) => ({
      stage,
      config: STAGE_CONFIG[stage],
      candidates: candidates.filter((c) => c.stage === stage),
    }));
  }, [candidates]);

  // Upcoming Starts: all candidates in rehash or sunday-call (regardless of start date)
  const upcomingStarts = useMemo(() => {
    const preStartStages: PipelineStage[] = ["rehash", "sunday-call"];
    return candidates
      .filter((c) => preStartStages.includes(c.stage))
      .sort((a, b) => {
        if (a.potentialStartDate && b.potentialStartDate) return new Date(a.potentialStartDate).getTime() - new Date(b.potentialStartDate).getTime();
        if (a.potentialStartDate) return -1;
        return 1;
      });
  }, [candidates]);

  const handleUpdate = (updated: Candidate) => {
    onCandidatesChange(candidates.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedCandidate(updated);
  };

  const handleAdd = (candidate: Candidate) => {
    onCandidatesChange([...candidates, candidate]);
  };

  const handleDrop = useCallback((targetStage: PipelineStage, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStage(null);
    const candidateId = e.dataTransfer.getData("candidateId");
    if (!candidateId) return;

    onCandidatesChange(candidates.map((c) => {
      if (c.id !== candidateId) return c;
      if (c.stage === targetStage) return c;

      const currentIdx = STAGES_ORDER.indexOf(c.stage);
      const targetIdx = STAGES_ORDER.indexOf(targetStage);
      if (targetIdx <= currentIdx) return c;

      const stageChange = {
        from: c.stage,
        to: targetStage,
        date: new Date().toISOString().split("T")[0],
      };

      const updatedStartDate = (targetStage === "start" && !c.potentialStartDate)
        ? new Date().toISOString().split("T")[0]
        : c.potentialStartDate;

      return {
        ...c,
        stage: targetStage,
        potentialStartDate: targetStage === "start" ? (c.potentialStartDate || new Date().toISOString().split("T")[0]) : updatedStartDate,
        history: [...c.history, stageChange],
      };
    }));
  }, [candidates, onCandidatesChange]);

  const handleDragOver = useCallback((stage: PipelineStage, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end mb-2 px-1">
        <NewCandidateForm onAdd={handleAdd} />
      </div>
      <PipelineAnalytics candidates={candidates} trendRange={trendRange} startEmpty={startEmpty} />

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Pipeline columns */}
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2 custom-scrollbar">
          {columns.map(({ stage, config, candidates: stageCandidates }) => (
            <div
              key={stage}
              className={`pipeline-column flex-shrink-0 transition-all duration-200 ${
                dragOverStage === stage ? "ring-2 ring-primary/50 bg-primary/5" : ""
              }`}
              onDrop={(e) => handleDrop(stage, e)}
              onDragOver={(e) => handleDragOver(stage, e)}
              onDragLeave={handleDragLeave}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: `hsl(var(${config.colorVar}))` }}
                />
                <h3 className="text-xs font-medium text-foreground">{config.label}</h3>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">{stageCandidates.length}</span>
              </div>
              <div className="space-y-0 max-h-[60vh] overflow-y-auto custom-scrollbar">
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

        {/* Right panel — collapses to slim strip */}
        <div className={`flex-shrink-0 transition-all duration-300 ${selectedCandidate ? "w-72" : upcomingOpen ? "w-72" : "w-10"}`}>
          {selectedCandidate ? (
            <CandidateDetail
              candidate={selectedCandidate}
              onClose={() => setSelectedCandidate(null)}
              onUpdate={handleUpdate}
            />
          ) : upcomingOpen ? (
            <div className="glass-panel p-4 overflow-y-auto custom-scrollbar h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium text-foreground">Upcoming Starts</h3>
                  <span className="text-[10px] text-muted-foreground font-mono">{upcomingStarts.length}</span>
                </div>
                <button onClick={() => setUpcomingOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                </button>
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
          ) : (
            <button
              onClick={() => setUpcomingOpen(true)}
              className="glass-panel w-10 h-full flex flex-col items-center pt-3 gap-2 hover:bg-card/90 transition-colors"
              title="Open Upcoming Starts"
            >
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground font-mono">{upcomingStarts.length}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground -rotate-90" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
