import { Trophy, Linkedin, Users, ClipboardCheck, ScrollText, Bell, AlertTriangle, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ManagerHomeProps {
  promotionCount: number;
  personalBestCount: number;
  totalSalesToday: number;
  totalCvsThisWeek: number;
  onNavigate: (tab: string) => void;
}

interface AttentionUser {
  name: string;
  userId: string;
}

export function ManagerHome({ promotionCount, personalBestCount, totalSalesToday, totalCvsThisWeek, onNavigate }: ManagerHomeProps) {
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [noSalesUsers, setNoSalesUsers] = useState<AttentionUser[]>([]);
  const [noAdsUsers, setNoAdsUsers] = useState<AttentionUser[]>([]);
  const [attentionLoading, setAttentionLoading] = useState(true);

  useEffect(() => {
    const fetchTodayActivity = async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { count } = await supabase
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${todayStr}T00:00:00`)
        .lte("created_at", `${todayStr}T23:59:59`);
      setNewActivityCount(count ?? 0);
    };
    fetchTodayActivity();
  }, []);

  useEffect(() => {
    const fetchAttentionData = async () => {
      setAttentionLoading(true);
      try {
        const todayStr = format(new Date(), "yyyy-MM-dd");

        // Get all non-manager profiles
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, user_id, full_name");

        const { data: managerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "manager");

        const managerUserIds = new Set((managerRoles || []).map(r => r.user_id));
        const nonManagerProfiles = (allProfiles || []).filter(p => !managerUserIds.has(p.user_id));

        // Check sales today
        const { data: salesToday } = await supabase
          .from("sales_entries")
          .select("user_id")
          .eq("entry_date", todayStr)
          .gt("sales", 0);

        const usersWithSales = new Set((salesToday || []).map(s => s.user_id));
        const missingSales = nonManagerProfiles
          .filter(p => !usersWithSales.has(p.user_id))
          .map(p => ({ name: p.full_name, userId: p.user_id }));

        // Check active LinkedIn ads
        const { data: activeAds } = await supabase
          .from("ad_uploads")
          .select("user_id")
          .is("close_date", null);

        const usersWithAds = new Set((activeAds || []).map(a => a.user_id));
        const missingAds = nonManagerProfiles
          .filter(p => !usersWithAds.has(p.user_id))
          .map(p => ({ name: p.full_name, userId: p.user_id }));

        setNoSalesUsers(missingSales);
        setNoAdsUsers(missingAds);
      } catch (err) {
        console.error("Error fetching attention data:", err);
      } finally {
        setAttentionLoading(false);
      }
    };
    fetchAttentionData();
  }, []);

  const notifications = [
    ...(promotionCount > 0 ? [{ label: `${promotionCount} Promotion${promotionCount > 1 ? "s" : ""} Pending`, icon: AlertTriangle, color: "text-amber-500", target: "approvals" }] : []),
    ...(personalBestCount > 0 ? [{ label: `${personalBestCount} New Personal Best${personalBestCount > 1 ? "s" : ""}`, icon: Zap, color: "text-orange-500", target: "approvals" }] : []),
    ...(newActivityCount > 0 ? [{ label: `${newActivityCount} New Activities Logged Today`, icon: Bell, color: "text-blue-500", target: "activity" }] : []),
  ];

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

  const hasAttentionItems = noSalesUsers.length > 0 || noAdsUsers.length > 0;
  const allClear = !attentionLoading && !hasAttentionItems;

  return (
    <div className="space-y-6">
      {/* Notification Bar */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <button
              key={i}
              onClick={() => onNavigate(n.target)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-primary/30 transition-all text-left group"
            >
              <n.icon className={`w-4 h-4 ${n.color} shrink-0`} />
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{n.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Needs Attention */}
      {!attentionLoading && (
        <div className="rounded-lg border border-border/30 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            {hasAttentionItems ? (
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-foreground">Needs Attention</h3>
          </div>

          {allClear ? (
            <p className="text-sm text-muted-foreground">All users are up to date</p>
          ) : (
            <div className="space-y-4">
              {noSalesUsers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    No Sales Logged Today — {noSalesUsers.length} user{noSalesUsers.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {noSalesUsers.map((u) => (
                      <button
                        key={u.userId}
                        onClick={() => onNavigate(`activity:user:${u.userId}`)}
                        className="text-xs px-2 py-1 rounded-md bg-muted/40 border border-border/20 text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {noAdsUsers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    No Active LinkedIn Ad — {noAdsUsers.length} user{noAdsUsers.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {noAdsUsers.map((u) => (
                      <button
                        key={u.userId}
                        onClick={() => onNavigate(`activity:user:${u.userId}`)}
                        className="text-xs px-2 py-1 rounded-md bg-muted/40 border border-border/20 text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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