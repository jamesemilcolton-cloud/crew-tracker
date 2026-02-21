import { useNavigate } from "react-router-dom";
import { Users, DollarSign, Trophy, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useRef, useState } from "react";

const modules = [
  {
    id: "recruitment",
    label: "RECRUITMENT",
    subtitle: "Pipeline & Forecast",
    icon: Users,
    path: "/recruitment",
    hsl: "172 66% 50%",
    hslDark: "172 66% 38%",
  },
  {
    id: "sales",
    label: "SALES",
    subtitle: "Daily Performance",
    icon: DollarSign,
    path: "/sales",
    hsl: "0 65% 42%",
    hslDark: "0 65% 32%",
  },
  {
    id: "leaderboards",
    label: "LEADERBOARDS",
    subtitle: "Rankings & Results",
    icon: Trophy,
    path: "/leaderboards",
    hsl: "36 75% 48%",
    hslDark: "36 75% 36%",
  },
] as const;

const managerModule = {
  id: "manager",
  label: "MANAGER",
  subtitle: "User Management",
  icon: Shield,
  path: "/manager",
  hsl: "270 60% 50%",
  hslDark: "270 60% 38%",
};

// Particle system
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = [
      "180,180,180",
      "180,180,180",
      "180,180,180",
      "94,234,212",
      "205,92,92",
      "218,165,72",
    ];

    type Particle = { x: number; y: number; vx: number; vy: number; size: number; opacity: number; maxOpacity: number; color: string; phase: number; phaseSpeed: number };
    const particles: Particle[] = [];
    const count = 60;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: 0,
        maxOpacity: Math.random() * 0.07 + 0.03,
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.005 + 0.002,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.phaseSpeed;
        p.opacity = p.maxOpacity * ((Math.sin(p.phase) + 1) / 2);

        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        if (p.y < -10) p.y = window.innerHeight + 10;
        if (p.y > window.innerHeight + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

export default function ModuleSelection() {
  const navigate = useNavigate();
  const { profile, userRole, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState<string | null>(null);

  const isManager = userRole?.role === "manager" && userRole?.super_admin;

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative">
        <ParticleCanvas />
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 relative z-10">
          <h1 className="text-sm font-semibold text-foreground tracking-widest uppercase">Mission Control</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{profile?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 relative z-10">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => navigate(m.path)}
                className="w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, hsl(${m.hsl} / 0.18), hsl(${m.hslDark} / 0.10))`,
                  border: `1px solid hsl(${m.hsl} / 0.25)`,
                }}
              >
                <Icon className="w-7 h-7" style={{ color: `hsl(${m.hsl})` }} />
                <span className="text-base font-bold tracking-[0.2em] text-foreground">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.subtitle}</span>
              </button>
            );
          })}
          {isManager && (
            <button
              onClick={() => navigate(managerModule.path)}
              className="w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-300 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, hsl(${managerModule.hsl} / 0.18), hsl(${managerModule.hslDark} / 0.10))`,
                border: `1px solid hsl(${managerModule.hsl} / 0.25)`,
              }}
            >
              <Shield className="w-7 h-7" style={{ color: `hsl(${managerModule.hsl})` }} />
              <span className="text-base font-bold tracking-[0.2em] text-foreground">{managerModule.label}</span>
              <span className="text-xs text-muted-foreground">{managerModule.subtitle}</span>
            </button>
          )}
        </main>
      </div>
    );
  }

  // Desktop: segmented ring layout
  const size = 520;
  const center = size / 2;
  const outerR = size / 2;
  const innerR = outerR * 0.38;
  const gap = 1.2;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const segmentPaths = modules.map((_, i) => {
    const startAngle = i * 120 - 90 + gap / 2;
    const endAngle = startAngle + 120 - gap;
    const ox1 = center + outerR * Math.cos(toRad(startAngle));
    const oy1 = center + outerR * Math.sin(toRad(startAngle));
    const ox2 = center + outerR * Math.cos(toRad(endAngle));
    const oy2 = center + outerR * Math.sin(toRad(endAngle));
    const ix1 = center + innerR * Math.cos(toRad(endAngle));
    const iy1 = center + innerR * Math.sin(toRad(endAngle));
    const ix2 = center + innerR * Math.cos(toRad(startAngle));
    const iy2 = center + innerR * Math.sin(toRad(startAngle));
    return `M${ox1},${oy1} A${outerR},${outerR} 0 0,1 ${ox2},${oy2} L${ix1},${iy1} A${innerR},${innerR} 0 0,0 ${ix2},${iy2} Z`;
  });

  const labelPositions = modules.map((_, i) => {
    const midAngle = i * 120 - 90 + 60;
    const lr = (outerR + innerR) / 2;
    return {
      x: center + lr * Math.cos(toRad(midAngle)),
      y: center + lr * Math.sin(toRad(midAngle)),
    };
  });

  // Manager circle radius - fits inside the inner ring
  const managerR = innerR * 0.72;
  const isManagerHovered = hovered === "manager";

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <ParticleCanvas />

      <header className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-card/30 backdrop-blur-xl relative z-10">
        <h1 className="text-sm font-semibold text-foreground tracking-[0.25em] uppercase">Mission Control</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{profile?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center relative z-10">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            className="block"
          >
            <defs>
              {modules.map((m, i) => {
                const midAngle = i * 120 - 90 + 60;
                const gx1 = center + innerR * Math.cos(toRad(midAngle));
                const gy1 = center + innerR * Math.sin(toRad(midAngle));
                const gx2 = center + outerR * Math.cos(toRad(midAngle));
                const gy2 = center + outerR * Math.sin(toRad(midAngle));
                return (
                  <linearGradient key={m.id} id={`grad-${m.id}`} x1={gx1} y1={gy1} x2={gx2} y2={gy2} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={`hsl(${m.hslDark})`} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={`hsl(${m.hsl})`} stopOpacity="0.14" />
                  </linearGradient>
                );
              })}
              {modules.map((m, i) => {
                const midAngle = i * 120 - 90 + 60;
                const gx1 = center + innerR * Math.cos(toRad(midAngle));
                const gy1 = center + innerR * Math.sin(toRad(midAngle));
                const gx2 = center + outerR * Math.cos(toRad(midAngle));
                const gy2 = center + outerR * Math.sin(toRad(midAngle));
                return (
                  <linearGradient key={`hover-${m.id}`} id={`grad-hover-${m.id}`} x1={gx1} y1={gy1} x2={gx2} y2={gy2} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={`hsl(${m.hslDark})`} stopOpacity="0.30" />
                    <stop offset="100%" stopColor={`hsl(${m.hsl})`} stopOpacity="0.24" />
                  </linearGradient>
                );
              })}
              {/* Manager gradient */}
              <radialGradient id="grad-manager" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={`hsl(${managerModule.hslDark})`} stopOpacity="0.22" />
                <stop offset="100%" stopColor={`hsl(${managerModule.hsl})`} stopOpacity="0.16" />
              </radialGradient>
              <radialGradient id="grad-hover-manager" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={`hsl(${managerModule.hslDark})`} stopOpacity="0.35" />
                <stop offset="100%" stopColor={`hsl(${managerModule.hsl})`} stopOpacity="0.28" />
              </radialGradient>
            </defs>

            {modules.map((m, i) => {
              const isHovered = hovered === m.id;
              return (
                <path
                  key={m.id}
                  d={segmentPaths[i]}
                  fill={isHovered ? `url(#grad-hover-${m.id})` : `url(#grad-${m.id})`}
                  stroke={`hsl(${m.hsl} / ${isHovered ? 0.5 : 0.2})`}
                  strokeWidth="1"
                  className="cursor-pointer"
                  style={{
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    filter: isHovered
                      ? `drop-shadow(0 4px 6px hsl(${m.hsl} / 0.25)) drop-shadow(0 0 20px hsl(${m.hsl} / 0.15))`
                      : "none",
                    transform: isHovered ? "translateY(-3px)" : "translateY(0)",
                    transformOrigin: "center",
                  }}
                  onClick={() => navigate(m.path)}
                  onMouseEnter={() => setHovered(m.id)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}

            {/* Manager circle in center */}
            {isManager && (
              <circle
                cx={center}
                cy={center}
                r={managerR}
                fill={isManagerHovered ? "url(#grad-hover-manager)" : "url(#grad-manager)"}
                stroke={`hsl(${managerModule.hsl} / ${isManagerHovered ? 0.5 : 0.2})`}
                strokeWidth="1"
                className="cursor-pointer"
                style={{
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  filter: isManagerHovered
                    ? `drop-shadow(0 4px 6px hsl(${managerModule.hsl} / 0.25)) drop-shadow(0 0 20px hsl(${managerModule.hsl} / 0.15))`
                    : "none",
                  transform: isManagerHovered ? "translateY(-3px)" : "translateY(0)",
                  transformOrigin: "center",
                }}
                onClick={() => navigate(managerModule.path)}
                onMouseEnter={() => setHovered("manager")}
                onMouseLeave={() => setHovered(null)}
              />
            )}
          </svg>

          {/* Labels overlaid on segments */}
          {modules.map((m, i) => {
            const Icon = m.icon;
            const pos = labelPositions[i];
            const isHovered = hovered === m.id;
            return (
              <div
                key={m.id}
                className="absolute flex flex-col items-center pointer-events-none select-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: `translate(-50%, -50%) translateY(${isHovered ? "-3px" : "0"})`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <Icon
                  className="w-6 h-6 mb-2"
                  style={{
                    color: `hsl(${m.hsl})`,
                    opacity: isHovered ? 1 : 0.7,
                    transition: "opacity 0.3s",
                  }}
                />
                <span
                  className="text-sm font-bold tracking-[0.2em] text-foreground"
                  style={{
                    opacity: isHovered ? 1 : 0.85,
                    transition: "opacity 0.3s",
                  }}
                >
                  {m.label}
                </span>
                <span
                  className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap"
                  style={{
                    opacity: isHovered ? 0.8 : 0.5,
                    transition: "opacity 0.3s",
                  }}
                >
                  {m.subtitle}
                </span>
              </div>
            );
          })}

          {/* Manager center label */}
          {isManager && (
            <div
              className="absolute flex flex-col items-center pointer-events-none select-none"
              style={{
                left: center,
                top: center,
                transform: `translate(-50%, -50%) translateY(${isManagerHovered ? "-3px" : "0"})`,
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <Shield
                className="w-6 h-6 mb-2"
                style={{
                  color: `hsl(${managerModule.hsl})`,
                  opacity: isManagerHovered ? 1 : 0.7,
                  transition: "opacity 0.3s",
                }}
              />
              <span
                className="text-sm font-bold tracking-[0.2em] text-foreground"
                style={{
                  opacity: isManagerHovered ? 1 : 0.85,
                  transition: "opacity 0.3s",
                }}
              >
                {managerModule.label}
              </span>
              <span
                className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap"
                style={{
                  opacity: isManagerHovered ? 0.8 : 0.5,
                  transition: "opacity 0.3s",
                }}
              >
                {managerModule.subtitle}
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
