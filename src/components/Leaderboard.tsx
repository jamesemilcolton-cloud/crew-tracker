import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { Trophy, TrendingUp, Users, Upload, FileText, UserCheck, Medal, Flame, PoundSterling } from "lucide-react";
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

interface ProfitRankedEntry {
  userId: string;
  name: string;
  repProfit: number;
  salesCount: number;
  rank: number;
}

interface AllTimeProfitRecord {
  name: string;
  repProfit: number;
  weekCommencing: string;
  rank: number;
}

interface CrewProfitEntry {
  userId: string;
  name: string;
  crewName: string;
  crewWire: number;
  crewRepProfit: number;
  crewSalesCount: number;
  avgRepProfitPerSeller: number;
  rank: number;
  hasTeam: boolean;
}

interface AllTimeCrewProfitRecord {
  name: string;
  crewName: string;
  crewWire: number;
  weekCommencing: string;
  rank: number;
}

/** Format crew display name: "Crew Name (Leader's Crew)" or "Leader's Crew" */
function formatCrewDisplayName(leaderName: string, crewName: string): string {
  const firstName = leaderName.split(" ")[0];
  const possessive = firstName.endsWith("s") ? `${firstName}'` : `${firstName}'s`;
  if (crewName) {
    return `${crewName} (${possessive} Crew)`;
  }
  return `${possessive} Crew`;
}

