import { useState } from "react";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { LinkedInDashboard } from "@/components/linkedin/LinkedInDashboard";
import { CrewBubbleForecast } from "@/components/crew/CrewBubbleForecast";
import { Users, Linkedin, GitBranch } from "lucide-react";

type Tab = "pipeline" | "linkedin" | "crew";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "pipeline", label: "Recruitment Pipeline", icon: <Users className="w-4 h-4" /> },
  { id: "linkedin", label: "LinkedIn Dashboard", icon: <Linkedin className="w-4 h-4" /> },
  { id: "crew", label: "Crew Bubble", icon: <GitBranch className="w-4 h-4" /> },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">RecruitOps</h1>
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
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-4">
        {activeTab === "pipeline" && <PipelineBoard />}
        {activeTab === "linkedin" && <LinkedInDashboard />}
        {activeTab === "crew" && <CrewBubbleForecast />}
      </main>
    </div>
  );
};

export default Index;
