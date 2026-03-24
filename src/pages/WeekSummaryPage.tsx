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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Modules
              </Button>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(150 70% 45% / 0.2)" }}>
                <BarChart3 className="w-4 h-4" style={{ color: "hsl(150 70% 45%)" }} />
              </div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Week Summary</h1>
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-4">
        <WeeklySummary />
      </main>
    </div>
  );
};

export default WeekSummaryPage;
