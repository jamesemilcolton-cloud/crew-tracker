import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Users, Upload, FileText, UserCheck } from "lucide-react";

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
  { key: "adsUploaded", label: "Ads Uploaded", icon: <Upload className="w-3.5 h-3.5" /> },
  { key: "cvsDownloaded", label: "CVs Downloaded", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "secondRoundsLinkedIn", label: "2nd Rounds (LinkedIn)", icon: <UserCheck className="w-3.5 h-3.5" /> },
  { key: "totalSecondRounds", label: "Total 2nd Rounds", icon: <Users className="w-3.5 h-3.5" /> },
  { key: "interviewToStartPct", label: "Interview → Start %", icon: <TrendingUp className="w-3.5 h-3.5" />, suffix: "%" },
  { key: "startToPromotionPct", label: "Start → Promotion %", icon: <TrendingUp className="w-3.5 h-3.5" />, suffix: "%" },
  { key: "activeTeamSize", label: "Active Team Size", icon: <Users className="w-3.5 h-3.5" /> },
];

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [activeMetric, setActiveMetric] = useState<Metric>("adsUploaded");

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

        const totalInterviews = userCandidates.length; // all entered at 2nd round
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

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => b[activeMetric] - a[activeMetric]);
  }, [entries, activeMetric]);

  const currentMetricConfig = METRICS.find((m) => m.key === activeMetric)!;

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Leaderboard</h3>
        </div>

        {/* Metric selector */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeMetric === m.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Rankings */}
        <div className="space-y-1.5">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No recruiters yet. Sign up to get started!</p>
          )}
          {sorted.map((entry, i) => (
            <div
              key={entry.profileId}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                i === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-sm font-mono font-bold ${i === 0 ? "text-primary" : i === 1 ? "text-chart-4" : i === 2 ? "text-chart-2" : "text-muted-foreground"}`}>
                  #{i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{entry.name}</span>
              </div>
              <span className="text-sm font-mono font-semibold text-foreground">
                {entry[activeMetric]}{currentMetricConfig.suffix ?? ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
