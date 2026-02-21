import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, TrendingUp, Users, Upload, FileText, UserCheck, Medal, Flame } from "lucide-react";
import { startOfWeek, endOfWeek, format, subWeeks, addDays } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  crew_name: string;
}

interface LeaderboardEntry {
  profileId: string;
  name: string;
  crewName: string;
  adsUploaded: number;
  cvsDownloaded: number;
  secondRoundsLinkedIn: number;
  totalSecondRounds: number;
  interviewToStartPct: number;
  startToPromotionPct: number;
  activeTeamSize: number;
}

type Metric = keyof Omit<LeaderboardEntry, "profileId" | "name" | "crewName">;

const METRICS: { key: Metric; label: string; icon: React.ReactNode; suffix?: string }[] = [
  { key: "adsUploaded", label: "Ads Uploaded", icon: <Upload className="w-4 h-4" /> },
  { key: "cvsDownloaded", label: "CVs Downloaded", icon: <FileText className="w-4 h-4" /> },
  { key: "secondRoundsLinkedIn", label: "Obs (LinkedIn)", icon: <UserCheck className="w-4 h-4" /> },
  { key: "totalSecondRounds", label: "Total Obs", icon: <Users className="w-4 h-4" /> },
  { key: "interviewToStartPct", label: "Retention %", icon: <TrendingUp className="w-4 h-4" />, suffix: "%" },
  { key: "startToPromotionPct", label: "Promotion %", icon: <TrendingUp className="w-4 h-4" />, suffix: "%" },
  { key: "activeTeamSize", label: "Active Team", icon: <Users className="w-4 h-4" /> },
];

interface SalesRankedEntry {
  userId: string;
  name: string;
  sales: number;
  rank: number;
}

interface AllTimeRecord {
  name: string;
  sales: number;
  weekCommencing: string;
  rank: number;
}

