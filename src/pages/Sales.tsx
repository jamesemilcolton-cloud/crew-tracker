import { useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Sales() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center gap-3 h-14">
            <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Modules
            </Button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(0 65% 48% / 0.2)" }}>
              <DollarSign className="w-4 h-4" style={{ color: "hsl(0 65% 48%)" }} />
            </div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Sales</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="glass-panel p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "hsl(0 65% 48% / 0.15)" }}>
            <DollarSign className="w-8 h-8" style={{ color: "hsl(0 65% 48%)" }} />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Sales Module</h2>
          <p className="text-sm text-muted-foreground">This module is under construction. Sales tracking and analytics will be available here soon.</p>
        </div>
      </main>
    </div>
  );
}
