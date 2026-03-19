import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Candidate } from "@/lib/types";
import { useCandidates } from "@/hooks/useCandidates";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { LinkedInDashboard } from "@/components/linkedin/LinkedInDashboard";
import { CrewBubbleForecast } from "@/components/crew/CrewBubbleForecast";
import { LinkedInResources } from "@/components/linkedin/LinkedInResources";
import { TrendRange, TREND_OPTIONS } from "@/components/pipeline/PipelineAnalytics";
import { Users, Linkedin, GitBranch, BookOpen, ChevronDown, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "pipeline" | "linkedin" | "crew" | "resources";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "pipeline", label: "Pipeline", icon: <Users className="w-4 h-4" /> },
  { id: "linkedin", label: "LinkedIn & Personal", icon: <Linkedin className="w-4 h-4" /> },
  { id: "crew", label: "Crew Bubble", icon: <GitBranch className="w-4 h-4" /> },
  { id: "resources", label: "LinkedIn Resources", icon: <BookOpen className="w-4 h-4" /> },
];

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");
  const [trendRange, setTrendRange] = useState<TrendRange>("4-weeks");
  const { profile } = useAuth();
  const signupDate = useMemo(() => profile?.created_at ? new Date(profile.created_at) : undefined, [profile?.created_at]);

  const { candidates: ownCandidates, loading: ownLoading, addCandidate, updateCandidate, moveStage, archiveCandidate, dropCandidate, restoreCandidate, refetch: refetchOwn } = useCandidates("own");
  const { candidates: allCandidates, loading: allLoading, refetch: refetchAll } = useCandidates("all");

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
  const handleArchiveCandidate = async (id: string) => {
    await archiveCandidate(id);
    refetchAll();
  };
  const handleDropCandidate = async (id: string, reason: string) => {
    await dropCandidate(id, reason);
    refetchAll();
  };
  const handleRestoreCandidate = async (id: string) => {
    await restoreCandidate(id);
    refetchAll();
  };
  const handleMoveStage = async (candidate: Candidate, direction: "forward" | "backward", movementDate?: string) => {
    await moveStage(candidate, direction, movementDate);
    refetchAll();
  };

  const currentRangeLabel = TREND_OPTIONS.find((o) => o.value === trendRange)?.label;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          {/* DESKTOP header */}
          <div className="hidden md:flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Modules
              </Button>
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Recruitment</h1>
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
              <div className="ml-2">
                <ProfileDropdown />
              </div>
            </div>
          </div>

          {/* MOBILE header */}
          <div className="md:hidden">
            {/* Top bar: back + title */}
            <div className="flex items-center gap-3 h-12">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Recruitment</h1>
              <div className="ml-auto"><ProfileDropdown /></div>
            </div>
            {/* Vertical nav */}
            <nav className="flex flex-col gap-1 pb-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              {/* Time frame selector - full width */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between gap-1.5 text-sm px-3 py-2.5 h-auto">
                    {currentRangeLabel}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover z-50 w-[calc(100vw-2rem)]">
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
            </nav>
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
            onArchiveCandidate={handleArchiveCandidate}
            onDropCandidate={handleDropCandidate}
            onRestoreCandidate={handleRestoreCandidate}
            onMoveStage={handleMoveStage}
            loading={ownLoading}
            signupDate={signupDate}
          />
        )}
        {activeTab === "linkedin" && <LinkedInDashboard trendRange={trendRange} signupDate={signupDate} />}
        {activeTab === "crew" && <CrewBubbleForecast candidates={allLoading ? [] : allCandidates} />}
        
      </main>
    </div>
  );
};

export default Index;
