import { useState, useMemo } from "react";
import { mockLinkedInActivity } from "@/lib/mock-data";
import { LinkedInActivity } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Plus, TrendingUp, BarChart3, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LinkedInDashboard() {
  const [activities, setActivities] = useState<LinkedInActivity[]>(mockLinkedInActivity);

  // Weekly aggregation
  const weeklyData = useMemo(() => {
    const weeks: Record<string, { week: string; free: number; paid: number; cvs: number; attending: number }> = {};
    activities.forEach((a) => {
      const d = new Date(a.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = { week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, free: 0, paid: 0, cvs: 0, attending: 0 };
      weeks[key].free += a.freeAdsUploaded;
      weeks[key].paid += a.paidAdsUploaded;
      weeks[key].cvs += a.cvsDownloaded;
      weeks[key].attending += a.candidatesAttending2ndRound;
    });
    return Object.values(weeks);
  }, [activities]);

  // Best day analysis
  const bestDay = useMemo(() => {
    const dayTotals: Record<number, { cvs: number; count: number }> = {};
    activities.forEach((a) => {
      const day = new Date(a.date).getDay();
      if (!dayTotals[day]) dayTotals[day] = { cvs: 0, count: 0 };
      dayTotals[day].cvs += a.cvsDownloaded;
      dayTotals[day].count++;
    });
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let best = { day: "Mon", avg: 0 };
    Object.entries(dayTotals).forEach(([d, v]) => {
      const avg = v.cvs / v.count;
      if (avg > best.avg) best = { day: dayNames[Number(d)], avg };
    });
    return best;
  }, [activities]);

  // Totals
  const totals = useMemo(() => {
    const last7 = activities.slice(-7);
    return {
      freeAds: last7.reduce((s, a) => s + a.freeAdsUploaded, 0),
      paidAds: last7.reduce((s, a) => s + a.paidAdsUploaded, 0),
      cvs: last7.reduce((s, a) => s + a.cvsDownloaded, 0),
      attending: last7.reduce((s, a) => s + a.candidatesAttending2ndRound, 0),
    };
  }, [activities]);

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
            { type: "attend", label: "2nd Round from LI", icon: "👤" },
          ].map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => handleQuickAdd(type)}
              className="flex items-center gap-2 p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors text-left"
            >
              <span className="text-lg">{icon}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Free Ads (7d)", value: totals.freeAds, color: "text-chart-1" },
          { label: "Paid Ads (7d)", value: totals.paidAds, color: "text-chart-2" },
          { label: "CVs Downloaded (7d)", value: totals.cvs, color: "text-chart-4" },
          { label: "Attending 2nd Round (7d)", value: totals.attending, color: "text-chart-5" },
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
          <h4 className="text-xs font-medium text-muted-foreground mb-3">Free vs Paid Ads (Weekly)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="free" name="Free" stroke="hsl(172 66% 50%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="paid" name="Paid" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CVs & Attendance */}
        <div className="glass-panel p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">CVs Downloaded & 2nd Round Attendance (Weekly)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="cvs" name="CVs" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="attending" name="2nd Round" stroke="hsl(152 69% 40%)" strokeWidth={2} dot={false} />
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
          <p className="text-3xl font-bold text-foreground">{bestDay.day}</p>
          <p className="text-xs text-muted-foreground mt-1">{bestDay.avg.toFixed(1)} avg CVs per {bestDay.day}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-medium text-muted-foreground">LinkedIn to 2nd Round Rate</h4>
          </div>
          <p className="text-3xl font-bold text-foreground font-mono">
            {totals.cvs > 0 ? Math.round((totals.attending / totals.cvs) * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Last 7 days conversion</p>
        </div>
      </div>
    </div>
  );
}
