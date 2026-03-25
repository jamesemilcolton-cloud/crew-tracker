import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Zap, Clock, ArrowUpDown, ScatterChart as ScatterIcon } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell,
} from "recharts";

interface AdRunRow {
  id: string;
  user_id: string;
  upload_date: string;
  close_date: string | null;
  ad_type: string;
  title_number: number;
  ad_number: number;
}

interface CVDownloadRow {
  ad_upload_id: string;
  count: number;
}

interface RunWithCVs {
  id: string;
  adNumber: number;
  titleNumber: number;
  adType: string;
  duration: number;
  totalCVs: number;
}

export function LinkedInPerformanceIntelligence() {
  const [runs, setRuns] = useState<RunWithCVs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [adRes, cvRes] = await Promise.all([
        supabase.from("ad_uploads").select("*").not("close_date", "is", null),
        supabase.from("cv_downloads").select("ad_upload_id, count"),
      ]);

      const ads = (adRes.data ?? []) as AdRunRow[];
      const cvs = cvRes.data ?? [];

      // Aggregate CVs per ad_upload_id
      const cvMap = new Map<string, number>();
      for (const cv of cvs) {
        cvMap.set(cv.ad_upload_id, (cvMap.get(cv.ad_upload_id) ?? 0) + cv.count);
      }

      const validRuns: RunWithCVs[] = [];
      for (const ad of ads) {
        if (!ad.close_date) continue;
        const duration = Math.floor(
          (new Date(ad.close_date).getTime() - new Date(ad.upload_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (duration < 1) continue;
        const totalCVs = cvMap.get(ad.id) ?? 0;
        if (totalCVs === 0) continue;

        validRuns.push({
          id: ad.id,
          adNumber: (ad as any).ad_number ?? 1,
          titleNumber: (ad as any).title_number ?? 1,
          adType: ad.ad_type,
          duration,
          totalCVs,
        });
      }

      setRuns(validRuns);
      setLoading(false);
    };
    fetchData();
  }, []);

  // 1. Best Ad Number — avg CVs per run
  const adBarData = useMemo(() => {
    const map = new Map<number, { totalCVs: number; count: number }>();
    for (const r of runs) {
      const e = map.get(r.adNumber) ?? { totalCVs: 0, count: 0 };
      e.totalCVs += r.totalCVs;
      e.count += 1;
      map.set(r.adNumber, e);
    }
    return [...map.entries()]
      .map(([adNumber, s]) => ({ name: `Ad ${adNumber}`, avgCVs: Math.round((s.totalCVs / s.count) * 10) / 10 }))
      .sort((a, b) => b.avgCVs - a.avgCVs);
  }, [runs]);

  // 2. Best Title Number — avg CVs per run
  const titleBarData = useMemo(() => {
    const map = new Map<number, { totalCVs: number; count: number }>();
    for (const r of runs) {
      const e = map.get(r.titleNumber) ?? { totalCVs: 0, count: 0 };
      e.totalCVs += r.totalCVs;
      e.count += 1;
      map.set(r.titleNumber, e);
    }
    return [...map.entries()]
      .map(([titleNumber, s]) => ({ name: `Title ${titleNumber}`, avgCVs: Math.round((s.totalCVs / s.count) * 10) / 10 }))
      .sort((a, b) => b.avgCVs - a.avgCVs);
  }, [runs]);

  // 3. Scatter: Duration vs Total CVs
  const scatterData = useMemo(() =>
    runs.map(r => ({ duration: r.duration, cvs: r.totalCVs })),
  [runs]);

  // 4. Top 10 Ad+Title combos by avg CVs per run
  const comboData = useMemo(() => {
    const map = new Map<string, { adNumber: number; titleNumber: number; totalCVs: number; totalDuration: number; count: number }>();
    for (const r of runs) {
      const key = `${r.adNumber}-${r.titleNumber}`;
      const e = map.get(key) ?? { adNumber: r.adNumber, titleNumber: r.titleNumber, totalCVs: 0, totalDuration: 0, count: 0 };
      e.totalCVs += r.totalCVs;
      e.totalDuration += r.duration;
      e.count += 1;
      map.set(key, e);
    }
    return [...map.values()]
      .map(c => ({
        adNumber: c.adNumber,
        titleNumber: c.titleNumber,
        runs: c.count,
        avgDuration: Math.round((c.totalDuration / c.count) * 10) / 10,
        avgCVs: Math.round((c.totalCVs / c.count) * 10) / 10,
      }))
      .sort((a, b) => b.avgCVs - a.avgCVs)
      .slice(0, 15);
  }, [runs]);

  const tooltipStyle = {
    background: "hsl(222 44% 8%)",
    border: "1px solid hsl(222 30% 16%)",
    borderRadius: "8px",
    fontSize: "12px",
  };

  if (loading) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Loading LinkedIn intelligence...</div>;
  }

  if (runs.length === 0) {
    return (
      <Card className="glass-panel">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No closed ad runs with CV data yet. Analytics will appear once recruiters close their ad runs.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Closed Runs", value: runs.length, color: "hsl(210 70% 50%)" },
          { label: "Total CVs", value: runs.reduce((s, r) => s + r.totalCVs, 0), color: "hsl(172 66% 50%)" },
          { label: "Avg CVs/Run", value: Math.round((runs.reduce((s, r) => s + r.totalCVs, 0) / runs.length) * 10) / 10, color: "hsl(38 92% 50%)" },
          { label: "Avg Duration", value: `${Math.round((runs.reduce((s, r) => s + r.duration, 0) / runs.length) * 10) / 10}d`, color: "hsl(270 60% 50%)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold font-mono" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Bar Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Ad Number */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5" style={{ color: "hsl(210 70% 50%)" }} />
              Best Performing Ad Number
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={adBarData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
                <Bar dataKey="avgCVs" name="Avg CVs/Run" fill="hsl(210 70% 50%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Best Title Number */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "hsl(270 60% 50%)" }} />
              Best Performing Title Number
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={titleBarData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} />
                <Bar dataKey="avgCVs" name="Avg CVs/Run" fill="hsl(270 60% 50%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Duration Scatter */}
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <ScatterIcon className="w-3.5 h-3.5" style={{ color: "hsl(38 92% 50%)" }} />
            Duration vs CVs (Optimal Ad Length)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <XAxis dataKey="duration" name="Duration (days)" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} label={{ value: "Days", position: "insideBottomRight", offset: -4, fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <YAxis dataKey="cvs" name="CVs" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} label={{ value: "CVs", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 40% 96%)" }} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={scatterData} fill="hsl(38 92% 50%)">
                {scatterData.map((_, i) => (
                  <Cell key={i} fill="hsl(38 92% 50%)" />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground/60 mt-1 text-center">
            Each dot is one closed ad run. Identify the sweet-spot duration for maximum CV response.
          </p>
        </CardContent>
      </Card>

      {/* Top 10 Combo Table */}
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Zap className="w-3.5 h-3.5" style={{ color: "hsl(38 92% 50%)" }} />
            Top 10 Ad + Title Combinations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comboData.length === 0 ? (
            <p className="text-xs text-muted-foreground">No combination data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead>Avg Duration</TableHead>
                  <TableHead>Avg CVs/Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comboData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">Ad {row.adNumber}</TableCell>
                    <TableCell>Title {row.titleNumber}</TableCell>
                    <TableCell>{row.runs}</TableCell>
                    <TableCell>{row.avgDuration}d</TableCell>
                    <TableCell>
                      <Badge variant={row.avgCVs >= 5 ? "default" : "outline"}>{row.avgCVs}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
