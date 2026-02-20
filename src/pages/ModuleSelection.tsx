import { useNavigate } from "react-router-dom";
import { Users, DollarSign, Trophy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

const modules = [
  {
    id: "recruitment",
    label: "Recruitment",
    icon: Users,
    path: "/recruitment",
    cssVar: "--module-recruitment",
    hsl: "172 66% 50%",
  },
  {
    id: "sales",
    label: "Sales",
    icon: DollarSign,
    path: "/sales",
    cssVar: "--module-sales",
    hsl: "0 65% 48%",
  },
  {
    id: "leaderboards",
    label: "Leaderboards",
    icon: Trophy,
    path: "/leaderboards",
    cssVar: "--module-leaderboards",
    hsl: "40 80% 50%",
  },
] as const;

export default function ModuleSelection() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h1 className="text-sm font-semibold text-foreground">Mission Control</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{profile?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => navigate(m.path)}
                className="w-full max-w-sm rounded-2xl p-6 flex items-center gap-4 transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: `hsl(${m.hsl} / 0.15)`,
                  border: `1px solid hsl(${m.hsl} / 0.3)`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `hsl(${m.hsl} / 0.25)` }}
                >
                  <Icon className="w-6 h-6" style={{ color: `hsl(${m.hsl})` }} />
                </div>
                <span className="text-lg font-semibold text-foreground">{m.label}</span>
              </button>
            );
          })}
        </main>
      </div>
    );
  }

  // Desktop: pie-chart 3-segment layout
  const size = 420;
  const center = size / 2;
  const radius = size / 2;

  // Build 3 equal arc segments (120° each), rotated so first is at top
  const segmentPaths = modules.map((_, i) => {
    const startAngle = i * 120 - 90; // -90 so first segment starts at top
    const endAngle = startAngle + 120;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = center + radius * Math.cos(toRad(startAngle));
    const y1 = center + radius * Math.sin(toRad(startAngle));
    const x2 = center + radius * Math.cos(toRad(endAngle));
    const y2 = center + radius * Math.sin(toRad(endAngle));
    return `M${center},${center} L${x1},${y1} A${radius},${radius} 0 0,1 ${x2},${y2} Z`;
  });

  // Label positions (centroid of each segment)
  const labelPositions = modules.map((_, i) => {
    const midAngle = i * 120 - 90 + 60;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const lr = radius * 0.55;
    return {
      x: center + lr * Math.cos(toRad(midAngle)),
      y: center + lr * Math.sin(toRad(midAngle)),
    };
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-card/50 backdrop-blur-xl">
        <h1 className="text-sm font-semibold text-foreground tracking-tight">Mission Control</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{profile?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            className="block"
          >
            {modules.map((m, i) => (
              <path
                key={m.id}
                d={segmentPaths[i]}
                fill={`hsl(${m.hsl} / 0.12)`}
                stroke={`hsl(${m.hsl} / 0.35)`}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-300"
                style={{ filter: "none" }}
                onClick={() => navigate(m.path)}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.fill = `hsl(${m.hsl} / 0.22)`;
                  el.style.filter = `drop-shadow(0 0 18px hsl(${m.hsl} / 0.35))`;
                  el.style.transform = "scale(1.02)";
                  el.style.transformOrigin = "center";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.fill = `hsl(${m.hsl} / 0.12)`;
                  el.style.filter = "none";
                  el.style.transform = "scale(1)";
                }}
              />
            ))}
          </svg>

          {/* Labels overlaid on segments */}
          {modules.map((m, i) => {
            const Icon = m.icon;
            const pos = labelPositions[i];
            return (
              <div
                key={m.id}
                className="absolute flex flex-col items-center gap-2 pointer-events-none select-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `hsl(${m.hsl} / 0.25)` }}
                >
                  <Icon className="w-5 h-5" style={{ color: `hsl(${m.hsl})` }} />
                </div>
                <span className="text-sm font-semibold text-foreground">{m.label}</span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
