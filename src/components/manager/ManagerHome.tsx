import { Crown, Star, Trophy, Linkedin, Activity, Users, ClipboardCheck, ScrollText, FileBarChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ManagerHomeProps {
  promotionCount: number;
  personalBestCount: number;
  totalSalesToday: number;
  totalCvsThisWeek: number;
  onNavigate: (tab: string) => void;
}

export function ManagerHome({ promotionCount, personalBestCount, totalSalesToday, totalCvsThisWeek, onNavigate }: ManagerHomeProps) {
  const statusCards = [
    { label: "Promotions Pending", value: promotionCount, color: "text-amber-500" },
    ...(personalBestCount > 0 ? [{ label: "Personal Bests", value: personalBestCount, color: "text-orange-500" }] : []),
    { label: "Sales Today", value: totalSalesToday, color: "text-emerald-500" },
    { label: "CVs This Week", value: totalCvsThisWeek, color: "text-blue-500" },
  ];

  const navItems = [
    { key: "performance", icon: Trophy, title: "Performance", description: "Top performers, weekly results & office overview", color: "hsl(45 90% 50%)" },
    { key: "linkedin", icon: Linkedin, title: "LinkedIn Intelligence", description: "Ad & title performance analytics", color: "hsl(210 70% 50%)" },
    { key: "team", icon: Users, title: "Team Management", description: "Promote, demote, reset passwords & manage users", color: "hsl(270 60% 50%)" },
    { key: "approvals", icon: ClipboardCheck, title: "Approvals", description: "Promotion queue, PBs & weekly recognition", color: "hsl(160 60% 45%)" },
    { key: "activity", icon: ScrollText, title: "Activity Log", description: "Real-time feed of actions across all modules", color: "hsl(0 70% 55%)" },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statusCards.map((s) => (
          <Card key={s.label} className="glass-panel">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {navItems.map((item) => (
          <Card
            key={item.key}
            className="glass-panel cursor-pointer hover:border-primary/30 transition-all group"
            onClick={() => onNavigate(item.key)}
          >
            <CardContent className="p-5 flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${item.color.replace(")", " / 0.15)")}` }}
              >
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
