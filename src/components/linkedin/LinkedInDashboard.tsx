import { useState, useMemo } from "react";
import { mockLinkedInActivity } from "@/lib/mock-data";
import { LinkedInActivity } from "@/lib/types";
import { TrendRange, TREND_OPTIONS } from "@/components/pipeline/PipelineAnalytics";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Plus, TrendingUp, BarChart3, Calendar, Upload, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LinkedInDashboardProps {
  startEmpty?: boolean;
  trendRange: TrendRange;
}

export function LinkedInDashboard({ startEmpty = false, trendRange }: LinkedInDashboardProps) {
  const [activities, setActivities] = useState<LinkedInActivity[]>(startEmpty ? [] : mockLinkedInActivity);

  // Filter activities by selected time range
  const filteredActivities = useMemo(() => {
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    if (trendRange === "all") return activities;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - option.weeks * 7);
    return activities.filter((a) => new Date(a.date) >= cutoff);
  }, [activities, trendRange]);

  const rangeLabel = TREND_OPTIONS.find((o) => o.value === trendRange)?.label ?? "";

  const isThisWeek = trendRange === "this-week";

  // Chart data — daily for "This Week", weekly aggregation otherwise
  const chartData = useMemo(() => {
    if (isThisWeek) {
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek) - 1));
      monday.setHours(0, 0, 0, 0);

      return dayNames.map((name, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const key = date.toISOString().split("T")[0];
        const activity = filteredActivities.find((a) => a.date === key);
        const hasAd = activity ? (activity.freeAdsUploaded + activity.paidAdsUploaded) > 0 : false;
        return {
          week: name,
          free: activity?.freeAdsUploaded ?? 0,
          paid: activity?.paidAdsUploaded ?? 0,
          cvs: activity?.cvsDownloaded ?? 0,
          attending: activity?.candidatesAttending2ndRound ?? 0,
          hasAd,
        };
      });
    }

    const weeks: Record<string, { week: string; free: number; paid: number; cvs: number; attending: number; hasAd: boolean }> = {};
    filteredActivities.forEach((a) => {
      const d = new Date(a.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = { week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, free: 0, paid: 0, cvs: 0, attending: 0, hasAd: false };
      weeks[key].free += a.freeAdsUploaded;
      weeks[key].paid += a.paidAdsUploaded;
      weeks[key].cvs += a.cvsDownloaded;
      weeks[key].attending += a.candidatesAttending2ndRound;
    });
    return Object.values(weeks);
  }, [filteredActivities, isThisWeek]);

  // Best day analysis — based on TOTAL CVs collected per day, with tie support
  const bestDays = useMemo(() => {
    const dayTotals: Record<number, number> = {};
    filteredActivities.forEach((a) => {
      const day = new Date(a.date).getDay();
      dayTotals[day] = (dayTotals[day] || 0) + a.cvsDownloaded;
    });
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let maxCvs = 0;
    Object.values(dayTotals).forEach((total) => {
      if (total > maxCvs) maxCvs = total;
    });
    if (maxCvs === 0) return { days: "N/A", total: 0 };
    const winners = Object.entries(dayTotals)
      .filter(([, total]) => total === maxCvs)
      .map(([d]) => dayNames[Number(d)]);
    return { days: winners.join(" & "), total: maxCvs };
  }, [filteredActivities]);

  // Correlation chart data — CVs vs 2nd Round on same graph
  const correlationData = useMemo(() => {
    if (isThisWeek) {
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek) - 1));
      monday.setHours(0, 0, 0, 0);
      return dayNames.map((name, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const key = date.toISOString().split("T")[0];
        const activity = filteredActivities.find((a) => a.date === key);
        return {
          period: name,
          cvs: activity?.cvsDownloaded ?? 0,
          interviews: activity?.candidatesAttending2ndRound ?? 0,
        };
      });
    }
    const weeks: Record<string, { period: string; cvs: number; interviews: number }> = {};
    filteredActivities.forEach((a) => {
      const d = new Date(a.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = { period: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, cvs: 0, interviews: 0 };
      weeks[key].cvs += a.cvsDownloaded;
      weeks[key].interviews += a.candidatesAttending2ndRound;
    });
    return Object.values(weeks);
  }, [filteredActivities, isThisWeek]);

  // Totals
  const totals = useMemo(() => {
    return {
      freeAds: filteredActivities.reduce((s, a) => s + a.freeAdsUploaded, 0),
      paidAds: filteredActivities.reduce((s, a) => s + a.paidAdsUploaded, 0),
      cvs: filteredActivities.reduce((s, a) => s + a.cvsDownloaded, 0),
      attending: filteredActivities.reduce((s, a) => s + a.candidatesAttending2ndRound, 0),
    };
  }, [filteredActivities]);

  const handleQuickAdd = (type: string) => {
    const today = new Date().toISOString().split("T")[0];
    setActivities((prev) => {
      const existing = prev.find((a) => a.date === today);
      if (existing) {
        return prev.map((a) =>
          a.date === today
            ? {
                ...a,
                freeAdsUploaded: type === "free" ? a.freeAdsUploaded + 1 : a.freeAdsUploaded,
                paidAdsUploaded: type === "paid" ? a.paidAdsUploaded + 1 : a.paidAdsUploaded,
                cvsDownloaded: type === "cv" ? a.cvsDownloaded + 1 : a.cvsDownloaded,
                candidatesAttending2ndRound: type === "attend" ? a.candidatesAttending2ndRound + 1 : a.candidatesAttending2ndRound,
              }
            : a
        );
      }
      return [
        ...prev,
        {
          id: `la-new-${Date.now()}`,
          date: today,
          freeAdsUploaded: type === "free" ? 1 : 0,
          paidAdsUploaded: type === "paid" ? 1 : 0,
          cvsDownloaded: type === "cv" ? 1 : 0,
          candidatesAttending2ndRound: type === "attend" ? 1 : 0,
        },
      ];
    });
  };

  const tooltipStyle = {
    background: "hsl(222 44% 8%)",
    border: "1px solid hsl(222 30% 16%)",
    borderRadius: "8px",
    fontSize: "12px",
  };

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Quick Log Activity
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { type: "free", label: "Free Ad Uploaded", icon: "📢" },
            { type: "paid", label: "Paid Ad Uploaded", icon: "💰" },
            { type: "cv", label: "CV Downloaded", icon: "📄" },
            { type: "attend", label: "2nd Round from LinkedIn", icon: "👤" },
          ].map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => handleQuickAdd(type)}
              className="flex items-center gap-2 p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors text-left min-w-0"
            >
              <span className="text-lg">{icon}</span>
              <span className="text-xs text-muted-foreground leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Free Ads (${rangeLabel})`, value: totals.freeAds, color: "text-chart-1" },
          { label: `Paid Ads (${rangeLabel})`, value: totals.paidAds, color: "text-chart-2" },
          { label: `CVs Downloaded (${rangeLabel})`, value: totals.cvs, color: "text-chart-4" },
          { label: `Attending 2nd Round (${rangeLabel})`, value: totals.attending, color: "text-chart-5" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Free vs Paid */}
        <div className="glass-panel p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">
            Free vs Paid Ads ({isThisWeek ? "Daily" : "Weekly"})
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="free" name="Free" stroke="hsl(172 66% 50%)" strokeWidth={2} dot={isThisWeek ? (props: any) => {
                const { cx, cy, payload } = props;
                if (!payload.hasAd) return null;
                return <circle cx={cx} cy={cy} r={5} fill="hsl(172 66% 50%)" stroke="hsl(222 47% 6%)" strokeWidth={2} />;
              } : false} />
              <Line type="monotone" dataKey="paid" name="Paid" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={isThisWeek ? (props: any) => {
                const { cx, cy, payload } = props;
                if (!payload.hasAd) return null;
                return <circle cx={cx} cy={cy} r={5} fill="hsl(217 91% 60%)" stroke="hsl(222 47% 6%)" strokeWidth={2} />;
              } : false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CV vs 2nd Round Correlation Graph */}
        <div className="glass-panel p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            CV Downloads vs 2nd Round Interviews — Trend Correlation ({isThisWeek ? "Daily" : "Weekly"})
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={correlationData}>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="cvs" name="CVs Downloaded" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(38 92% 50%)", stroke: "hsl(222 47% 6%)", strokeWidth: 1 }} />
              <Line type="monotone" dataKey="interviews" name="2nd Round Interviews" stroke="hsl(280 70% 60%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(280 70% 60%)", stroke: "hsl(222 47% 6%)", strokeWidth: 1 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Best day & trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-medium text-muted-foreground">Best Day for CVs</h4>
          </div>
          <p className="text-3xl font-bold text-foreground">{bestDays.days}</p>
          <p className="text-xs text-muted-foreground mt-1">{bestDays.total} total CVs collected</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-medium text-muted-foreground">LinkedIn to 2nd Round Rate</h4>
          </div>
          <p className="text-3xl font-bold text-foreground font-mono">
            {totals.cvs > 0 ? Math.round((totals.attending / totals.cvs) * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{rangeLabel} conversion</p>
        </div>
      </div>
    </div>
  );
}
