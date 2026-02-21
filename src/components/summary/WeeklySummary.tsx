import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Candidate, STAGES_ORDER, STAGE_CONFIG, PipelineStage } from "@/lib/types";
import { useCandidates } from "@/hooks/useCandidates";
import { useLinkedIn } from "@/hooks/useLinkedIn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trophy, Users, Target, GitBranch, Flame, AlertTriangle, TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek, parseISO, format } from "date-fns";
import { CrewBubbleSnapshot } from "@/components/crew/CrewBubbleForecast";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
  crew_name: string;
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
  const { user, profile, userRole } = useAuth();
  const { candidates: ownCandidates, loading: candidatesLoading } = useCandidates("own");
  const { candidates: allCandidates, loading: allCandidatesLoading } = useCandidates("all");
  const { adUploads, cvDownloads, loading: linkedInLoading } = useLinkedIn();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const isLeader = !!profile?.leader_id === false && allProfiles.some((p) => p.leader_id === profile?.id);

  // Sales snapshot data
  const [salesLoading, setSalesLoading] = useState(true);
  const [ownSalesEntries, setOwnSalesEntries] = useState<any[]>([]);
  const [crewSalesEntries, setCrewSalesEntries] = useState<any[]>([]);

  const currentWeekBounds = useMemo(() => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    const sunday = endOfWeek(now, { weekStartsOn: 1 });
    return {
      start: format(monday, "yyyy-MM-dd"),
      end: format(sunday, "yyyy-MM-dd"),
    };
  }, []);

  // Fetch own sales for current week
  useEffect(() => {
    if (!user) return;
    async function fetchOwnSales() {
      const { data } = await supabase
        .from("sales_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("entry_date", currentWeekBounds.start)
        .lte("entry_date", currentWeekBounds.end);
      setOwnSalesEntries(data ?? []);
    }
    fetchOwnSales();
  }, [user, currentWeekBounds]);

  // Fetch crew sales based on role
  useEffect(() => {
    if (!user || !userRole || !profile) { setSalesLoading(false); return; }
    const role = userRole.role;

    async function fetchCrewSales() {
      if (role === "brand_ambassador") {
        setCrewSalesEntries([]);
        setSalesLoading(false);
        return;
      }

      // For leader: get full hierarchy descendant user_ids
      // For manager: get all entries
      if (role === "manager" && userRole.super_admin) {
        const { data } = await supabase
          .from("sales_entries")
          .select("*")
          .gte("entry_date", currentWeekBounds.start)
          .lte("entry_date", currentWeekBounds.end);
        setCrewSalesEntries(data ?? []);
      } else {
        // Leader: need to resolve hierarchy from profiles
        const { data: profiles } = await supabase.from("profiles").select("id, user_id, leader_id");
        if (!profiles || !profile) { setSalesLoading(false); return; }

        const myProfileId = profile.id;
        // Recursive: get all descendant user_ids
        function getDescendantUserIds(leaderId: string): string[] {
          const directReports = profiles!.filter((p) => p.leader_id === leaderId);
          const userIds: string[] = [];
          for (const dr of directReports) {
            userIds.push(dr.user_id);
            userIds.push(...getDescendantUserIds(dr.id));
          }
          return userIds;
        }
        const crewUserIds = [user!.id, ...getDescendantUserIds(myProfileId)];
        const uniqueIds = [...new Set(crewUserIds)];

        const { data } = await supabase
          .from("sales_entries")
          .select("*")
          .in("user_id", uniqueIds)
          .gte("entry_date", currentWeekBounds.start)
          .lte("entry_date", currentWeekBounds.end);
        setCrewSalesEntries(data ?? []);
      }
      setSalesLoading(false);
    }
    fetchCrewSales();
  }, [user, userRole, profile, currentWeekBounds, allProfiles]);

  const GAUGE_KEYS = ["doors", "spoken", "presentations", "closes", "tablets", "sales"] as const;
  const GAUGE_LABELS: Record<string, string> = {
    doors: "Doors", spoken: "Spoken", presentations: "Presentations",
    closes: "Closes", tablets: "Tablets", sales: "Sales",
  };
  const DAILY_TARGETS: Record<string, number> = {
    doors: 120, spoken: 80, presentations: 30, closes: 25, tablets: 10, sales: 3,
  };

  function calcMeanGauges(entries: any[]) {
    const daysLogged = entries.length;
    if (daysLogged === 0) return null;
    const means: Record<string, number> = {};
    for (const key of GAUGE_KEYS) {
      const total = entries.reduce((s: number, e: any) => s + (e[key] || 0), 0);
      means[key] = Math.round(total / daysLogged);
    }
    return means;
  }

  function calcDropoff(means: Record<string, number>) {
    const result: { key: string; pct: number }[] = [];
    for (const key of GAUGE_KEYS) {
      const pct = Math.round((means[key] / DAILY_TARGETS[key]) * 100);
      result.push({ key, pct });
    }
    return result;
  }

  function findWeakest(dropoff: { key: string; pct: number }[]) {
    return dropoff.reduce((min, d) => d.pct < min.pct ? d : min, dropoff[0]);
  }

  function calcProjectedSales(means: Record<string, number>, weakestKey: string) {
    const adjusted = { ...means };
    adjusted[weakestKey] = DAILY_TARGETS[weakestKey];
    const spokenToPresRatio = means.spoken > 0 ? means.presentations / means.spoken : 0;
    const presToCloseRatio = means.presentations > 0 ? means.closes / means.presentations : 0;
    const closeToTabRatio = means.closes > 0 ? means.tablets / means.closes : 0;
    const tabToSaleRatio = means.tablets > 0 ? means.sales / means.tablets : 0;

    const funnel = ["spoken", "presentations", "closes", "tablets", "sales"];
    const ratios = [spokenToPresRatio, presToCloseRatio, closeToTabRatio, tabToSaleRatio];
    const weakIdx = funnel.indexOf(weakestKey);

    if (weakestKey === "doors") {
      const doorsToSpokenRatio = means.doors > 0 ? means.spoken / means.doors : 0;
      adjusted.spoken = Math.round(adjusted.doors * doorsToSpokenRatio);
      adjusted.presentations = Math.round(adjusted.spoken * spokenToPresRatio);
      adjusted.closes = Math.round(adjusted.presentations * presToCloseRatio);
      adjusted.tablets = Math.round(adjusted.closes * closeToTabRatio);
      adjusted.sales = adjusted.tablets * tabToSaleRatio;
    } else if (weakestKey === "sales") {
      return DAILY_TARGETS.sales;
    } else if (weakIdx >= 0) {
      for (let i = weakIdx; i < funnel.length - 1; i++) {
        adjusted[funnel[i + 1]] = adjusted[funnel[i]] * ratios[i];
      }
    }
    return Math.round(adjusted.sales * 10) / 10;
  }

  const individualMeans = useMemo(() => calcMeanGauges(ownSalesEntries), [ownSalesEntries]);
  const individualDropoff = useMemo(() => individualMeans ? calcDropoff(individualMeans) : null, [individualMeans]);
  const individualWeakest = useMemo(() => individualDropoff ? findWeakest(individualDropoff) : null, [individualDropoff]);
  const individualProjected = useMemo(() => {
    if (!individualMeans || !individualWeakest) return null;
    return calcProjectedSales(individualMeans, individualWeakest.key);
  }, [individualMeans, individualWeakest]);

  const crewMeans = useMemo(() => {
    if (!userRole || userRole.role === "brand_ambassador") return null;
    return calcMeanGauges(crewSalesEntries);
  }, [crewSalesEntries, userRole]);
  const crewDropoff = useMemo(() => crewMeans ? calcDropoff(crewMeans) : null, [crewMeans]);
  const crewWeakest = useMemo(() => crewDropoff ? findWeakest(crewDropoff) : null, [crewDropoff]);
  const crewProjected = useMemo(() => {
    if (!crewMeans || !crewWeakest) return null;
    return calcProjectedSales(crewMeans, crewWeakest.key);
  }, [crewMeans, crewWeakest]);

  useEffect(() => {
    async function fetchProfiles() {
      const { data } = await supabase.from("profiles").select("*");
      setAllProfiles((data ?? []) as Profile[]);
    }
    fetchProfiles();
  }, []);

  const thisWeek = useMemo(() => getWeekBounds(0), []);

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

  const crewName = profile ? (allProfiles.find(p => p.user_id === profile.user_id)?.crew_name || "") : "";
  const mondayLabel = format(thisWeek.start, "do MMMM yyyy");
  const summaryTitle = crewName
    ? `${crewName} – Week Commencing ${mondayLabel} Summary`
    : `Week Commencing ${mondayLabel} Summary`;

  const dateLabel = `${format(thisWeek.start, "do MMM")} – ${format(thisWeek.end, "do MMM yyyy")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Loading summary…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title + Download Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{summaryTitle}</h2>
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

        {/* SECTION: Sales Performance — This Week */}
        <Card className="border-[hsl(0_70%_50%/0.3)] bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="w-4 h-4" style={{ color: "hsl(0 70% 50%)" }} />
              <span style={{ color: "hsl(0 70% 50%)" }}>Sales Performance — This Week</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({format(thisWeek.start, "do MMM")} – {format(thisWeek.end, "do MMM yyyy")})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* YOUR PERFORMANCE */}
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Your Performance</div>

            {individualMeans ? (
              <>
                {/* Mean Daily Averages */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Mean Daily Average</div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {GAUGE_KEYS.map((key) => (
                      <div key={key} className="bg-muted/30 rounded-lg p-3 text-center" style={{ borderBottom: "2px solid hsl(0 70% 50% / 0.3)" }}>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{GAUGE_LABELS[key]}</div>
                        <div className="text-xl font-bold text-foreground">{individualMeans[key]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target Daily Gauges */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Target Daily Gauges
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {GAUGE_KEYS.map((key) => (
                      <div key={key} className="bg-muted/20 rounded-lg p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{GAUGE_LABELS[key]}</div>
                        <div className="text-xl font-semibold text-muted-foreground">{DAILY_TARGETS[key]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compact % vs Target — single line */}
                {individualDropoff && individualWeakest && (
                  <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                    <span className="text-[10px] uppercase tracking-wider mr-1">% of Target:</span>
                    {individualDropoff.map((d, i) => (
                      <span key={d.key} className="inline-flex items-center gap-0.5">
                        <span className="text-muted-foreground">{GAUGE_LABELS[d.key] === "Presentations" ? "Pres" : GAUGE_LABELS[d.key] === "Tablets" ? "Tabs" : GAUGE_LABELS[d.key]}</span>
                        <span className={`font-semibold ${d.key === individualWeakest.key ? "text-red-400" : d.pct >= 100 ? "text-green-500" : d.pct >= 80 ? "text-yellow-500" : "text-red-500"}`}>
                          {d.pct}%
                        </span>
                        {i < individualDropoff.length - 1 && <span className="text-border mx-0.5">|</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Improvement Simulation */}
                {individualWeakest && individualMeans && (
                  <div className="rounded-lg p-3 border border-border/30 bg-muted/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-semibold text-foreground">Improvement Simulation</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Weakest Gauge: <span className="font-medium text-foreground">{GAUGE_LABELS[individualWeakest.key]}</span> ({individualWeakest.pct}% of target)
                    </p>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">
                        If {GAUGE_LABELS[individualWeakest.key]} improved to target:
                      </div>
                      <div className="flex items-center gap-1 flex-wrap text-xs">
                        {GAUGE_KEYS.map((key, i) => {
                          const projected = (() => {
                            const adj = { ...individualMeans };
                            adj[individualWeakest.key] = DAILY_TARGETS[individualWeakest.key];
                            const doorsToSpokenRatio = individualMeans.doors > 0 ? individualMeans.spoken / individualMeans.doors : 0;
                            const spokenToPresRatio = individualMeans.spoken > 0 ? individualMeans.presentations / individualMeans.spoken : 0;
                            const presToCloseRatio = individualMeans.presentations > 0 ? individualMeans.closes / individualMeans.presentations : 0;
                            const closeToTabRatio = individualMeans.closes > 0 ? individualMeans.tablets / individualMeans.closes : 0;
                            const tabToSaleRatio = individualMeans.tablets > 0 ? individualMeans.sales / individualMeans.tablets : 0;
                            const funnel = ["doors", "spoken", "presentations", "closes", "tablets", "sales"];
                            const ratios = [doorsToSpokenRatio, spokenToPresRatio, presToCloseRatio, closeToTabRatio, tabToSaleRatio];
                            const weakIdx = funnel.indexOf(individualWeakest.key);
                            for (let ii = weakIdx; ii < funnel.length - 1; ii++) {
                              adj[funnel[ii + 1]] = Math.round(adj[funnel[ii]] * ratios[ii]);
                            }
                            return adj;
                          })();
                          const changed = projected[key] !== individualMeans[key];
                          return (
                            <span key={key} className="inline-flex items-center gap-0.5">
                              <span className="text-muted-foreground">{GAUGE_LABELS[key] === "Presentations" ? "Pres" : GAUGE_LABELS[key] === "Tablets" ? "Tabs" : GAUGE_LABELS[key]}</span>
                              <span className={`font-semibold ${changed ? "text-green-400" : "text-foreground"}`}>{projected[key]}</span>
                              {i < GAUGE_KEYS.length - 1 && <span className="text-border mx-0.5">|</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">No sales data logged this week.</div>
            )}

            {/* CREW PERFORMANCE (Leader + Manager only) */}
            {crewMeans && (
              <div className="border-t border-border/30 pt-4 space-y-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Crew Performance</div>

                {/* Crew Mean Daily Averages */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Mean Daily Average</div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {GAUGE_KEYS.map((key) => (
                      <div key={key} className="bg-muted/30 rounded-lg p-3 text-center" style={{ borderBottom: "2px solid hsl(0 70% 50% / 0.15)" }}>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{GAUGE_LABELS[key]}</div>
                        <div className="text-xl font-bold text-foreground">{crewMeans[key]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Crew Target */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Target Daily Gauges
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {GAUGE_KEYS.map((key) => (
                      <div key={key} className="bg-muted/20 rounded-lg p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{GAUGE_LABELS[key]}</div>
                        <div className="text-xl font-semibold text-muted-foreground">{DAILY_TARGETS[key]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Crew Compact % vs Target */}
                {crewDropoff && crewWeakest && (
                  <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                    <span className="text-[10px] uppercase tracking-wider mr-1">% of Target:</span>
                    {crewDropoff.map((d, i) => (
                      <span key={d.key} className="inline-flex items-center gap-0.5">
                        <span className="text-muted-foreground">{GAUGE_LABELS[d.key] === "Presentations" ? "Pres" : GAUGE_LABELS[d.key] === "Tablets" ? "Tabs" : GAUGE_LABELS[d.key]}</span>
                        <span className={`font-semibold ${d.key === crewWeakest.key ? "text-red-400" : d.pct >= 100 ? "text-green-500" : d.pct >= 80 ? "text-yellow-500" : "text-red-500"}`}>
                          {d.pct}%
                        </span>
                        {i < crewDropoff.length - 1 && <span className="text-border mx-0.5">|</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Crew Simulation */}
                {crewWeakest && crewMeans && (
                  <div className="rounded-lg p-3 border border-border/30 bg-muted/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-semibold text-foreground">Improvement Simulation</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Weakest Gauge: <span className="font-medium text-foreground">{GAUGE_LABELS[crewWeakest.key]}</span> ({crewWeakest.pct}% of target)
                    </p>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">
                        If {GAUGE_LABELS[crewWeakest.key]} improved to target:
                      </div>
                      <div className="flex items-center gap-1 flex-wrap text-xs">
                        {GAUGE_KEYS.map((key, i) => {
                          const projected = (() => {
                            const adj = { ...crewMeans };
                            adj[crewWeakest.key] = DAILY_TARGETS[crewWeakest.key];
                            const doorsToSpokenRatio = crewMeans.doors > 0 ? crewMeans.spoken / crewMeans.doors : 0;
                            const spokenToPresRatio = crewMeans.spoken > 0 ? crewMeans.presentations / crewMeans.spoken : 0;
                            const presToCloseRatio = crewMeans.presentations > 0 ? crewMeans.closes / crewMeans.presentations : 0;
                            const closeToTabRatio = crewMeans.closes > 0 ? crewMeans.tablets / crewMeans.closes : 0;
                            const tabToSaleRatio = crewMeans.tablets > 0 ? crewMeans.sales / crewMeans.tablets : 0;
                            const funnel = ["doors", "spoken", "presentations", "closes", "tablets", "sales"];
                            const ratios = [doorsToSpokenRatio, spokenToPresRatio, presToCloseRatio, closeToTabRatio, tabToSaleRatio];
                            const weakIdx = funnel.indexOf(crewWeakest.key);
                            for (let ii = weakIdx; ii < funnel.length - 1; ii++) {
                              adj[funnel[ii + 1]] = Math.round(adj[funnel[ii]] * ratios[ii]);
                            }
                            return adj;
                          })();
                          const changed = projected[key] !== crewMeans[key];
                          return (
                            <span key={key} className="inline-flex items-center gap-0.5">
                              <span className="text-muted-foreground">{GAUGE_LABELS[key] === "Presentations" ? "Pres" : GAUGE_LABELS[key] === "Tablets" ? "Tabs" : GAUGE_LABELS[key]}</span>
                              <span className={`font-semibold ${changed ? "text-green-400" : "text-foreground"}`}>{projected[key]}</span>
                              {i < GAUGE_KEYS.length - 1 && <span className="text-border mx-0.5">|</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
      </div>
    </div>
  );
}