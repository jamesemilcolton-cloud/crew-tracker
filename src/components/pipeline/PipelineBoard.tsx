import { useState, useMemo } from "react";
import { Candidate, STAGE_CONFIG, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { mockCandidates } from "@/lib/mock-data";
import { CandidateCard } from "./CandidateCard";
import { CandidateDetail } from "./CandidateDetail";
import { PipelineAnalytics } from "./PipelineAnalytics";
import { NewCandidateForm } from "./NewCandidateForm";
import { Calendar, Clock } from "lucide-react";

export function PipelineBoard() {
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const columns = useMemo(() => {
    return STAGES_ORDER.map((stage) => ({
      stage,
      config: STAGE_CONFIG[stage],
      candidates: candidates.filter((c) => c.stage === stage),
    }));
  }, [candidates]);

  const upcomingStarts = useMemo(() => {
    return candidates
      .filter((c) => c.potentialStartDate && c.stage !== "dropped")
      .sort((a, b) => new Date(a.potentialStartDate!).getTime() - new Date(b.potentialStartDate!).getTime())
      .slice(0, 6);
  }, [candidates]);

  const handleUpdate = (updated: Candidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedCandidate(updated);
  };

  const handleAdd = (candidate: Candidate) => {
    setCandidates((prev) => [...prev, candidate]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <div />
        <NewCandidateForm onAdd={handleAdd} />
      </div>
      <PipelineAnalytics candidates={candidates} />

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Pipeline columns */}
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2 custom-scrollbar">
          {columns.map(({ stage, config, candidates: stageCandidates }) => (
            <div key={stage} className="pipeline-column flex-shrink-0">
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

        {/* Right panel: Upcoming Starts or Candidate Detail */}
        <div className="w-72 flex-shrink-0">
          {selectedCandidate ? (
            <CandidateDetail
              candidate={selectedCandidate}
              onClose={() => setSelectedCandidate(null)}
              onUpdate={handleUpdate}
            />
          ) : (
            <div className="glass-panel p-4 h-full overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium text-foreground">Upcoming Starts</h3>
              </div>
              <div className="space-y-2">
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
                      {new Date(c.potentialStartDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
