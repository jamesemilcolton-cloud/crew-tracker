import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Users, Upload, FileText, UserCheck, Crown } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
}

interface LeaderboardEntry {
  profileId: string;
  name: string;
  adsUploaded: number;
  cvsDownloaded: number;
  secondRoundsLinkedIn: number;
  totalSecondRounds: number;
  interviewToStartPct: number;
  startToPromotionPct: number;
  activeTeamSize: number;
}

type Metric = keyof Omit<LeaderboardEntry, "profileId" | "name">;

const METRICS: { key: Metric; label: string; icon: React.ReactNode; suffix?: string }[] = [
  { key: "adsUploaded", label: "Ads Uploaded", icon: <Upload className="w-4 h-4" /> },
  { key: "cvsDownloaded", label: "CVs Downloaded", icon: <FileText className="w-4 h-4" /> },
  { key: "secondRoundsLinkedIn", label: "2nd Rounds (LinkedIn)", icon: <UserCheck className="w-4 h-4" /> },
  { key: "totalSecondRounds", label: "Total 2nd Rounds", icon: <Users className="w-4 h-4" /> },
  { key: "interviewToStartPct", label: "Retention %", icon: <TrendingUp className="w-4 h-4" />, suffix: "%" },
  { key: "startToPromotionPct", label: "Promotion %", icon: <TrendingUp className="w-4 h-4" />, suffix: "%" },
  { key: "activeTeamSize", label: "Active Team", icon: <Users className="w-4 h-4" /> },
];

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);

  useEffect(() => {
    async function fetchData() {
      const [profilesRes, candidatesRes, activityRes, adsRes, cvsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("candidates").select("*"),
        supabase.from("linkedin_activity").select("*"),
        supabase.from("ad_uploads").select("*"),
        supabase.from("cv_downloads").select("*"),
      ]);

      const profiles: Profile[] = profilesRes.data ?? [];
      const candidates = candidatesRes.data ?? [];
      const activities = activityRes.data ?? [];
      const ads = adsRes.data ?? [];
      const cvs = cvsRes.data ?? [];

      const START_FORWARD = ["start", "bell", "promoted"];

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

  // For each metric, get sorted rankings
  const metricRankings = useMemo(() => {
    const map: Record<Metric, LeaderboardEntry[]> = {} as any;
    METRICS.forEach((m) => {
      map[m.key] = [...entries].sort((a, b) => b[m.key] - a[m.key]);
    });
    return map;
  }, [entries]);

  const selectedConfig = selectedMetric ? METRICS.find((m) => m.key === selectedMetric) : null;
  const selectedRankings = selectedMetric ? metricRankings[selectedMetric] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Leaderboard</h3>
          {selectedMetric && (
            <button
              onClick={() => setSelectedMetric(null)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to overview
            </button>
          )}
        </div>
      </div>

      {!selectedMetric ? (
        /* Metric grid */
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {METRICS.map((m) => {
            const ranked = metricRankings[m.key];
            const leader = ranked[0];
            const runnerUp = ranked[1];

            return (
              <button
                key={m.key}
                onClick={() => setSelectedMetric(m.key)}
                className="glass-panel p-4 text-left hover:border-primary/40 hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.2)] transition-all duration-200 group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-muted-foreground group-hover:text-primary transition-colors">
                    {m.icon}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {m.label}
                  </span>
                </div>

                {leader ? (
                  <div className="space-y-2">
                    {/* #1 */}
                    <div className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-sm font-semibold text-foreground truncate">{leader.name}</span>
                      <span className="text-sm font-mono font-bold text-primary ml-auto flex-shrink-0">
                        {leader[m.key]}{m.suffix ?? ""}
                      </span>
                    </div>
                    {/* #2 */}
                    {runnerUp && (
                      <div className="flex items-center gap-2 opacity-60">
                        <span className="text-[10px] font-mono text-muted-foreground w-3.5 text-center flex-shrink-0">#2</span>
                        <span className="text-xs text-muted-foreground truncate">{runnerUp.name}</span>
                        <span className="text-xs font-mono text-muted-foreground ml-auto flex-shrink-0">
                          {runnerUp[m.key]}{m.suffix ?? ""}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Expanded metric rankings */
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-4">
            {selectedConfig?.icon}
            <h4 className="text-sm font-medium text-foreground">{selectedConfig?.label}</h4>
          </div>

          <div className="space-y-1.5">
            {selectedRankings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No recruiters yet.</p>
            )}
            {selectedRankings.map((entry, i) => (
              <div
                key={entry.profileId}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  i === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  {i === 0 ? (
                    <Crown className="w-4 h-4 text-primary" />
                  ) : (
                    <span className={`text-sm font-mono font-bold w-4 text-center ${
                      i === 1 ? "text-chart-4" : i === 2 ? "text-chart-2" : "text-muted-foreground"
                    }`}>
                      {i + 1}
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground">{entry.name}</span>
                </div>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {entry[selectedMetric!]}{selectedConfig?.suffix ?? ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
