import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { WeeklySummary } from "@/components/summary/WeeklySummary";
import { ProfileDropdown } from "@/components/ProfileDropdown";

const WeekSummaryPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-11">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Modules
              </Button>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "hsl(150 70% 45% / 0.2)" }}>
                <BarChart3 className="w-3.5 h-3.5" style={{ color: "hsl(150 70% 45%)" }} />
              </div>
              <h1 className="text-xs font-semibold text-foreground tracking-tight">Week Summary</h1>
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 max-w-[1800px] mx-auto w-full px-4 lg:px-6 py-2">
        <WeeklySummary />
      </main>
    </div>
  );
};

export default WeekSummaryPage;