export function Leaderboard() {
  const { user } = useAuth();
  const { profiles: sharedProfiles, loading: profilesLoading } = useProfiles();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [profitRanking, setProfitRanking] = useState<ProfitRankedEntry[]>([]);
  const [allTimeProfitRecords, setAllTimeProfitRecords] = useState<AllTimeProfitRecord[]>([]);
  const [crewProfitRanking, setCrewProfitRanking] = useState<CrewProfitEntry[]>([]);
  const [crewAvgProfitRanking, setCrewAvgProfitRanking] = useState<CrewProfitEntry[]>([]);
  const [allTimeCrewProfitRecords, setAllTimeCrewProfitRecords] = useState<AllTimeCrewProfitRecord[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Current week bounds
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const wsStr = format(weekStart, "yyyy-MM-dd");
  const weStr = format(weekEnd, "yyyy-MM-dd");
  const weekLabel = format(weekStart, "d MMMM yyyy");

  useEffect(() => {
    async function fetchData() {
      const [candidatesRes, activityRes, adsRes, cvsRes] = await Promise.all([
        supabase.from("candidates").select("*"),
        supabase.from("linkedin_activity").select("*"),
        supabase.from("ad_uploads").select("*"),
        supabase.from("cv_downloads").select("*"),
      ]);

      const profiles: Profile[] = sharedProfiles.map((p) => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name, crew_name: p.crew_name || "",
      }));
      const candidates = candidatesRes.data ?? [];
      const activities = activityRes.data ?? [];
      const ads = adsRes.data ?? [];
      const cvs = cvsRes.data ?? [];

      const START_FORWARD = ["start", "solo", "promoted"];

      // Exclude managers/super_admins from recruitment leaderboard
      const [rolesForRecruitment] = await Promise.all([
        supabase.from("user_roles").select("user_id, role, super_admin"),
      ]);
      const recruitRoles = rolesForRecruitment.data ?? [];
      const managerUserIds = new Set(
        recruitRoles.filter((r) => r.role === "manager").map((r) => r.user_id)
      );
      const nonManagerProfiles = profiles.filter((p) => !managerUserIds.has(p.user_id));

      const result: LeaderboardEntry[] = nonManagerProfiles.map((p) => {
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
      setDataLoaded(true);
    }
    if (sharedProfiles.length > 0) fetchData();
  }, [sharedProfiles]);

  // Fetch profit leaderboard data from sales_transactions
  useEffect(() => {
    async function fetchProfitData() {
      const [txRes, rolesRes] = await Promise.all([
        supabase.from("sales_transactions").select("id, user_id, date, week_start, isa_upfront, total_wire, quality_pending, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const allTx = txRes.data ?? [];
      const profiles = sharedProfiles.map((p) => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name, crew_name: p.crew_name || "", leader_id: p.leader_id,
      }));
      const roles = rolesRes.data ?? [];
      const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
      const profileIdToUserId = new Map(profiles.map((p) => [p.id, p.user_id]));

      // Current week transactions
      const weekTx = allTx.filter((t) => t.date >= wsStr && t.date <= weStr);

      // Track both isa_upfront (Rep Profit) and total_wire per user
      const userRepProfit = new Map<string, number>();
      const userWireTotals = new Map<string, number>();
      const userSalesCounts = new Map<string, number>();
      weekTx.forEach((t) => {
        userRepProfit.set(t.user_id, (userRepProfit.get(t.user_id) || 0) + Number(t.isa_upfront));
        userWireTotals.set(t.user_id, (userWireTotals.get(t.user_id) || 0) + Number(t.total_wire));
        userSalesCounts.set(t.user_id, (userSalesCounts.get(t.user_id) || 0) + 1);
      });

      // Exclude managers from profit leaderboards
      const managerIds = new Set(
        roles.filter((r) => r.role === "manager").map((r) => r.user_id)
      );
      const nonManagerProfitProfiles = profiles.filter((p) => !managerIds.has(p.user_id));

      // === INDIVIDUAL PROFIT: Rank by Rep Profit (isa_upfront) ===
      const sorted: ProfitRankedEntry[] = nonManagerProfitProfiles
        .map((p) => ({
          userId: p.user_id,
          name: p.full_name,
          repProfit: +(userRepProfit.get(p.user_id) || 0).toFixed(2),
          salesCount: userSalesCounts.get(p.user_id) || 0,
          rank: 0,
        }))
        .sort((a, b) => b.repProfit - a.repProfit);

      // Standard competition ranking
      let currentRank = 1;
      sorted.forEach((entry, i) => {
        if (i > 0 && entry.repProfit < sorted[i - 1].repProfit) {
          currentRank = i + 1;
        }
        entry.rank = currentRank;
      });

      setProfitRanking(sorted);

      // === CREW CALCULATIONS ===
      const childrenMap = new Map<string, string[]>();
      profiles.forEach((p) => {
        if (p.leader_id) {
          const existing = childrenMap.get(p.leader_id) || [];
          existing.push(p.id);
          childrenMap.set(p.leader_id, existing);
        }
      });

      const getDescendantUserIds = (profileId: string): string[] => {
        const children = childrenMap.get(profileId) || [];
        const result: string[] = [];
        for (const childId of children) {
          const childUserId = profileIdToUserId.get(childId);
          if (childUserId) result.push(childUserId);
          result.push(...getDescendantUserIds(childId));
        }
        return result;
      };

      // Crew Total Wire (for crew profit ranking)
      const calcCrewTotal = (leaderProfile: typeof profiles[0], totalsMap: Map<string, number>) => {
        const leaderVal = totalsMap.get(leaderProfile.user_id) || 0;
        const descendantIds = getDescendantUserIds(leaderProfile.id);
        const descendantVal = descendantIds.reduce((sum, uid) => sum + (totalsMap.get(uid) || 0), 0);
        return leaderVal + descendantVal;
      };

      const calcCrewSellerCount = (leaderProfile: typeof profiles[0], salesCounts: Map<string, number>) => {
        const descendantIds = getDescendantUserIds(leaderProfile.id);
        const allIds = [leaderProfile.user_id, ...descendantIds];
        return allIds.filter((uid) => (salesCounts.get(uid) || 0) > 0).length;
      };

      const roleSet = new Map(roles.map((r) => [r.user_id, r.role]));
      // Only leaders for crew rankings — managers excluded
      const leadersOnly = profiles.filter((p) => {
        const role = roleSet.get(p.user_id);
        return role === "leader";
      });

      // Current week crew profit (Total Wire) + avg (Rep Profit)
      const crewEntries: CrewProfitEntry[] = leadersOnly.map((p) => {
        const hasTeam = (childrenMap.get(p.id) || []).length > 0;
        const crewWire = +(calcCrewTotal(p, userWireTotals)).toFixed(2);
        const crewRepProfit = +(calcCrewTotal(p, userRepProfit)).toFixed(2);
        const sellerCount = calcCrewSellerCount(p, userSalesCounts);
        return {
          userId: p.user_id,
          name: p.full_name,
          crewName: p.crew_name || "",
          crewWire,
          crewRepProfit,
          crewSalesCount: 0,
          avgRepProfitPerSeller: sellerCount > 0 ? +(crewRepProfit / sellerCount).toFixed(2) : 0,
          rank: 0,
          hasTeam,
        };
      }).sort((a, b) => b.crewWire - a.crewWire);

      let crewRank = 1;
      crewEntries.forEach((entry, i) => {
        if (i > 0 && entry.crewWire < crewEntries[i - 1].crewWire) {
          crewRank = i + 1;
        }
        entry.rank = crewRank;
      });

      setCrewProfitRanking(crewEntries);

      // Average Rep Profit Per Agent ranking
      const avgRanked = [...crewEntries]
        .sort((a, b) => b.avgRepProfitPerSeller - a.avgRepProfitPerSeller)
        .map((entry, i, arr) => {
          let rank = 1;
          if (i > 0 && entry.avgRepProfitPerSeller < arr[i - 1].avgRepProfitPerSeller) {
            rank = i + 1;
          } else if (i > 0) {
            rank = arr[i - 1].rank;
          }
          return { ...entry, rank };
        });
      setCrewAvgProfitRanking(avgRanked);

      // All-time records
      if (allTx.length > 0) {
        const dates = allTx.map((t) => t.date).sort();
        const earliest = new Date(dates[0]);
        const latest = new Date(dates[dates.length - 1]);

        const weeklyIndividualRecords: { userId: string; repProfit: number; weekStart: Date }[] = [];
        const crewWeeklyRecords: { userId: string; name: string; crewName: string; crewWire: number; weekStart: Date }[] = [];

        let ws = startOfWeek(earliest, { weekStartsOn: 1 });

        while (ws <= latest) {
          const wsS = format(ws, "yyyy-MM-dd");
          const weS = format(endOfWeek(ws, { weekStartsOn: 1 }), "yyyy-MM-dd");

          const weekEntries = allTx.filter((t) => t.date >= wsS && t.date <= weS);

          const userWeekRepProfit = new Map<string, number>();
          const userWeekWire = new Map<string, number>();
          weekEntries.forEach((t) => {
            userWeekRepProfit.set(t.user_id, (userWeekRepProfit.get(t.user_id) || 0) + Number(t.isa_upfront));
            userWeekWire.set(t.user_id, (userWeekWire.get(t.user_id) || 0) + Number(t.total_wire));
          });

          // Individual all-time: Rep Profit (isa_upfront) — exclude managers
          userWeekRepProfit.forEach((rp, userId) => {
            if (rp > 0 && !managerIds.has(userId)) {
              weeklyIndividualRecords.push({ userId, repProfit: +rp.toFixed(2), weekStart: ws });
            }
          });

          // Crew all-time: Total Wire — leaders only
          const currentWs = ws;
          leadersOnly.forEach((p) => {
            const total = calcCrewTotal(p, userWeekWire);
            if (total > 0) {
              crewWeeklyRecords.push({ userId: p.user_id, name: p.full_name, crewName: p.crew_name || "", crewWire: +total.toFixed(2), weekStart: currentWs });
            }
          });

          ws = addDays(ws, 7);
        }

        // Individual all-time top 5 by Rep Profit
        weeklyIndividualRecords.sort((a, b) => b.repProfit - a.repProfit);
        const top5 = weeklyIndividualRecords.slice(0, 5);
        let rank = 1;
        const ranked: AllTimeProfitRecord[] = top5.map((r, i) => {
          if (i > 0 && r.repProfit < top5[i - 1].repProfit) rank = i + 1;
          const prof = profileMap.get(r.userId);
          return {
            name: prof?.full_name || "Unknown",
            repProfit: r.repProfit,
            weekCommencing: format(r.weekStart, "d MMM yyyy"),
            rank,
          };
        });
        setAllTimeProfitRecords(ranked);

        // Crew all-time top 5 by Total Wire
        crewWeeklyRecords.sort((a, b) => b.crewWire - a.crewWire);
        const crewTop5 = crewWeeklyRecords.slice(0, 5);
        let crewRecRank = 1;
        const crewRanked: AllTimeCrewProfitRecord[] = crewTop5.map((r, i) => {
          if (i > 0 && r.crewWire < crewTop5[i - 1].crewWire) crewRecRank = i + 1;
          return {
            name: r.name,
            crewName: r.crewName,
            crewWire: r.crewWire,
            weekCommencing: format(r.weekStart, "d MMM yyyy"),
            rank: crewRecRank,
          };
        });
        setAllTimeCrewProfitRecords(crewRanked);
      }
    }
    if (sharedProfiles.length > 0) fetchProfitData();
  }, [wsStr, weStr, sharedProfiles]);

  const metricRankings = useMemo(() => {
    const map: Record<Metric, (LeaderboardEntry & { rank: number })[]> = {} as any;
    METRICS.forEach((m) => {
      const sorted = [...entries].sort((a, b) => b[m.key] - a[m.key]);
      // Apply standard competition ranking (1, 1, 3, ...)
      let currentRank = 1;
      const ranked = sorted.map((entry, i) => {
        if (i > 0 && entry[m.key] < sorted[i - 1][m.key]) {
          currentRank = i + 1;
        }
        return { ...entry, rank: currentRank };
      });
      map[m.key] = ranked;
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

  const topProfitRecord = allTimeProfitRecords.length > 0 ? allTimeProfitRecords[0] : null;

  if (profilesLoading || !dataLoaded) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted/30 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===== SECTION 1 — PROFIT THIS WEEK ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          <PoundSterling className="w-5 h-5" style={{ color: "hsl(0 70% 50%)" }} />
          <h2 className="text-base font-bold text-foreground tracking-tight uppercase">Profit — This Week</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Top Individual Profit */}
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><PoundSterling className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} /></div>
              <span className="text-xs font-medium text-muted-foreground">Top Individual Profit</span>
            </div>
            <div className="divide-y divide-border/30">
              {profitRanking.map((entry) => {
                const isMe = entry.userId === user?.id;
                const isFirst = entry.rank === 1 && entry.repProfit > 0;
                const medalColor = entry.rank === 1 && entry.repProfit > 0 ? "#FFD700" : entry.rank === 2 && entry.repProfit > 0 ? "#C0C0C0" : entry.rank === 3 && entry.repProfit > 0 ? "#CD7F32" : null;
                return (
                  <div key={entry.userId} className={`flex items-center justify-between py-2 px-2 rounded-md ${isFirst ? "bg-red-500/10 border border-red-500/15" : ""} ${isMe && !isFirst ? "bg-muted/30" : ""}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {medalColor ? <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} /> : <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{entry.rank}</span>}
                      <span className="text-[11px] font-mono text-muted-foreground w-8 flex-shrink-0">{entry.rank}{getRankSuffix(entry.rank)}</span>
                      <span className={`text-xs truncate ${isFirst ? "font-semibold text-foreground" : isMe ? "font-medium text-foreground" : "text-muted-foreground"}`}>{entry.name}{isMe ? " ●" : ""}</span>
                    </div>
                    <span className={`text-xs font-mono flex-shrink-0 ml-2 ${isFirst ? "font-bold" : "text-muted-foreground"}`} style={isFirst ? { color: "hsl(0 70% 50%)" } : {}}>£{entry.repProfit.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Crew Profit */}
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><Trophy className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} /></div>
              <span className="text-xs font-medium text-muted-foreground">Top Crew Profit</span>
            </div>
            {crewProfitRanking.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No leaders/managers yet</p>
            ) : (
              <div className="divide-y divide-border/30">
                {crewProfitRanking.map((entry) => {
                  const isMe = entry.userId === user?.id;
                  const isFirst = entry.rank === 1 && entry.crewWire > 0;
                  const medalColor = entry.rank === 1 && entry.crewWire > 0 ? "#FFD700" : entry.rank === 2 && entry.crewWire > 0 ? "#C0C0C0" : entry.rank === 3 && entry.crewWire > 0 ? "#CD7F32" : null;
                  const crewDisplayName = formatCrewDisplayName(entry.name, entry.crewName);
                  return (
                    <div key={entry.userId} className={`flex items-center justify-between py-2 px-2 rounded-md ${isFirst ? "bg-red-500/10 border border-red-500/15" : ""} ${isMe && !isFirst ? "bg-muted/30" : ""}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {medalColor ? <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} /> : <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{entry.rank}</span>}
                        <span className="text-[11px] font-mono text-muted-foreground w-8 flex-shrink-0">{entry.rank}{getRankSuffix(entry.rank)}</span>
                        <div className="min-w-0">
                          <span className={`text-xs truncate block ${isFirst ? "font-semibold text-foreground" : isMe ? "font-medium text-foreground" : "text-muted-foreground"}`}>{crewDisplayName}{isMe ? " ●" : ""}</span>
                          {!entry.hasTeam && <span className="text-[10px] text-muted-foreground">No crew yet</span>}
                        </div>
                      </div>
                      <span className={`text-xs font-mono flex-shrink-0 ml-2 ${isFirst ? "font-bold" : "text-muted-foreground"}`} style={isFirst ? { color: "hsl(0 70% 50%)" } : {}}>£{entry.crewWire.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Average Profit Per Agent */}
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-muted-foreground"><Users className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} /></div>
            <span className="text-xs font-medium text-muted-foreground">Average Profit Per Agent</span>
          </div>
          {crewAvgProfitRanking.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No leaders/managers yet</p>
          ) : (
            <div className="divide-y divide-border/30">
              {crewAvgProfitRanking.map((entry) => {
                const isMe = entry.userId === user?.id;
                const isFirst = entry.rank === 1 && entry.avgRepProfitPerSeller > 0;
                const medalColor = entry.rank === 1 && entry.avgRepProfitPerSeller > 0 ? "#FFD700" : entry.rank === 2 && entry.avgRepProfitPerSeller > 0 ? "#C0C0C0" : entry.rank === 3 && entry.avgRepProfitPerSeller > 0 ? "#CD7F32" : null;
                const crewDisplayName = formatCrewDisplayName(entry.name, entry.crewName);
                return (
                  <div key={entry.userId} className={`flex items-center justify-between py-2 px-2 rounded-md ${isFirst ? "bg-red-500/10 border border-red-500/15" : ""} ${isMe && !isFirst ? "bg-muted/30" : ""}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {medalColor ? <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} /> : <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{entry.rank}</span>}
                      <span className="text-[11px] font-mono text-muted-foreground w-8 flex-shrink-0">{entry.rank}{getRankSuffix(entry.rank)}</span>
                      <span className={`text-xs truncate ${isFirst ? "font-semibold text-foreground" : isMe ? "font-medium text-foreground" : "text-muted-foreground"}`}>{crewDisplayName}{isMe ? " ●" : ""}</span>
                    </div>
                    <span className={`text-xs font-mono flex-shrink-0 ml-2 ${isFirst ? "font-bold" : "text-muted-foreground"}`} style={isFirst ? { color: "hsl(0 70% 50%)" } : {}}>
                      {entry.avgRepProfitPerSeller > 0 ? `£${entry.avgRepProfitPerSeller.toFixed(2)}` : "–"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===== SECTION 2 — PROFIT RECORDS ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          <Trophy className="w-5 h-5" style={{ color: "hsl(0 70% 50%)" }} />
          <h2 className="text-base font-bold text-foreground tracking-tight uppercase">Profit Records</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* All Time Weekly Individual Profit Record */}
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><Trophy className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} /></div>
              <span className="text-xs font-medium text-muted-foreground">All Time Weekly Individual Profit Record</span>
            </div>
            {!topProfitRecord ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-1">
                {allTimeProfitRecords.map((record, i) => {
                  const medalColor = record.rank === 1 ? "#FFD700" : record.rank === 2 ? "#C0C0C0" : record.rank === 3 ? "#CD7F32" : null;
                  return (
                    <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${record.rank === 1 ? "bg-red-500/10" : ""}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {medalColor ? <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} /> : <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{record.rank}</span>}
                        <div className="min-w-0">
                          <span className={`text-xs truncate block ${record.rank === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{record.name}</span>
                          <span className="text-[10px] text-muted-foreground">w/c {record.weekCommencing}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-mono flex-shrink-0 ml-2 ${record.rank === 1 ? "font-bold" : "text-muted-foreground"}`} style={record.rank === 1 ? { color: "hsl(0 70% 50%)" } : {}}>£{record.repProfit.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All Time Weekly Crew Profit Record */}
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><Trophy className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} /></div>
              <span className="text-xs font-medium text-muted-foreground">All Time Weekly Crew Profit Record</span>
            </div>
            {allTimeCrewProfitRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-1">
                {allTimeCrewProfitRecords.map((record, i) => {
                  const medalColor = record.rank === 1 ? "#FFD700" : record.rank === 2 ? "#C0C0C0" : record.rank === 3 ? "#CD7F32" : null;
                  const crewDisplayName = formatCrewDisplayName(record.name, record.crewName);
                  return (
                    <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${record.rank === 1 ? "bg-red-500/10" : ""}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {medalColor ? <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} /> : <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{record.rank}</span>}
                        <div className="min-w-0">
                          <span className={`text-xs truncate block ${record.rank === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{crewDisplayName}</span>
                          <span className="text-[10px] text-muted-foreground">w/c {record.weekCommencing}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-mono flex-shrink-0 ml-2 ${record.rank === 1 ? "font-bold" : "text-muted-foreground"}`} style={record.rank === 1 ? { color: "hsl(0 70% 50%)" } : {}}>£{record.crewWire.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

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
                    {ranked.map((entry) => {
                      const medalColor = entry.rank === 1 && entry[m.key] > 0 ? "#FFD700" : entry.rank === 2 && entry[m.key] > 0 ? "#C0C0C0" : entry.rank === 3 && entry[m.key] > 0 ? "#CD7F32" : null;
                      return (
                      <div key={entry.profileId} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${entry.rank === 1 && entry[m.key] > 0 ? "bg-primary/10" : ""}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {medalColor ? (
                            <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: medalColor }} />
                          ) : (
                            <span className="text-[10px] font-mono font-bold w-3.5 text-center flex-shrink-0 text-muted-foreground">{entry.rank}</span>
                          )}
                          <span className={`text-xs truncate ${entry.rank === 1 && entry[m.key] > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{displayName(entry)}</span>
                        </div>
                        <span className={`text-xs font-mono flex-shrink-0 ml-2 ${entry.rank === 1 && entry[m.key] > 0 ? "font-bold text-primary" : "text-muted-foreground"}`}>{entry[m.key]}{m.suffix ?? ""}</span>
                      </div>
                      );
                    })}
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
