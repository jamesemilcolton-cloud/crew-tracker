import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, User, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
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

export function ManagerActivityLog() {
  const [timeFilter, setTimeFilter] = useState<"today" | "week">("today");
  const [moduleFilter, setModuleFilter] = useState<"all" | "recruitment" | "linkedin" | "sales">("all");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

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

  // Group entries for the global feed
  const groupedEntries = entries.reduce<ActivityEntry[]>((acc, entry) => {
    // Group by user + action within the same time window
    const existing = acc.find(e => e.user_id === entry.user_id && e.action === entry.action && e.module === entry.module);
    if (existing) {
      existing.count += entry.count;
    } else {
      acc.push({ ...entry });
    }
    return acc;
  }, []);

  const userEntries = selectedUser ? entries.filter(e => e.user_id === selectedUser) : [];
  const selectedUserName = selectedUser ? entries.find(e => e.user_id === selectedUser)?.user_name ?? "Unknown" : "";

  // User summary stats
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

  if (selectedUser) {
    const summary = getUserSummary();
    const userGrouped = userEntries.reduce<ActivityEntry[]>((acc, entry) => {
      const existing = acc.find(e => e.action === entry.action && e.module === entry.module);
      if (existing) { existing.count += entry.count; } else { acc.push({ ...entry }); }
      return acc;
    }, []);

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Feed
        </Button>

        <h2 className="text-sm font-semibold text-foreground">{selectedUserName}'s Activity</h2>

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
                    onClick={() => setSelectedUser(e.user_id)}
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
