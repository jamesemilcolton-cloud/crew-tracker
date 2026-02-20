import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Candidate, STAGES_ORDER, STAGE_CONFIG, PipelineStage, KPI_TARGETS } from "@/lib/types";
import { useCandidates } from "@/hooks/useCandidates";
import { useLinkedIn } from "@/hooks/useLinkedIn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, Minus, AlertTriangle, Trophy, Users, Target, GitBranch } from "lucide-react";
import { startOfWeek, parseISO, format } from "date-fns";
import { CrewBubbleSnapshot } from "@/components/crew/CrewBubbleForecast";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
}

function getWeekBounds(offset: number = 0) {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  if (offset !== 0) monday.setDate(monday.getDate() - offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function countInRange(candidates: Candidate[], stage: PipelineStage, start: Date, end: Date): number {
  let count = 0;
  candidates.forEach((c) => {
    if (stage === "obs") {
      const created = new Date(c.createdAt);
      if (created >= start && created <= end) count++;
    }
    c.history.forEach((h) => {
      if (h.to === stage) {
        const d = parseISO(h.date);
        if (d >= start && d <= end) count++;
      }
    });
  });
  return count;
}

export function WeeklySummary() {
  const { user, profile } = useAuth();
  const { candidates: ownCandidates, loading: candidatesLoading } = useCandidates("own");
  const { candidates: allCandidates, loading: allCandidatesLoading } = useCandidates("all");
  const { adUploads, cvDownloads, loading: linkedInLoading } = useLinkedIn();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const isLeader = !!profile?.leader_id === false && allProfiles.some((p) => p.leader_id === profile?.id);

  useEffect(() => {
    async function fetchProfiles() {
      const { data } = await supabase.from("profiles").select("*");
      setAllProfiles(data ?? []);
    }
    fetchProfiles();
  }, []);

  const thisWeek = useMemo(() => getWeekBounds(0), []);
  const lastWeek = useMemo(() => getWeekBounds(1), []);

  const [allOwnCandidates, setAllOwnCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    if (!user) return;
    async function fetchAllOwn() {
      const { data: rows } = await supabase
        .from("candidates")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (!rows) return;
      const ids = rows.map((r) => r.id);
      const { data: historyRows } = await supabase
        .from("candidate_stage_history")
        .select("*")
        .in("candidate_id", ids.length > 0 ? ids : ["__none__"])
        .order("changed_at", { ascending: true });
      const historyMap: Record<string, any[]> = {};
      (historyRows ?? []).forEach((h) => {
        if (!historyMap[h.candidate_id]) historyMap[h.candidate_id] = [];
        historyMap[h.candidate_id].push(h);
      });
      setAllOwnCandidates(rows.map((r) => ({
        id: r.id, name: r.name, phone: r.phone, notes: r.notes,
        source: r.source as any, stage: r.stage as PipelineStage,
        status: r.status as any, potentialStartDate: r.potential_start_date,
        hasSalesPitchAccess: r.has_sales_pitch_access, hasEvoAppAccess: r.has_evo_app_access,
        recruitedBy: r.recruited_by, archivedAt: r.archived_at,
        history: (historyMap[r.id] ?? []).map((h: any) => ({
          from: h.from_stage as PipelineStage, to: h.to_stage as PipelineStage,
          date: h.changed_at?.split("T")[0] ?? "", note: h.note,
        })),
        createdAt: r.created_at,
      })));
    }
    fetchAllOwn();
  }, [user]);

  // SECTION 1: Recruitment KPIs
  const kpiStages: PipelineStage[] = ["obs", "final", "offered", "start", "solo", "promoted"];
  const thisWeekCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    kpiStages.forEach((s) => { counts[s] = countInRange(allOwnCandidates, s, thisWeek.start, thisWeek.end); });
    return counts;
  }, [allOwnCandidates, thisWeek]);

  const lastWeekCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    kpiStages.forEach((s) => { counts[s] = countInRange(allOwnCandidates, s, lastWeek.start, lastWeek.end); });
    return counts;
  }, [allOwnCandidates, lastWeek]);

  const conversions = useMemo(() => {
    const pairs: { from: PipelineStage; to: PipelineStage; label: string }[] = [
      { from: "obs", to: "final", label: "OB → Final" },
      { from: "final", to: "offered", label: "Final → Offered" },
      { from: "offered", to: "start", label: "Offered → Start" },
      { from: "start", to: "solo", label: "Start → Solo" },
    ];
    return pairs.map(({ from, to, label }) => {
      const fromCount = thisWeekCounts[from] || 0;
      const toCount = thisWeekCounts[to] || 0;
      const pct = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
      return { label, pct };
    });
  }, [thisWeekCounts]);

  // SECTION 2: LinkedIn Performance
  const linkedInThisWeek = useMemo(() => {
    const freeAds = adUploads.filter((a) => {
      const d = new Date(a.date);
      return a.type === "free" && d >= thisWeek.start && d <= thisWeek.end;
    }).length;
    const paidAds = adUploads.filter((a) => {
      const d = new Date(a.date);
      return a.type === "paid" && d >= thisWeek.start && d <= thisWeek.end;
    }).length;
    const cvs = cvDownloads.filter((c) => {
      const d = new Date(c.downloadDate);
      return d >= thisWeek.start && d <= thisWeek.end;
    }).reduce((sum, c) => sum + c.count, 0);
    const linkedInObs = thisWeekCounts["obs"] || 0;
    return { freeAds, paidAds, cvs, linkedInObs };
  }, [adUploads, cvDownloads, thisWeek, thisWeekCounts]);

  // SECTION 3: Crew Summary (leaders only)
  const crewSummary = useMemo(() => {
    if (!isLeader || !profile) return null;

    const activeTeam = allCandidates.filter((c) =>
      c.recruitedBy === profile.id && ["start", "solo", "promoted"].includes(c.stage)
    );

    const totalTeamSize = activeTeam.length;
    const brandAmbassadors = activeTeam.filter((c) => c.stage === "start" || c.stage === "solo").length;
    const leaders = activeTeam.filter((c) => c.stage === "promoted").length;

    const startsThisWeek = countInRange(
      allCandidates.filter((c) => c.recruitedBy === profile.id),
      "start", thisWeek.start, thisWeek.end
    );
    const promotionsThisWeek = countInRange(
      allCandidates.filter((c) => c.recruitedBy === profile.id),
      "promoted", thisWeek.start, thisWeek.end
    );

    return { totalTeamSize, brandAmbassadors, leaders, netGrowth: startsThisWeek, startsThisWeek, promotionsThisWeek };
  }, [isLeader, profile, allCandidates, thisWeek]);

  // SECTION 4: Personal Best
  const personalBest = useMemo(() => {
    const records: { metric: string; previousBest: number; current: number }[] = [];
    const trackMetrics: { key: PipelineStage; label: string }[] = [
      { key: "obs", label: "OBs" },
      { key: "start", label: "Starts" },
      { key: "promoted", label: "Promotions" },
    ];

    for (const { key, label } of trackMetrics) {
      let historicalBest = 0;
      for (let w = 1; w <= 52; w++) {
        const bounds = getWeekBounds(w);
        const count = countInRange(allOwnCandidates, key, bounds.start, bounds.end);
        if (count > historicalBest) historicalBest = count;
      }
      const currentCount = thisWeekCounts[key] || 0;
      if (currentCount > historicalBest && currentCount > 0) {
        records.push({ metric: label, previousBest: historicalBest, current: currentCount });
      }
    }

    return records;
  }, [allOwnCandidates, thisWeekCounts]);

  // SECTION 5: Focus Area
  const focusArea = useMemo(() => {
    let worstGap = 0;
    let worstLabel = "";
    let worstActual = 0;
    let worstTarget = 0;

    for (let i = 1; i < STAGES_ORDER.length; i++) {
      const from = STAGES_ORDER[i - 1];
      const to = STAGES_ORDER[i];
      const key = `${from}→${to}`;
      const target = KPI_TARGETS[key];
      if (target === null || target === undefined) continue;

      const prevCount = thisWeekCounts[from] || 0;
      const currCount = thisWeekCounts[to] || 0;
      const actual = prevCount > 0 ? Math.round((currCount / prevCount) * 100) : 0;
      const gap = target - actual;

      if (gap > worstGap) {
        worstGap = gap;
        worstLabel = `${STAGE_CONFIG[from].label} → ${STAGE_CONFIG[to].label}`;
        worstActual = actual;
        worstTarget = target;
      }
    }

    return worstGap > 0 ? { label: worstLabel, actual: worstActual, target: worstTarget } : null;
  }, [thisWeekCounts]);

  // PDF Export
  const handleDownloadPDF = useCallback(async () => {
    if (!summaryRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = summaryRef.current;
      const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 2, useCORS: true });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const startDate = format(thisWeek.start, "yyyy-MM-dd");
      const endDate = format(thisWeek.end, "yyyy-MM-dd");
      pdf.save(`Weekly_Summary_${startDate}to${endDate}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setExporting(false);
    }
  }, [thisWeek]);

  const loading = candidatesLoading || linkedInLoading || allCandidatesLoading;

  const dateLabel = `${format(thisWeek.start, "do MMM")} – ${format(thisWeek.end, "do MMM yyyy")}`;

  const DeltaIndicator = ({ current, previous }: { current: number; previous: number }) => {
    const diff = current - previous;
    if (diff === 0) return <span className="text-muted-foreground text-[10px] flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0</span>;
    if (diff > 0) return <span className="text-primary text-[10px] flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +{diff}</span>;
    return <span className="text-destructive text-[10px] flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {diff}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Loading summary…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Download Button */}
      <div className="flex justify-end">
        <Button onClick={handleDownloadPDF} disabled={exporting} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          {exporting ? "Generating…" : "Download Weekly Summary (PDF)"}
        </Button>
      </div>

      {/* PDF-capturable content */}
      <div ref={summaryRef} className="space-y-4 pdf-content">
        {/* SECTION 1: Recruitment KPIs */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Recruitment KPIs
              <span className="text-xs font-normal text-muted-foreground">({dateLabel})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {kpiStages.map((stage) => (
                <div key={stage} className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {STAGE_CONFIG[stage].label}
                  </div>
                  <div className="text-2xl font-bold text-foreground">{thisWeekCounts[stage] || 0}</div>
                  <DeltaIndicator current={thisWeekCounts[stage] || 0} previous={lastWeekCounts[stage] || 0} />
                </div>
              ))}
            </div>
            {/* Conversion percentages */}
            <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 md:grid-cols-4 gap-3">
              {conversions.map((c) => (
                <div key={c.label} className="flex items-center justify-between bg-muted/20 rounded-md px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">{c.label}</span>
                  <span className="text-xs font-semibold text-foreground">{c.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: LinkedIn Performance */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
              LinkedIn Performance
              <span className="text-xs font-normal text-muted-foreground">({dateLabel})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Free Ads Uploaded", value: linkedInThisWeek.freeAds },
                { label: "Paid Ads Uploaded", value: linkedInThisWeek.paidAds },
                { label: "CVs Downloaded", value: linkedInThisWeek.cvs },
                { label: "LinkedIn OBs", value: linkedInThisWeek.linkedInObs },
              ].map((item) => (
                <div key={item.label} className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</div>
                  <div className="text-2xl font-bold text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: Crew Summary (Leaders only) */}
        {isLeader && crewSummary && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Crew Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: "Total Team Size", value: crewSummary.totalTeamSize },
                  { label: "Brand Ambassadors", value: crewSummary.brandAmbassadors },
                  { label: "Leaders", value: crewSummary.leaders },
                  { label: "Team Starts This Week", value: crewSummary.startsThisWeek },
                  { label: "Team Promotions This Week", value: crewSummary.promotionsThisWeek },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-2xl font-bold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION: Crew Bubble Snapshot */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              Crew Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CrewBubbleSnapshot candidates={allCandidates} />
          </CardContent>
        </Card>

        {/* SECTION 4: Personal Best (only if records achieved) */}
        {personalBest.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Personal Best
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {personalBest.map((record) => (
                  <div key={record.metric} className="flex items-center gap-3 bg-primary/10 rounded-lg p-3">
                    <span className="text-lg">🏆</span>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        New Personal Best – {record.metric}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Previous Best: {record.previousBest}
                      </div>
                    </div>
                    <div className="ml-auto text-2xl font-bold text-primary">{record.current}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION 5: Focus Area */}
        {focusArea && (
          <Card className="border-status-waiting/30 bg-status-waiting/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-status-waiting mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Focus Area: Improve {focusArea.label} conversion
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Current: {focusArea.actual}% | Target: {focusArea.target}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
