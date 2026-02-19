import { useState, useMemo } from "react";
import { useLinkedIn } from "@/hooks/useLinkedIn";
import { TrendRange, TREND_OPTIONS } from "@/components/pipeline/PipelineAnalytics";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Plus, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LinkedInDashboardProps {
  trendRange: TrendRange;
}

export function LinkedInDashboard({ trendRange }: LinkedInDashboardProps) {
  const { activities, adUploads, cvDownloads, loading, logActivity, logCvDownload } = useLinkedIn();

  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [cvModalAdId, setCvModalAdId] = useState("");
  const [cvModalCount, setCvModalCount] = useState("1");

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

  const cutoffDate = useMemo(() => {
    const option = TREND_OPTIONS.find((o) => o.value === trendRange)!;
    if (trendRange === "all") return null;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - option.weeks * 7);
    return cutoff;
  }, [trendRange]);

  const filteredAdUploads = useMemo(() => {
    if (!cutoffDate) return adUploads;
    return adUploads.filter((a) => new Date(a.date) >= cutoffDate);
  }, [adUploads, cutoffDate]);

  const filteredCVDownloads = useMemo(() => {
    const adIds = new Set(filteredAdUploads.map((a) => a.id));
    return cvDownloads.filter((cv) => adIds.has(cv.adUploadId));
  }, [cvDownloads, filteredAdUploads]);

  const cvsPerAdDate = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCVDownloads.forEach((cv) => {
      const ad = adUploads.find((a) => a.id === cv.adUploadId);
      if (ad) map[ad.date] = (map[ad.date] || 0) + cv.count;
    });
    return map;
  }, [filteredCVDownloads, adUploads]);

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
        return { week: name, free: activity?.freeAdsUploaded ?? 0, paid: activity?.paidAdsUploaded ?? 0, cvs: cvsPerAdDate[key] ?? 0, attending: activity?.candidatesAttending2ndRound ?? 0, hasAd };
      });
    }
    const weeks: Record<string, any> = {};
    filteredActivities.forEach((a) => {
      const d = new Date(a.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = { week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, free: 0, paid: 0, cvs: 0, attending: 0, hasAd: false };
      weeks[key].free += a.freeAdsUploaded;
      weeks[key].paid += a.paidAdsUploaded;
      weeks[key].attending += a.candidatesAttending2ndRound;
    });
    Object.entries(cvsPerAdDate).forEach(([adDate, count]) => {
      const d = new Date(adDate);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().split("T")[0];
      if (weeks[key]) weeks[key].cvs += count;
      else weeks[key] = { week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, free: 0, paid: 0, cvs: count, attending: 0, hasAd: false };
    });
    return Object.values(weeks);
  }, [filteredActivities, isThisWeek, cvsPerAdDate]);

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
        return { period: name, cvs: cvsPerAdDate[key] ?? 0, interviews: activity?.candidatesAttending2ndRound ?? 0 };
      });
    }
    const weeks: Record<string, any> = {};
    filteredActivities.forEach((a) => {
      const d = new Date(a.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = { period: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, cvs: 0, interviews: 0 };
      weeks[key].interviews += a.candidatesAttending2ndRound;
    });
    Object.entries(cvsPerAdDate).forEach(([adDate, count]) => {
      const d = new Date(adDate);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().split("T")[0];
      if (weeks[key]) weeks[key].cvs += count;
      else weeks[key] = { period: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, cvs: count, interviews: 0 };
    });
    return Object.values(weeks);
  }, [filteredActivities, isThisWeek, cvsPerAdDate]);

  const bestDays = useMemo(() => {
    const dayTotals: Record<number, number> = {};
    Object.entries(cvsPerAdDate).forEach(([dateStr, count]) => {
      const day = new Date(dateStr).getDay();
      dayTotals[day] = (dayTotals[day] || 0) + count;
    });
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let maxCvs = 0;
    Object.values(dayTotals).forEach((total) => { if (total > maxCvs) maxCvs = total; });
    if (maxCvs === 0) return { days: "N/A", total: 0 };
    const winners = Object.entries(dayTotals).filter(([, total]) => total === maxCvs).map(([d]) => dayNames[Number(d)]);
    return { days: winners.join(" & "), total: maxCvs };
  }, [cvsPerAdDate]);

  const totalAttributedCVs = useMemo(() => filteredCVDownloads.reduce((s, cv) => s + cv.count, 0), [filteredCVDownloads]);

  const totals = useMemo(() => ({
    freeAds: filteredActivities.reduce((s, a) => s + a.freeAdsUploaded, 0),
    paidAds: filteredActivities.reduce((s, a) => s + a.paidAdsUploaded, 0),
    cvs: totalAttributedCVs,
    attending: filteredActivities.reduce((s, a) => s + a.candidatesAttending2ndRound, 0),
  }), [filteredActivities, totalAttributedCVs]);

  const availableAds = useMemo(() => [...adUploads].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30), [adUploads]);

  const handleQuickAdd = async (type: string) => {
    if (type === "cv") {
      setCvModalOpen(true);
      setCvModalAdId("");
      setCvModalCount("1");
      return;
    }
    if (type === "free" || type === "paid" || type === "attend") {
      await logActivity(type as "free" | "paid" | "attend");
    }
  };

  const handleCvSubmit = async () => {
    if (!cvModalAdId || !cvModalCount) return;
    const count = parseInt(cvModalCount, 10);
    if (isNaN(count) || count <= 0) return;
    await logCvDownload(cvModalAdId, count);
    setCvModalOpen(false);
  };

  const tooltipStyle = {
    background: "hsl(222 44% 8%)",
    border: "1px solid hsl(222 30% 16%)",
    borderRadius: "8px",
    fontSize: "12px",
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading LinkedIn data...</div>;
  }

  return (
    <div className="space-y-4">
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
            <button key={type} onClick={() => handleQuickAdd(type)} className="flex items-center gap-2 p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors text-left min-w-0">
              <span className="text-lg">{icon}</span>
              <span className="text-xs text-muted-foreground leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={cvModalOpen} onOpenChange={setCvModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log CV Downloads</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Which ad are these CVs from?</Label>
              <Select value={cvModalAdId} onValueChange={setCvModalAdId}>
                <SelectTrigger><SelectValue placeholder="Select an ad upload..." /></SelectTrigger>
                <SelectContent>
                  {availableAds.map((ad) => (
                    <SelectItem key={ad.id} value={ad.id}>{ad.date} — {ad.type === "free" ? "📢 Free" : "💰 Paid"} Ad</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of CVs downloaded</Label>
              <Input type="number" min="1" value={cvModalCount} onChange={(e) => setCvModalCount(e.target.value)} />
            </div>
            <Button onClick={handleCvSubmit} disabled={!cvModalAdId} className="w-full">Log CVs</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Free Ads (${rangeLabel})`, value: totals.freeAds, color: "text-chart-1" },
          { label: `Paid Ads (${rangeLabel})`, value: totals.paidAds, color: "text-chart-2" },
          { label: `CVs Attributed (${rangeLabel})`, value: totals.cvs, color: "text-chart-4" },
          { label: `Attending 2nd Round (${rangeLabel})`, value: totals.attending, color: "text-chart-5" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">Free vs Paid Ads ({isThisWeek ? "Daily" : "Weekly"})</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="free" name="Free" stroke="hsl(172 66% 50%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="paid" name="Paid" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            CVs (by Ad Date) vs 2nd Round — Correlation ({isThisWeek ? "Daily" : "Weekly"})
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={correlationData}>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="cvs" name="CVs (Ad Date)" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(38 92% 50%)", stroke: "hsl(222 47% 6%)", strokeWidth: 1 }} />
              <Line type="monotone" dataKey="interviews" name="2nd Round Interviews" stroke="hsl(280 70% 60%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(280 70% 60%)", stroke: "hsl(222 47% 6%)", strokeWidth: 1 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel p-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">Performance Insights</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/20 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Best Day to Upload</p>
            <p className="text-sm font-semibold text-foreground">{bestDays.days}</p>
            <p className="text-[10px] text-muted-foreground">{bestDays.total} CVs attributed</p>
          </div>
          <div className="bg-muted/20 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Free vs Paid Ratio</p>
            <p className="text-sm font-semibold text-foreground">
              {totals.freeAds > 0 || totals.paidAds > 0 ? `${totals.freeAds} : ${totals.paidAds}` : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
