import { useNavigate } from "react-router-dom";
import { Users, DollarSign, Trophy, Shield, LogOut, Lock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useRef, useState } from "react";


const allModules = [
  {
    id: "week-summary",
    label: "WEEK SUMMARY",
    subtitle: "Weekly Performance Overview",
    icon: BarChart3,
    path: "/week-summary",
    hsl: "220 60% 50%",
    hslDark: "220 60% 35%",
    requiredRoles: ["brand_ambassador", "leader", "manager"] as string[],
  },
  {
    id: "sales",
    label: "SALES",
    subtitle: "Daily Performance",
    icon: DollarSign,
    path: "/sales",
    hsl: "0 65% 42%",
    hslDark: "0 65% 32%",
    requiredRoles: ["brand_ambassador", "leader", "manager"] as string[],
  },
  {
    id: "recruitment",
    label: "RECRUITMENT",
    subtitle: "Pipeline & Forecast",
    icon: Users,
    path: "/recruitment",
    hsl: "172 66% 50%",
    hslDark: "172 66% 38%",
    requiredRoles: ["leader", "manager"] as string[],
  },
  {
    id: "leaderboards",
    label: "LEADERBOARDS",
    subtitle: "Rankings & Results",
    icon: Trophy,
    path: "/leaderboards",
    hsl: "36 75% 48%",
    hslDark: "36 75% 36%",
    requiredRoles: ["leader", "manager"] as string[],
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
  const userRoleName = userRole?.role ?? "brand_ambassador";

  const isModuleUnlocked = (requiredRoles: string[]) => requiredRoles.includes(userRoleName);
  const isManagerUnlocked = isManager;

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
          {allModules.map((m) => {
            const Icon = m.icon;
            const unlocked = isModuleUnlocked(m.requiredRoles);
            return (
              <button
                key={m.id}
                onClick={() => unlocked && navigate(m.path)}
                disabled={!unlocked}
                className={`w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-300 relative ${unlocked ? "active:scale-[0.98]" : "cursor-not-allowed"}`}
                style={{
                  background: unlocked
                    ? `linear-gradient(135deg, hsl(${m.hsl} / 0.18), hsl(${m.hslDark} / 0.10))`
                    : `linear-gradient(135deg, hsl(0 0% 50% / 0.08), hsl(0 0% 40% / 0.05))`,
                  border: `1px solid ${unlocked ? `hsl(${m.hsl} / 0.25)` : "hsl(0 0% 50% / 0.12)"}`,
                  opacity: unlocked ? 1 : 0.5,
                }}
              >
                <Icon className="w-7 h-7" style={{ color: unlocked ? `hsl(${m.hsl})` : "hsl(0 0% 50%)" }} />
                <span className={`text-base font-bold tracking-[0.2em] ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.subtitle}</span>
                {!unlocked && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">Locked</span>
                  </div>
                )}
              </button>
            );
          })}
          {/* Manager module - always visible */}
          <button
            onClick={() => isManagerUnlocked && navigate(managerModule.path)}
            disabled={!isManagerUnlocked}
            className={`w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-300 relative ${isManagerUnlocked ? "active:scale-[0.98]" : "cursor-not-allowed"}`}
            style={{
              background: isManagerUnlocked
                ? `linear-gradient(135deg, hsl(${managerModule.hsl} / 0.18), hsl(${managerModule.hslDark} / 0.10))`
                : `linear-gradient(135deg, hsl(0 0% 50% / 0.08), hsl(0 0% 40% / 0.05))`,
              border: `1px solid ${isManagerUnlocked ? `hsl(${managerModule.hsl} / 0.25)` : "hsl(0 0% 50% / 0.12)"}`,
              opacity: isManagerUnlocked ? 1 : 0.5,
            }}
          >
            <Shield className="w-7 h-7" style={{ color: isManagerUnlocked ? `hsl(${managerModule.hsl})` : "hsl(0 0% 50%)" }} />
            <span className={`text-base font-bold tracking-[0.2em] ${isManagerUnlocked ? "text-foreground" : "text-muted-foreground"}`}>{managerModule.label}</span>
            <span className="text-xs text-muted-foreground">{managerModule.subtitle}</span>
            {!isManagerUnlocked && (
              <div className="absolute top-3 right-3 flex items-center gap-1 text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Locked</span>
              </div>
            )}
          </button>
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

  const segAngle = 360 / allModules.length; // 90° per segment

  const segmentPaths = allModules.map((_, i) => {
    const startAngle = i * segAngle - 180 + gap / 2;
    const endAngle = startAngle + segAngle - gap;
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

  const labelPositions = allModules.map((_, i) => {
    const midAngle = i * segAngle - 180 + segAngle / 2;
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

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 gap-6">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            className="block"
          >
            <defs>
              {allModules.map((m, i) => {
                const midAngle = i * segAngle - 180 + segAngle / 2;
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
              {allModules.map((m, i) => {
                const midAngle = i * segAngle - 180 + segAngle / 2;
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
              {allModules.map((m, i) => {
                const midAngle = i * 120 - 150 + 60;
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
              {/* Locked gradient */}
              <linearGradient id="grad-locked" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(0 0% 40%)" stopOpacity="0.06" />
                <stop offset="100%" stopColor="hsl(0 0% 50%)" stopOpacity="0.04" />
              </linearGradient>
              {/* Manager gradient */}
              <radialGradient id="grad-manager" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={`hsl(${managerModule.hslDark})`} stopOpacity="0.22" />
                <stop offset="100%" stopColor={`hsl(${managerModule.hsl})`} stopOpacity="0.16" />
              </radialGradient>
              <radialGradient id="grad-hover-manager" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={`hsl(${managerModule.hslDark})`} stopOpacity="0.35" />
                <stop offset="100%" stopColor={`hsl(${managerModule.hsl})`} stopOpacity="0.28" />
              </radialGradient>
              <radialGradient id="grad-locked-manager" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(0 0% 40%)" stopOpacity="0.06" />
                <stop offset="100%" stopColor="hsl(0 0% 50%)" stopOpacity="0.04" />
              </radialGradient>
            </defs>

            {allModules.map((m, i) => {
              const unlocked = isModuleUnlocked(m.requiredRoles);
              const isHovered = hovered === m.id;
              return (
                <path
                  key={m.id}
                  d={segmentPaths[i]}
                  fill={!unlocked ? "url(#grad-locked)" : isHovered ? `url(#grad-hover-${m.id})` : `url(#grad-${m.id})`}
                  stroke={unlocked ? `hsl(${m.hsl} / ${isHovered ? 0.5 : 0.2})` : "hsl(0 0% 50% / 0.1)"}
                  strokeWidth="1"
                  className={unlocked ? "cursor-pointer" : "cursor-not-allowed"}
                  style={{
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    filter: unlocked && isHovered
                      ? `drop-shadow(0 4px 6px hsl(${m.hsl} / 0.25)) drop-shadow(0 0 20px hsl(${m.hsl} / 0.15))`
                      : "none",
                    transform: unlocked && isHovered ? "translateY(-3px)" : "translateY(0)",
                    transformOrigin: "center",
                    opacity: unlocked ? 1 : 0.45,
                  }}
                  onClick={() => unlocked && navigate(m.path)}
                  onMouseEnter={() => setHovered(m.id)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}

            {/* Manager circle in center - always visible */}
            <circle
              cx={center}
              cy={center}
              r={managerR}
              fill={!isManagerUnlocked ? "url(#grad-locked-manager)" : isManagerHovered ? "url(#grad-hover-manager)" : "url(#grad-manager)"}
              stroke={isManagerUnlocked ? `hsl(${managerModule.hsl} / ${isManagerHovered ? 0.5 : 0.2})` : "hsl(0 0% 50% / 0.1)"}
              strokeWidth="1"
              className={isManagerUnlocked ? "cursor-pointer" : "cursor-not-allowed"}
              style={{
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                filter: isManagerUnlocked && isManagerHovered
                  ? `drop-shadow(0 4px 6px hsl(${managerModule.hsl} / 0.25)) drop-shadow(0 0 20px hsl(${managerModule.hsl} / 0.15))`
                  : "none",
                transform: isManagerUnlocked && isManagerHovered ? "translateY(-3px)" : "translateY(0)",
                transformOrigin: "center",
                opacity: isManagerUnlocked ? 1 : 0.45,
              }}
              onClick={() => isManagerUnlocked && navigate(managerModule.path)}
              onMouseEnter={() => setHovered("manager")}
              onMouseLeave={() => setHovered(null)}
            />
          </svg>

          {/* Labels overlaid on segments */}
          {allModules.map((m, i) => {
            const Icon = m.icon;
            const pos = labelPositions[i];
            const isHovered = hovered === m.id;
            const unlocked = isModuleUnlocked(m.requiredRoles);
            return (
              <div
                key={m.id}
                className="absolute flex flex-col items-center pointer-events-none select-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: `translate(-50%, -50%) translateY(${unlocked && isHovered ? "-3px" : "0"})`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  opacity: unlocked ? 1 : 0.45,
                }}
              >
                <Icon
                  className="w-6 h-6 mb-2"
                  style={{
                    color: unlocked ? `hsl(${m.hsl})` : "hsl(0 0% 50%)",
                    opacity: unlocked && isHovered ? 1 : 0.7,
                    transition: "opacity 0.3s",
                  }}
                />
                <span
                  className={`text-sm font-bold tracking-[0.2em] ${unlocked ? "text-foreground" : "text-muted-foreground"}`}
                  style={{
                    opacity: unlocked && isHovered ? 1 : 0.85,
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
                {!unlocked && (
                  <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    <span className="text-[9px] font-medium">Locked</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Manager center label - always visible */}
          <div
            className="absolute flex flex-col items-center pointer-events-none select-none"
            style={{
              left: center,
              top: center,
              transform: `translate(-50%, -50%) translateY(${isManagerUnlocked && isManagerHovered ? "-3px" : "0"})`,
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              opacity: isManagerUnlocked ? 1 : 0.45,
            }}
          >
            <Shield
              className="w-6 h-6 mb-2"
              style={{
                color: isManagerUnlocked ? `hsl(${managerModule.hsl})` : "hsl(0 0% 50%)",
                opacity: isManagerUnlocked && isManagerHovered ? 1 : 0.7,
                transition: "opacity 0.3s",
              }}
            />
            <span
              className={`text-sm font-bold tracking-[0.2em] ${isManagerUnlocked ? "text-foreground" : "text-muted-foreground"}`}
              style={{
                opacity: isManagerUnlocked && isManagerHovered ? 1 : 0.85,
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
            {!isManagerUnlocked && (
              <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span className="text-[9px] font-medium">Locked</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
