import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Clock, Trophy, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO, differenceInCalendarDays } from "date-fns";
import { getCalendarWeekBounds } from "@/lib/utils";

interface ActivityEntry {
  id: string;
  user_id: string;
  user_name: string;
  module: string;
  action: string;
  count: number;
  created_at: string;
}

interface UserSummary {
  user_id: string;
  user_name: string;
  messagesSent: number;
  replies: number;
  interviews: number;
  candidatesAdded: number;
  salesLogged: number;
}

interface LeaderboardUser {
  user_id: string;
  user_name: string;
  totalActions: number;
}

const ACTION_LABELS: Record<string, string> = {
  sent_messages: "Sent messages",
  replied: "Received replies",
  interviews_booked: "Booked interviews",
  candidate_added: "Added candidate",
  candidate_stage_changed: "Moved candidate stage",
  sales_logged: "Logged sales",
  ad_uploaded: "Uploaded ad",
  cv_downloaded: "Downloaded CVs",
  sale_transaction: "Recorded sale transaction",
};

const MODULE_COLORS: Record<string, string> = {
  recruitment: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  linkedin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  sales: "bg-red-500/10 text-red-500 border-red-500/20",
};

function computeStreak(entries: ActivityEntry[]): { current: number; best: number } {
  if (entries.length === 0) return { current: 0, best: 0 };

  const activeDays = new Set<string>();
  for (const e of entries) {
    activeDays.add(format(new Date(e.created_at), "yyyy-MM-dd"));
  }

  const sorted = [...activeDays].sort().reverse();

  // Current streak
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

  let current = 0;
  if (sorted[0] === todayStr || sorted[0] === yesterdayStr) {
    let checkDate = sorted[0] === todayStr ? new Date() : subDays(new Date(), 1);
    for (const day of sorted) {
      if (day === format(checkDate, "yyyy-MM-dd")) {
        current++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
  }

  // Best streak
  const ascending = [...activeDays].sort();
  let best = 0;
  let streak = 1;
  for (let i = 1; i < ascending.length; i++) {
    const diff = differenceInCalendarDays(parseISO(ascending[i]), parseISO(ascending[i - 1]));
    if (diff === 1) {
      streak++;
    } else {
      best = Math.max(best, streak);
      streak = 1;
    }
  }
  best = Math.max(best, streak);
  if (ascending.length === 0) best = 0;

  return { current, best };
}

export function ManagerActivityLog() {
  const [timeFilter, setTimeFilter] = useState<"today" | "week">("today");
  const [moduleFilter, setModuleFilter] = useState<"all" | "recruitment" | "linkedin" | "sales">("all");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userAllEntries, setUserAllEntries] = useState<ActivityEntry[]>([]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (timeFilter === "today") {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      query = query.gte("created_at", `${todayStr}T00:00:00`).lte("created_at", `${todayStr}T23:59:59`);
    } else {
      const { start, end } = getCalendarWeekBounds(0);
      query = query.gte("created_at", format(start, "yyyy-MM-dd") + "T00:00:00").lte("created_at", format(end, "yyyy-MM-dd") + "T23:59:59");
    }

    if (moduleFilter !== "all") {
      query = query.eq("module", moduleFilter);
    }

    const { data } = await query;
    setEntries((data as ActivityEntry[]) ?? []);
    setLoading(false);
  }, [timeFilter, moduleFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const fetchUserAllEntries = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    setUserAllEntries((data as ActivityEntry[]) ?? []);
  }, []);

  // Activity Leaderboard
  const leaderboard = useMemo<LeaderboardUser[]>(() => {
    const userMap = new Map<string, { user_name: string; total: number }>();
    for (const e of entries) {
      const existing = userMap.get(e.user_id);
      if (existing) {
        existing.total += e.count;
      } else {
        userMap.set(e.user_id, { user_name: e.user_name, total: e.count });
      }
    }
    return [...userMap.entries()]
      .map(([user_id, v]) => ({ user_id, user_name: v.user_name, totalActions: v.total }))
      .sort((a, b) => b.totalActions - a.totalActions);
  }, [entries]);

  const groupedEntries = entries.reduce<ActivityEntry[]>((acc, entry) => {
    const existing = acc.find(e => e.user_id === entry.user_id && e.action === entry.action && e.module === entry.module);
    if (existing) {
      existing.count += entry.count;
    } else {
      acc.push({ ...entry });
    }
    return acc;
  }, []);

  const userEntries = selectedUser ? entries.filter(e => e.user_id === selectedUser) : [];
  const selectedUserName = selectedUser ? entries.find(e => e.user_id === selectedUser)?.user_name ?? userAllEntries[0]?.user_name ?? "Unknown" : "";

  const getUserSummary = (): UserSummary | null => {
    if (!selectedUser) return null;
    const ue = userEntries;
    return {
      user_id: selectedUser,
      user_name: selectedUserName,
      messagesSent: ue.filter(e => e.action === "sent_messages").reduce((s, e) => s + e.count, 0),
      replies: ue.filter(e => e.action === "replied").reduce((s, e) => s + e.count, 0),
      interviews: ue.filter(e => e.action === "interviews_booked").reduce((s, e) => s + e.count, 0),
      candidatesAdded: ue.filter(e => e.action === "candidate_added").reduce((s, e) => s + e.count, 0),
      salesLogged: ue.filter(e => e.action === "sales_logged" || e.action === "sale_transaction").reduce((s, e) => s + e.count, 0),
    };
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId);
    fetchUserAllEntries(userId);
  };

  if (selectedUser) {
    const summary = getUserSummary();
    const streak = computeStreak(userAllEntries);
    const userGrouped = userEntries.reduce<ActivityEntry[]>((acc, entry) => {
      const existing = acc.find(e => e.action === entry.action && e.module === entry.module);
      if (existing) { existing.count += entry.count; } else { acc.push({ ...entry }); }
      return acc;
    }, []);

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setUserAllEntries([]); }} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Feed
        </Button>

        <h2 className="text-sm font-semibold text-foreground">{selectedUserName}'s Activity</h2>

        {/* Streak display */}
        <div className="flex gap-3">
          <Card className="glass-panel flex-1">
            <CardContent className="p-3 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-lg font-bold text-foreground">{streak.current} day{streak.current !== 1 ? "s" : ""}</p>
                <p className="text-[10px] text-muted-foreground">Current Streak</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-panel flex-1">
            <CardContent className="p-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-lg font-bold text-foreground">{streak.best} day{streak.best !== 1 ? "s" : ""}</p>
                <p className="text-[10px] text-muted-foreground">Best Streak</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Messages Sent", value: summary.messagesSent },
              { label: "Replies", value: summary.replies },
              { label: "Interviews", value: summary.interviews },
              { label: "Candidates Added", value: summary.candidatesAdded },
              { label: "Sales Logged", value: summary.salesLogged },
            ].map(s => (
              <Card key={s.label} className="glass-panel">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* User's activity feed */}
        <Card className="glass-panel">
          <CardContent className="p-4">
            {userGrouped.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity recorded.</p>
            ) : (
              <div className="space-y-2">
                {userGrouped.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/20">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">{format(new Date(e.created_at), "HH:mm")}</span>
                    <span className="text-sm text-foreground flex-1">
                      {ACTION_LABELS[e.action] ?? e.action}{e.count > 1 ? ` (${e.count})` : ""}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${MODULE_COLORS[e.module] ?? ""}`}>{e.module}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(["today", "week"] as const).map(t => (
            <Button key={t} size="sm" variant={timeFilter === t ? "default" : "outline"} onClick={() => setTimeFilter(t)}>
              {t === "today" ? "Today" : "This Week"}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["all", "recruitment", "linkedin", "sales"] as const).map(m => (
            <Button key={m} size="sm" variant={moduleFilter === m ? "default" : "outline"} onClick={() => setModuleFilter(m)}>
              {m === "all" ? "All" : m.charAt(0).toUpperCase() + m.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Activity Leaderboard */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Activity Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity recorded for this period.</p>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((u, i) => (
                <button
                  key={u.user_id}
                  onClick={() => handleSelectUser(u.user_id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/20 hover:border-primary/30 transition-all text-left"
                >
                  <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground flex-1">{u.user_name}</span>
                  <span className="text-sm font-semibold text-primary">{u.totalActions} actions</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Feed */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : groupedEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity recorded for this period.</p>
          ) : (
            <div className="space-y-2">
              {groupedEntries.map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/20">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">{format(new Date(e.created_at), "HH:mm")}</span>
                  <button
                    onClick={() => handleSelectUser(e.user_id)}
                    className="text-sm font-medium text-primary hover:underline shrink-0"
                  >
                    {e.user_name}
                  </button>
                  <span className="text-sm text-foreground flex-1">
                    → {ACTION_LABELS[e.action] ?? e.action}{e.count > 1 ? ` (${e.count})` : ""}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${MODULE_COLORS[e.module] ?? ""}`}>{e.module}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
