import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Zap, Clock, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdUploadRow {
  id: string;
  user_id: string;
  upload_date: string;
  ad_type: string;
  title_number: number;
  ad_number: number;
}

interface CVDownloadRow {
  id: string;
  user_id: string;
  ad_upload_id: string;
  download_date: string;
  count: number;
}

interface CandidateRow {
  id: string;
  source: string;
  stage: string;
  created_at: string;
}

interface StageHistoryRow {
  candidate_id: string;
  to_stage: string;
  changed_at: string;
}

interface ComboStats {
  adNumber: number;
  titleNumber: number;
  cvs: number;
  obs: number;
  starts: number;
  conversion: number;
}

type SortKey = "starts" | "conversion" | "cvs";

export function LinkedInPerformanceIntelligence() {
  const [adUploads, setAdUploads] = useState<AdUploadRow[]>([]);
  const [cvDownloads, setCvDownloads] = useState<CVDownloadRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [stageHistory, setStageHistory] = useState<StageHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("starts");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [adRes, cvRes, candRes, histRes] = await Promise.all([
        supabase.from("ad_uploads").select("*").order("upload_date"),
        supabase.from("cv_downloads").select("*").order("download_date"),
        supabase.from("candidates").select("id, source, stage, created_at").eq("source", "LinkedIn"),
        supabase.from("candidate_stage_history").select("candidate_id, to_stage, changed_at"),
      ]);

      setAdUploads((adRes.data ?? []) as any[]);
      setCvDownloads(cvRes.data ?? []);
      setCandidates(candRes.data ?? []);
      setStageHistory(histRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Build combo stats: group by ad_number + title_number
  const comboStats = useMemo(() => {
    const comboMap = new Map<string, { adNumber: number; titleNumber: number; cvs: number; adUploadIds: Set<string> }>();

    // Aggregate CVs by ad+title combo
    for (const ad of adUploads) {
      const key = `${ad.ad_number}-${ad.title_number}`;
      if (!comboMap.has(key)) {
        comboMap.set(key, { adNumber: ad.ad_number, titleNumber: ad.title_number, cvs: 0, adUploadIds: new Set() });
      }
      comboMap.get(key)!.adUploadIds.add(ad.id);
    }

    for (const cv of cvDownloads) {
      const ad = adUploads.find(a => a.id === cv.ad_upload_id);
      if (ad) {
        const key = `${ad.ad_number}-${ad.title_number}`;
        if (comboMap.has(key)) {
          comboMap.get(key)!.cvs += cv.count;
        }
      }
    }

    // Count OBs and Starts from stage history for LinkedIn candidates
    const linkedInCandidateIds = new Set(candidates.map(c => c.id));

    const obsCount = new Map<string, number>(); // not per combo - we'll attribute broadly
    const startCount = new Map<string, number>();

    // For simplicity: attribute OBs/starts to ALL LinkedIn candidates (source=LinkedIn)
    // since we can't directly link a candidate to a specific ad combo without phone matching
    const totalObs = stageHistory.filter(h => linkedInCandidateIds.has(h.candidate_id) && h.to_stage === "obs").length;
    const totalStarts = stageHistory.filter(h => linkedInCandidateIds.has(h.candidate_id) && h.to_stage === "start").length;
    const totalCvs = [...comboMap.values()].reduce((s, c) => s + c.cvs, 0);

    // Proportionally attribute OBs and starts based on CV volume
    const results: ComboStats[] = [];
    for (const [, combo] of comboMap) {
      const proportion = totalCvs > 0 ? combo.cvs / totalCvs : 0;
      const obs = Math.round(totalObs * proportion);
      const starts = Math.round(totalStarts * proportion);
      const conversion = obs > 0 ? Math.round((starts / obs) * 1000) / 10 : 0;
      results.push({
        adNumber: combo.adNumber,
        titleNumber: combo.titleNumber,
        cvs: combo.cvs,
        obs,
        starts,
        conversion,
      });
    }

    return results;
  }, [adUploads, cvDownloads, candidates, stageHistory]);

  // Aggregated by ad number only
  const adStats = useMemo(() => {
    const map = new Map<number, { cvs: number; obs: number; starts: number }>();
    for (const c of comboStats) {
      const existing = map.get(c.adNumber) ?? { cvs: 0, obs: 0, starts: 0 };
      existing.cvs += c.cvs;
      existing.obs += c.obs;
      existing.starts += c.starts;
      map.set(c.adNumber, existing);
    }
    return [...map.entries()]
      .map(([adNumber, s]) => ({
        adNumber,
        ...s,
        conversion: s.obs > 0 ? Math.round((s.starts / s.obs) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.starts - a.starts || b.conversion - a.conversion);
  }, [comboStats]);

  // Aggregated by title number only
  const titleStats = useMemo(() => {
    const map = new Map<number, { cvs: number; obs: number; starts: number }>();
    for (const c of comboStats) {
      const existing = map.get(c.titleNumber) ?? { cvs: 0, obs: 0, starts: 0 };
      existing.cvs += c.cvs;
      existing.obs += c.obs;
      existing.starts += c.starts;
      map.set(c.titleNumber, existing);
    }
    return [...map.entries()]
      .map(([titleNumber, s]) => ({
        titleNumber,
        ...s,
        conversion: s.obs > 0 ? Math.round((s.starts / s.obs) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.starts - a.starts || b.conversion - a.conversion);
  }, [comboStats]);

  // Best combo
  const bestCombo = useMemo(() => {
    return [...comboStats].sort((a, b) => b.starts - a.starts || b.conversion - a.conversion)[0] ?? null;
  }, [comboStats]);

  // Sorted full table
  const sortedComboStats = useMemo(() => {
    return [...comboStats].sort((a, b) => {
      if (sortKey === "starts") return b.starts - a.starts || b.conversion - a.conversion;
      if (sortKey === "conversion") return b.conversion - a.conversion || b.starts - a.starts;
      return b.cvs - a.cvs;
    });
  }, [comboStats, sortKey]);

  // Delay intelligence
  const delayStats = useMemo(() => {
    // Ad upload → CV download delay
    const adToCvDelays: number[] = [];
    for (const cv of cvDownloads) {
      const ad = adUploads.find(a => a.id === cv.ad_upload_id);
      if (ad) {
        const diff = (new Date(cv.download_date).getTime() - new Date(ad.upload_date).getTime()) / (1000 * 60 * 60 * 24);
        if (diff >= 0) adToCvDelays.push(diff);
      }
    }

    const avgAdToCv = adToCvDelays.length > 0 ? Math.round((adToCvDelays.reduce((s, d) => s + d, 0) / adToCvDelays.length) * 10) / 10 : null;

    // CV download → OB (approximate: use candidate created_at as proxy for when CV became a candidate)
    // OB → Start from stage history
    const linkedInCandidateIds = new Set(candidates.map(c => c.id));
    const obsEntries = stageHistory.filter(h => linkedInCandidateIds.has(h.candidate_id) && h.to_stage === "obs");
    const startEntries = stageHistory.filter(h => linkedInCandidateIds.has(h.candidate_id) && h.to_stage === "start");

    const obToStartDelays: number[] = [];
    for (const start of startEntries) {
      const ob = obsEntries.find(o => o.candidate_id === start.candidate_id);
      if (ob) {
        const diff = (new Date(start.changed_at).getTime() - new Date(ob.changed_at).getTime()) / (1000 * 60 * 60 * 24);
        if (diff >= 0) obToStartDelays.push(diff);
      }
    }

    const avgObToStart = obToStartDelays.length > 0 ? Math.round((obToStartDelays.reduce((s, d) => s + d, 0) / obToStartDelays.length) * 10) / 10 : null;

    return { avgAdToCv, avgObToStart };
  }, [adUploads, cvDownloads, candidates, stageHistory]);

  if (loading) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Loading LinkedIn intelligence...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Top Cards: Best Ad, Best Title, Best Combo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Best Ad */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5" style={{ color: "hsl(210 70% 50%)" }} />
              Best Performing Ad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adStats.length > 0 ? (
              <div>
                <p className="text-2xl font-bold font-mono" style={{ color: "hsl(210 70% 50%)" }}>Ad {adStats[0].adNumber}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{adStats[0].cvs} CVs</span>
                  <span>{adStats[0].obs} OBs</span>
                  <span>{adStats[0].starts} Starts</span>
                  <span>{adStats[0].conversion}% Conv.</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Best Title */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "hsl(270 60% 50%)" }} />
              Best Performing Title
            </CardTitle>
          </CardHeader>
          <CardContent>
            {titleStats.length > 0 ? (
              <div>
                <p className="text-2xl font-bold font-mono" style={{ color: "hsl(270 60% 50%)" }}>Title {titleStats[0].titleNumber}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{titleStats[0].cvs} CVs</span>
                  <span>{titleStats[0].obs} OBs</span>
                  <span>{titleStats[0].starts} Starts</span>
                  <span>{titleStats[0].conversion}% Conv.</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Best Combo */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <Zap className="w-3.5 h-3.5" style={{ color: "hsl(38 92% 50%)" }} />
              Best Ad + Title Combination
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestCombo ? (
              <div>
                <p className="text-xl font-bold font-mono" style={{ color: "hsl(38 92% 50%)" }}>
                  Ad {bestCombo.adNumber} + Title {bestCombo.titleNumber}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{bestCombo.cvs} CVs</span>
                  <span>{bestCombo.obs} OBs</span>
                  <span>{bestCombo.starts} Starts</span>
                  <span>{bestCombo.conversion}% Conv.</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delay Intelligence */}
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" style={{ color: "hsl(172 66% 50%)" }} />
            Ad Delay Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Ad Upload → CV Download</p>
              <p className="text-xl font-bold font-mono" style={{ color: "hsl(172 66% 50%)" }}>
                {delayStats.avgAdToCv !== null ? `${delayStats.avgAdToCv} days` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg OB → Start</p>
              <p className="text-xl font-bold font-mono" style={{ color: "hsl(172 66% 50%)" }}>
                {delayStats.avgObToStart !== null ? `${delayStats.avgObToStart} days` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Performance Table */}
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5" style={{ color: "hsl(210 70% 50%)" }} />
              Ad Performance Table
            </CardTitle>
            <div className="flex gap-1">
              {(["starts", "conversion", "cvs"] as SortKey[]).map((key) => (
                <Button
                  key={key}
                  variant={sortKey === key ? "default" : "outline"}
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => setSortKey(key)}
                >
                  {key === "starts" ? "Starts" : key === "conversion" ? "Conv %" : "CVs"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedComboStats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No ad data recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad #</TableHead>
                  <TableHead>Title #</TableHead>
                  <TableHead>CVs</TableHead>
                  <TableHead>OBs</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Conv %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedComboStats.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">Ad {row.adNumber}</TableCell>
                    <TableCell>Title {row.titleNumber}</TableCell>
                    <TableCell>{row.cvs}</TableCell>
                    <TableCell>{row.obs}</TableCell>
                    <TableCell>
                      <Badge variant={row.starts > 0 ? "default" : "outline"}>{row.starts}</Badge>
                    </TableCell>
                    <TableCell>{row.conversion}%</TableCell>
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
