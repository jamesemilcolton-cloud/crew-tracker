import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LinkedInDashboard } from "@/components/linkedin/LinkedInDashboard";
import { LinkedInResources } from "@/components/linkedin/LinkedInResources";
import { LinkedInOutreach } from "@/components/linkedin/LinkedInOutreach";
import { TrendRange, TREND_OPTIONS } from "@/components/pipeline/PipelineAnalytics";
import { Linkedin, BookOpen, ChevronDown, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "linkedin" | "resources";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "linkedin", label: "LinkedIn & Personal", icon: <Linkedin className="w-4 h-4" /> },
  { id: "resources", label: "LinkedIn Resources", icon: <BookOpen className="w-4 h-4" /> },
];

const LinkedInPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("linkedin");
  const [trendRange, setTrendRange] = useState<TrendRange>("4-weeks");
  const { profile } = useAuth();
  const signupDate = useMemo(() => profile?.created_at ? new Date(profile.created_at) : undefined, [profile?.created_at]);

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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(210 70% 50% / 0.2)" }}>
                <Linkedin className="w-4 h-4" style={{ color: "hsl(210 70% 50%)" }} />
              </div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">LinkedIn</h1>
            </div>
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                  style={activeTab === tab.id ? { background: "hsl(210 70% 50% / 0.1)", color: "hsl(210 70% 50%)" } : {}}
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
            <div className="flex items-center gap-3 h-12">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "hsl(210 70% 50% / 0.2)" }}>
                <Linkedin className="w-3.5 h-3.5" style={{ color: "hsl(210 70% 50%)" }} />
              </div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">LinkedIn</h1>
              <div className="ml-auto"><ProfileDropdown /></div>
            </div>
            <nav className="flex flex-col gap-1 pb-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                  style={activeTab === tab.id ? { background: "hsl(210 70% 50% / 0.1)", color: "hsl(210 70% 50%)" } : {}}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
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
        {activeTab === "linkedin" && <LinkedInDashboard trendRange={trendRange} signupDate={signupDate} />}
        {activeTab === "resources" && <LinkedInResources />}
      </main>
    </div>
  );
};

export default LinkedInPage;