export function Leaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [salesRanking, setSalesRanking] = useState<SalesRankedEntry[]>([]);
  const [allTimeRecords, setAllTimeRecords] = useState<AllTimeRecord[]>([]);

  // Current week bounds
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const wsStr = format(weekStart, "yyyy-MM-dd");
  const weStr = format(weekEnd, "yyyy-MM-dd");
  const weekLabel = format(weekStart, "d MMMM yyyy");

  useEffect(() => {
    async function fetchData() {
      const [profilesRes, candidatesRes, activityRes, adsRes, cvsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("candidates").select("*"),
        supabase.from("linkedin_activity").select("*"),
        supabase.from("ad_uploads").select("*"),
        supabase.from("cv_downloads").select("*"),
      ]);

      const profiles: Profile[] = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name, crew_name: p.crew_name || "",
      }));
      const candidates = candidatesRes.data ?? [];
      const activities = activityRes.data ?? [];
      const ads = adsRes.data ?? [];
      const cvs = cvsRes.data ?? [];

      const START_FORWARD = ["start", "solo", "promoted"];

      const result: LeaderboardEntry[] = profiles.map((p) => {
        const userCandidates = candidates.filter((c) => c.user_id === p.user_id);
        const userActivities = activities.filter((a) => a.user_id === p.user_id);
        const userAds = ads.filter((a) => a.user_id === p.user_id);
        const userCvs = cvs.filter((c) => c.user_id === p.user_id);

        const totalInterviews = userCandidates.length;
        const starts = userCandidates.filter((c) => START_FORWARD.includes(c.stage)).length;
        const promotions = userCandidates.filter((c) => c.stage === "promoted").length;

        return {
          profileId: p.id,
          name: p.full_name,
          crewName: p.crew_name,
          adsUploaded: userAds.length,
          cvsDownloaded: userCvs.reduce((s, c) => s + c.count, 0),
          secondRoundsLinkedIn: userActivities.reduce((s, a) => s + a.candidates_attending_2nd_round, 0),
          totalSecondRounds: totalInterviews,
          interviewToStartPct: totalInterviews > 0 ? Math.round((starts / totalInterviews) * 100) : 0,
          startToPromotionPct: starts > 0 ? Math.round((promotions / starts) * 100) : 0,
          activeTeamSize: userCandidates.filter((c) => START_FORWARD.includes(c.stage) && c.stage !== "promoted").length,
        };
      });

      setEntries(result);
    }
    fetchData();
  }, []);

  // Fetch sales leaderboard data
  useEffect(() => {
    async function fetchSalesData() {
      const [salesRes, profilesRes] = await Promise.all([
        supabase.from("sales_entries").select("*"),
        supabase.from("profiles").select("id, user_id, full_name"),
      ]);

      const allSales = salesRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const profileMap = new Map(profiles.map((p) => [p.user_id, p.full_name]));

      // Current week leaderboard — include ALL profiles
      const weekSales = allSales.filter(
        (e) => e.entry_date >= wsStr && e.entry_date <= weStr
      );

      const userTotals = new Map<string, number>();
      weekSales.forEach((e) => {
        userTotals.set(e.user_id, (userTotals.get(e.user_id) || 0) + e.sales);
      });

      // Ensure every profile appears, even with 0 sales
      const sorted = profiles
        .map((p) => ({
          userId: p.user_id,
          name: p.full_name,
          sales: userTotals.get(p.user_id) || 0,
          rank: 0,
        }))
        .sort((a, b) => b.sales - a.sales);

      // Standard competition ranking
      let currentRank = 1;
      sorted.forEach((entry, i) => {
        if (i > 0 && entry.sales < sorted[i - 1].sales) {
          currentRank = i + 1;
        }
        entry.rank = currentRank;
      });

      setSalesRanking(sorted);

      // All-time weekly records
      if (allSales.length > 0) {
        const dates = allSales.map((e) => e.entry_date).sort();
        const earliest = new Date(dates[0]);
        const latest = new Date(dates[dates.length - 1]);

        const weeklyRecords: { userId: string; sales: number; weekStart: Date }[] = [];
        let ws = startOfWeek(earliest, { weekStartsOn: 1 });

        while (ws <= latest) {
          const wsS = format(ws, "yyyy-MM-dd");
          const weS = format(endOfWeek(ws, { weekStartsOn: 1 }), "yyyy-MM-dd");

          // Group by user for this week
          const weekEntries = allSales.filter(
            (e) => e.entry_date >= wsS && e.entry_date <= weS
          );

          const userWeekTotals = new Map<string, number>();
          weekEntries.forEach((e) => {
            userWeekTotals.set(e.user_id, (userWeekTotals.get(e.user_id) || 0) + e.sales);
          });

          userWeekTotals.forEach((sales, userId) => {
            if (sales > 0) {
              weeklyRecords.push({ userId, sales, weekStart: ws });
            }
          });

          ws = addDays(ws, 7);
        }

        // Sort descending by sales, take top 5
        weeklyRecords.sort((a, b) => b.sales - a.sales);
        const top5 = weeklyRecords.slice(0, 5);

        // Standard competition ranking
        let rank = 1;
        const ranked: AllTimeRecord[] = top5.map((r, i) => {
          if (i > 0 && r.sales < top5[i - 1].sales) {
            rank = i + 1;
          }
          return {
            name: profileMap.get(r.userId) || "Unknown",
            sales: r.sales,
            weekCommencing: format(r.weekStart, "d MMM yyyy"),
            rank,
          };
        });

        setAllTimeRecords(ranked);
      }
    }
    fetchSalesData();
  }, [wsStr, weStr]);

  const metricRankings = useMemo(() => {
    const map: Record<Metric, LeaderboardEntry[]> = {} as any;
    METRICS.forEach((m) => {
      map[m.key] = [...entries].sort((a, b) => b[m.key] - a[m.key]);
    });
    return map;
  }, [entries]);

  const displayName = (entry: LeaderboardEntry) =>
    entry.crewName ? `${entry.name} (${entry.crewName})` : entry.name;

  const getRankSuffix = (rank: number) => {
    if (rank % 100 >= 11 && rank % 100 <= 13) return "th";
    switch (rank % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  const topRecord = allTimeRecords.length > 0 ? allTimeRecords[0] : null;

  return (
    <div className="space-y-6">
      {/* ===== SECTION 1 — SALES ===== */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} />
          <h2 className="text-sm font-semibold text-foreground">🔥 Sales — This Week</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Full ranked list */}
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><Flame className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} /></div>
              <span className="text-xs font-medium text-muted-foreground">Office Ranking</span>
            </div>
            <div className="divide-y divide-border/30">
              {salesRanking.map((entry) => {
                const isMe = entry.userId === user?.id;
                const isFirst = entry.rank === 1 && entry.sales > 0;
                const medalColor = entry.rank === 1 && entry.sales > 0 ? "#FFD700" : entry.rank === 2 && entry.sales > 0 ? "#C0C0C0" : entry.rank === 3 && entry.sales > 0 ? "#CD7F32" : null;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between py-2 px-2 rounded-md ${isFirst ? "bg-red-500/10 border border-red-500/15" : ""} ${isMe && !isFirst ? "bg-muted/30" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {medalColor ? (
                        <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} />
                      ) : (
                        <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">
                          {entry.rank}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-muted-foreground w-8 flex-shrink-0">
                        {entry.rank}{getRankSuffix(entry.rank)}
                      </span>
                      <span className={`text-xs truncate ${isFirst ? "font-semibold text-foreground" : isMe ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {entry.name}{isMe ? " ●" : ""}
                      </span>
                    </div>
                    <span className={`text-xs font-mono flex-shrink-0 ml-2 ${isFirst ? "font-bold" : "text-muted-foreground"}`} style={isFirst ? { color: "hsl(0 70% 50%)" } : {}}>
                      {entry.sales}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-Time Weekly Record tile */}
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><Trophy className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} /></div>
              <span className="text-xs font-medium text-muted-foreground">🏆 All-Time Weekly Record</span>
            </div>
            {!topRecord ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-1">
                {allTimeRecords.map((record, i) => {
                  const medalColor = record.rank === 1 ? "#FFD700" : record.rank === 2 ? "#C0C0C0" : record.rank === 3 ? "#CD7F32" : null;
                  return (
                    <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${record.rank === 1 ? "bg-red-500/10" : ""}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {medalColor ? (
                          <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} />
                        ) : (
                          <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{record.rank}</span>
                        )}
                        <div className="min-w-0">
                          <span className={`text-xs truncate block ${record.rank === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{record.name}</span>
                          <span className="text-[10px] text-muted-foreground">w/c {record.weekCommencing}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-mono flex-shrink-0 ml-2 ${record.rank === 1 ? "font-bold" : "text-muted-foreground"}`} style={record.rank === 1 ? { color: "hsl(0 70% 50%)" } : {}}>{record.sales}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Subtle divider */}
      <div className="border-t border-border/30" />

      {/* ===== SECTION 2 — RECRUITMENT ===== */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">🎯 Recruitment — This Week</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {METRICS.map((m) => {
            const ranked = metricRankings[m.key];
            return (
              <div key={m.key} className="glass-panel p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-muted-foreground">{m.icon}</div>
                  <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                </div>
                {ranked.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No data</p>
                ) : (
                  <div className="space-y-1">
                    {ranked.map((entry, i) => (
                      <div key={entry.profileId} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${i === 0 ? "bg-primary/10" : ""}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {i === 0 ? (
                            <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FFD700" }} />
                          ) : i === 1 ? (
                            <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#C0C0C0" }} />
                          ) : i === 2 ? (
                            <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#CD7F32" }} />
                          ) : (
                            <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{i + 1}</span>
                          )}
                          <span className={`text-xs truncate ${i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{displayName(entry)}</span>
                        </div>
                        <span className={`text-xs font-mono flex-shrink-0 ml-2 ${i === 0 ? "font-bold text-primary" : "text-muted-foreground"}`}>{entry[m.key]}{m.suffix ?? ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
