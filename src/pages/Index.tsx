import { useState, useCallback } from "react";
import { Candidate } from "@/lib/types";
import { useCandidates } from "@/hooks/useCandidates";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { LinkedInDashboard } from "@/components/linkedin/LinkedInDashboard";
import { CrewBubbleForecast } from "@/components/crew/CrewBubbleForecast";
import { WeeklyEmailToggle } from "@/components/settings/WeeklyEmailToggle";
import { Leaderboard } from "@/components/Leaderboard";
import { TrendRange, TREND_OPTIONS } from "@/components/pipeline/PipelineAnalytics";
import { Users, Linkedin, GitBranch, Trophy, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "pipeline" | "linkedin" | "crew" | "leaderboard";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "pipeline", label: "Pipeline", icon: <Users className="w-4 h-4" /> },
  { id: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4" /> },
  { id: "crew", label: "Crew Bubble", icon: <GitBranch className="w-4 h-4" /> },
  { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4 h-4" /> },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");
  const [trendRange, setTrendRange] = useState<TrendRange>("4-weeks");
  const { profile, signOut } = useAuth();

  // Own candidates for pipeline
  const { candidates: ownCandidates, loading: ownLoading, addCandidate, updateCandidate } = useCandidates("own");
  // All candidates for crew bubble
  const { candidates: allCandidates, loading: allLoading, refetch: refetchAll } = useCandidates("all");

  // Wrap pipeline mutations to also refresh crew bubble data
  const handleAddCandidate = async (candidate: Omit<Candidate, "id" | "history" | "createdAt">) => {
    const result = await addCandidate(candidate);
    refetchAll();
    return result;
  };
  const handleUpdateCandidate = async (id: string, updates: Partial<Candidate>, stageChange?: any) => {
    const result = await updateCandidate(id, updates, stageChange);
    refetchAll();
    return result;
  };

  const currentRangeLabel = TREND_OPTIONS.find((o) => o.value === trendRange)?.label;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Mission Control</h1>
            </div>
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    {currentRangeLabel}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  {TREND_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setTrendRange(opt.value)}
                      className={trendRange === opt.value ? "bg-accent" : ""}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-2 ml-2 border-l border-border/50 pl-2">
                <WeeklyEmailToggle />
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-muted-foreground">{profile?.full_name}</span>
                <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-4">
        {activeTab === "pipeline" && (
          <PipelineBoard
            trendRange={trendRange}
            candidates={ownCandidates}
            onAddCandidate={handleAddCandidate}
            onUpdateCandidate={handleUpdateCandidate}
            loading={ownLoading}
          />
        )}
        {activeTab === "linkedin" && <LinkedInDashboard trendRange={trendRange} />}
        {activeTab === "crew" && <CrewBubbleForecast candidates={allLoading ? [] : allCandidates} />}
        {activeTab === "leaderboard" && <Leaderboard />}
      </main>
    </div>
  );
};

export default Index;
