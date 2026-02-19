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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Leaderboard</h3>
        </div>
      </div>

      {/* Metric grid — each box shows full rankings */}
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
                    <div
                      key={entry.profileId}
                      className={`flex items-center justify-between py-1.5 px-2 rounded-md ${
                        i === 0 ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {i === 0 ? (
                          <Crown className="w-3 h-3 text-primary flex-shrink-0" />
                        ) : (
                          <span className={`text-[10px] font-mono font-bold w-3 text-center flex-shrink-0 ${
                            i === 1 ? "text-chart-4" : i === 2 ? "text-chart-2" : "text-muted-foreground"
                          }`}>
                            {i + 1}
                          </span>
                        )}
                        <span className={`text-xs truncate ${i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {entry.name}
                        </span>
                      </div>
                      <span className={`text-xs font-mono flex-shrink-0 ml-2 ${i === 0 ? "font-bold text-primary" : "text-muted-foreground"}`}>
                        {entry[m.key]}{m.suffix ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
