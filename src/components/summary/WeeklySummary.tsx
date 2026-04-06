import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { getAdjustedRepProfit } from "@/lib/commission";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { SalesTransaction } from "@/hooks/useSalesTransactions";
import { Candidate, STAGES_ORDER, STAGE_CONFIG, PipelineStage } from "@/lib/types";
import { useCandidates } from "@/hooks/useCandidates";
import { useLinkedIn } from "@/hooks/useLinkedIn";
import { Download, Trophy, Users, GitBranch, Flame, TrendingUp, Target, Lock, ChevronDown } from "lucide-react";
import {
  getDescendantProfileIds,
  buildRecursiveTree,
  CrewNode,
} from "@/components/crew/CrewBubbleForecast";
import { CrewTree } from "@/components/crew/CrewTree";
import { BellStreakCard } from "@/components/summary/BellStreakCard";
import { parseISO, format } from "date-fns";
import { getCalendarWeekBounds, getCalendarWeekStrings } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
  crew_name: string;
  candidate_record_id: string | null;
}

function getRoleLabel(stage: string): string {
  switch (stage) {
    case "start": return "Brand Ambassador";
    case "solo": return "Solo";
    case "promoted": return "Leader";
    default: return "";
  }
}

const getWeekBounds = getCalendarWeekBounds;

function countInRange(candidates: Candidate[], stage: PipelineStage, start: Date, end: Date): number {
  const targetIdx = STAGES_ORDER.indexOf(stage);
  if (targetIdx < 0) return 0;
  let count = 0;
  candidates.forEach((c) => {
    const historyInRange = c.history.filter((h) => {
      const d = parseISO(h.date);
      return d >= start && d <= end;
    });
    if (historyInRange.length === 0) return;
    const sorted = [...historyInRange].sort((a, b) => a.date.localeCompare(b.date));
    const effectiveStage = sorted[sorted.length - 1].to as PipelineStage;
    const effectiveIdx = STAGES_ORDER.indexOf(effectiveStage);
    if (effectiveIdx >= targetIdx) count++;
  });
  return count;
}

// ── Compact stat box ──
function StatBox({ label, value, className = "", small = false }: { label: string; value: string | number; className?: string; small?: boolean }) {
  return (
    <div className={`bg-muted/30 rounded-md px-2 py-1.5 text-center ${className}`}>
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</div>
      <div className={`font-bold text-foreground tabular-nums ${small ? "text-sm" : "text-lg"}`}>{value}</div>
    </div>
  );
}

// ── Section heading ──
function SectionLabel({ icon: Icon, label, color }: { icon: any; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3 h-3" style={color ? { color } : undefined} />
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

export function WeeklySummary() {
  const { user, profile, userRole } = useAuth();
  const { candidates: ownCandidates, loading: candidatesLoading } = useCandidates("own");
  const { candidates: allCandidates, loading: allCandidatesLoading } = useCandidates("all");
  const { adUploads, cvDownloads, loading: linkedInLoading } = useLinkedIn();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { profiles: sharedProfiles, loading: profilesLoading } = useProfiles();
  const allProfilesRaw = sharedProfiles as Profile[];

  const [managerUserIds, setManagerUserIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "manager")
      .eq("super_admin", true)
      .then(({ data }) => {
        if (data) setManagerUserIds(new Set(data.map((r) => r.user_id)));
      });
  }, []);

  const allProfiles = useMemo(
    () => allProfilesRaw.filter((p) => !managerUserIds.has(p.user_id)),
    [allProfilesRaw, managerUserIds]
  );

  const isManager = userRole?.role === "manager" && !!userRole?.super_admin;
  const isLeader = userRole?.role === "leader";
  const showCrewColumns = isLeader || isManager;

  // Sales snapshot data
  const [salesLoading, setSalesLoading] = useState(true);
  const [ownSalesEntries, setOwnSalesEntries] = useState<any[]>([]);
  const [crewSalesEntries, setCrewSalesEntries] = useState<any[]>([]);
  const [ownTransactions, setOwnTransactions] = useState<SalesTransaction[]>([]);
  const [crewTransactions, setCrewTransactions] = useState<SalesTransaction[]>([]);

  const currentWeekBounds = useMemo(() => getCalendarWeekStrings(0), []);

  useEffect(() => {
    if (!user) return;
    async function fetchOwnSales() {
      const [salesRes, txRes] = await Promise.all([
        supabase.from("sales_entries").select("*").eq("user_id", user!.id)
          .gte("entry_date", currentWeekBounds.start).lte("entry_date", currentWeekBounds.end),
        supabase.from("sales_transactions")
          .select("id, user_id, date, week_start, age_band, ask_amount, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
          .eq("user_id", user!.id)
          .gte("date", currentWeekBounds.start).lte("date", currentWeekBounds.end),
      ]);
      setOwnSalesEntries(salesRes.data ?? []);
      setOwnTransactions((txRes.data ?? []) as SalesTransaction[]);
    }
    fetchOwnSales();
  }, [user, currentWeekBounds]);

  useEffect(() => {
    if (!user || !userRole || !profile) { setSalesLoading(false); return; }
    const role = userRole.role;
    async function fetchCrewSales() {
      if (role === "brand_ambassador") {
        setCrewSalesEntries([]); setCrewTransactions([]); setSalesLoading(false); return;
      }
      if (role === "manager" && userRole.super_admin) {
        const [salesRes, txRes] = await Promise.all([
          supabase.from("sales_entries").select("*")
            .gte("entry_date", currentWeekBounds.start).lte("entry_date", currentWeekBounds.end),
          supabase.from("sales_transactions").select("id, user_id, date, week_start, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
            .gte("date", currentWeekBounds.start).lte("date", currentWeekBounds.end),
        ]);
        setCrewSalesEntries(salesRes.data ?? []); setCrewTransactions((txRes.data ?? []) as SalesTransaction[]);
      } else {
        const { data: profiles } = await supabase.from("profiles").select("id, user_id, leader_id");
        if (!profiles || !profile) { setSalesLoading(false); return; }
        const myProfileId = profile.id;
        function getDescendantUserIds(leaderId: string): string[] {
          const directReports = profiles!.filter((p) => p.leader_id === leaderId);
          const userIds: string[] = [];
          for (const dr of directReports) { userIds.push(dr.user_id); userIds.push(...getDescendantUserIds(dr.id)); }
          return userIds;
        }
        const uniqueIds = [...new Set([user!.id, ...getDescendantUserIds(myProfileId)])];
        const [salesRes, txRes] = await Promise.all([
          supabase.from("sales_entries").select("*").in("user_id", uniqueIds)
            .gte("entry_date", currentWeekBounds.start).lte("entry_date", currentWeekBounds.end),
          supabase.from("sales_transactions").select("id, user_id, date, week_start, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
            .in("user_id", uniqueIds).gte("date", currentWeekBounds.start).lte("date", currentWeekBounds.end),
        ]);
        setCrewSalesEntries(salesRes.data ?? []); setCrewTransactions((txRes.data ?? []) as SalesTransaction[]);
      }
      setSalesLoading(false);
    }
    fetchCrewSales();
  }, [user, userRole, profile, currentWeekBounds, allProfiles]);

  const GAUGE_KEYS = ["doors", "spoken", "presentations", "closes", "tablets", "sales"] as const;
  const GAUGE_LABELS: Record<string, string> = {
    doors: "Doors", spoken: "Spoken", presentations: "Pres",
    closes: "Closes", tablets: "Tablets", sales: "Sales",
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

  const TARGET_GAUGES: Record<string, number> = {
    doors: 120, spoken: 80, presentations: 30, closes: 25, tablets: 10, sales: 3,
  };

  const FUNNEL_PAIRS = [
    { from: "spoken", to: "presentations", label: "S→P" },
    { from: "presentations", to: "closes", label: "P→C" },
    { from: "closes", to: "tablets", label: "C→T" },
    { from: "tablets", to: "sales", label: "T→S" },
  ] as const;

  const TARGET_CONVERSIONS = FUNNEL_PAIRS.map(({ from, to, label }) => ({
    from, to, label,
    pct: Math.round((TARGET_GAUGES[to] / TARGET_GAUGES[from]) * 100),
  }));

  function calcFunnelConversions(means: Record<string, number>) {
    return FUNNEL_PAIRS.map(({ from, to, label }) => {
      const pct = means[from] > 0 ? Math.round((means[to] / means[from]) * 100) : 0;
      return { from, to, label, pct };
    });
  }

  function calcDeviations(actuals: ReturnType<typeof calcFunnelConversions>) {
    return actuals.map((a, i) => ({
      ...a, targetPct: TARGET_CONVERSIONS[i].pct, gap: TARGET_CONVERSIONS[i].pct - a.pct,
    }));
  }

  type SimResult = {
    adjusted: Record<string, number>;
    isSpokenPriority: boolean;
    weakestDev: ReturnType<typeof calcDeviations>[0] | null;
    spokenTargetPct: number;
    spokenActualPct: number;
  };

  function calcSimulationWithPriority(
    means: Record<string, number>,
    deviations: ReturnType<typeof calcDeviations>,
    actuals: ReturnType<typeof calcFunnelConversions>
  ): SimResult | null {
    const funnel = ["doors", "spoken", "presentations", "closes", "tablets", "sales"];
    const spokenActualPct = TARGET_GAUGES.spoken > 0 ? Math.round((means.spoken / TARGET_GAUGES.spoken) * 100) : 100;
    const spokenGap = 100 - spokenActualPct;
    const worstConv = deviations.reduce((worst, d) => d.gap > worst.gap ? d : worst, deviations[0]);
    if (spokenGap > 0 && spokenGap > worstConv.gap) {
      const adjusted = { ...means };
      adjusted.spoken = TARGET_GAUGES.spoken;
      for (let i = 1; i < funnel.length - 1; i++) {
        const actualConv = actuals.find(c => c.from === funnel[i] && c.to === funnel[i + 1]);
        const ratio = actualConv ? actualConv.pct / 100 : 0;
        adjusted[funnel[i + 1]] = Math.round(adjusted[funnel[i]] * ratio);
      }
      return { adjusted, isSpokenPriority: true, weakestDev: null, spokenTargetPct: 100, spokenActualPct };
    }
    if (worstConv.gap <= 0) return null;
    const adjusted = { ...means };
    const weakIdx = funnel.indexOf(worstConv.to);
    adjusted[worstConv.to] = Math.round(adjusted[worstConv.from] * (worstConv.targetPct / 100));
    for (let i = weakIdx; i < funnel.length - 1; i++) {
      const actualConv = actuals.find(c => c.from === funnel[i] && c.to === funnel[i + 1]);
      const ratio = actualConv ? actualConv.pct / 100 : 0;
      adjusted[funnel[i + 1]] = Math.round(adjusted[funnel[i]] * ratio);
    }
    return { adjusted, isSpokenPriority: false, weakestDev: worstConv, spokenTargetPct: 100, spokenActualPct };
  }

  const individualMeans = useMemo(() => calcMeanGauges(ownSalesEntries), [ownSalesEntries]);
  const individualConversions = useMemo(() => individualMeans ? calcFunnelConversions(individualMeans) : null, [individualMeans]);
  const individualDeviations = useMemo(() => individualConversions ? calcDeviations(individualConversions) : null, [individualConversions]);
  const individualSim = useMemo(() => {
    if (!individualMeans || !individualDeviations || !individualConversions) return null;
    return calcSimulationWithPriority(individualMeans, individualDeviations, individualConversions);
  }, [individualMeans, individualDeviations, individualConversions]);

  const crewMeans = useMemo(() => {
    if (!userRole || userRole.role === "brand_ambassador") return null;
    return calcMeanGauges(crewSalesEntries);
  }, [crewSalesEntries, userRole]);
  const crewConversions = useMemo(() => crewMeans ? calcFunnelConversions(crewMeans) : null, [crewMeans]);
  const crewDeviations = useMemo(() => crewConversions ? calcDeviations(crewConversions) : null, [crewConversions]);
  const crewSim = useMemo(() => {
    if (!crewMeans || !crewDeviations || !crewConversions) return null;
    return calcSimulationWithPriority(crewMeans, crewDeviations, crewConversions);
  }, [crewMeans, crewDeviations, crewConversions]);

  const ownFinancials = useMemo(() => {
    return ownTransactions.reduce(
      (acc, t) => ({
        repProfit: acc.repProfit + getAdjustedRepProfit(t),
        isaUpfront: acc.isaUpfront + Number(t.isa_upfront),
        totalWire: acc.totalWire + Number(t.total_wire),
        qualityPending: acc.qualityPending + Number(t.quality_pending),
      }),
      { repProfit: 0, isaUpfront: 0, totalWire: 0, qualityPending: 0 }
    );
  }, [ownTransactions]);

  const crewFinancials = useMemo(() => {
    if (!userRole || userRole.role === "brand_ambassador") return null;
    const totals = crewTransactions.reduce(
      (acc, t) => ({ totalWire: acc.totalWire + Number(t.total_wire), count: acc.count + 1 }),
      { totalWire: 0, count: 0 }
    );
    const sellerIds = new Set(crewTransactions.map((t) => t.user_id));
    return {
      crewTotalWire: +totals.totalWire.toFixed(2),
      crewAvgWire: sellerIds.size > 0 ? +(totals.totalWire / sellerIds.size).toFixed(2) : 0,
      headcountSelling: sellerIds.size,
    };
  }, [crewTransactions, userRole]);

  const thisWeek = useMemo(() => getWeekBounds(0), []);

  const allOwnCandidates = ownCandidates;

  const kpiStages: PipelineStage[] = ["obs", "questionnaire", "bottom_line", "final", "rehash", "contact_before_start", "start", "solo", "promoted"];
  const thisWeekCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    kpiStages.forEach((s) => { counts[s] = countInRange(allOwnCandidates, s, thisWeek.start, thisWeek.end); });
    return counts;
  }, [allOwnCandidates, thisWeek]);

  // Recruitment conversion pairs for inline display
  const conversionPairs = useMemo(() => {
    const pairs: { from: PipelineStage; to: PipelineStage; label: string }[] = [
      { from: "obs", to: "questionnaire", label: "→" },
      { from: "questionnaire", to: "bottom_line", label: "→" },
      { from: "bottom_line", to: "final", label: "→" },
      { from: "final", to: "rehash", label: "→" },
      { from: "rehash", to: "contact_before_start", label: "→" },
      { from: "contact_before_start", to: "start", label: "→" },
      { from: "start", to: "solo", label: "→" },
      { from: "solo", to: "promoted", label: "→" },
    ];
    return pairs.map(({ from, to, label }) => {
      const fromCount = thisWeekCounts[from] || 0;
      const toCount = thisWeekCounts[to] || 0;
      const pct = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
      return { from, to, label, pct };
    });
  }, [thisWeekCounts]);

  const linkedInThisWeek = useMemo(() => {
    const freeAds = adUploads.filter((a) => { const d = new Date(a.date); return a.type === "free" && d >= thisWeek.start && d <= thisWeek.end; }).length;
    const paidAds = adUploads.filter((a) => { const d = new Date(a.date); return a.type === "paid" && d >= thisWeek.start && d <= thisWeek.end; }).length;
    const cvs = cvDownloads.filter((c) => { const d = new Date(c.downloadDate); return d >= thisWeek.start && d <= thisWeek.end; }).reduce((sum, c) => sum + c.count, 0);
    const linkedInObs = allOwnCandidates.filter((c) => {
      const created = new Date(c.createdAt);
      return c.source?.toLowerCase() === "linkedin" && created >= thisWeek.start && created <= thisWeek.end;
    }).length;
    return { freeAds, paidAds, cvs, linkedInObs };
  }, [adUploads, cvDownloads, thisWeek, allOwnCandidates]);

  // Crew Summary
  const crewSummary = useMemo(() => {
    if ((!isLeader && !isManager) || !profile) return null;
    const isNotDropped = (c: Candidate) => c.status?.toLowerCase() !== "dropped" && !c.archivedAt && !c.dropOffDate;
    const descendantIds = getDescendantProfileIds(profile.id, allProfiles);
    const allSubtreeCandidates = allCandidates.filter((c) => c.recruitedBy && descendantIds.has(c.recruitedBy));
    const activeTeam = allSubtreeCandidates.filter((c) => ["start", "solo", "promoted"].includes(c.stage) && isNotDropped(c));
    const headCount = activeTeam.length + 1;
    const brandAmbassadors = activeTeam.filter((c) => c.stage === "start" || c.stage === "solo").length;
    const leaders = activeTeam.filter((c) => c.stage === "promoted").length + 1;
    const startsThisWeek = allSubtreeCandidates.filter((c) => {
      if (!isNotDropped(c)) return false;
      return c.history.some((h) => { const d = parseISO(h.date); return h.to === "start" && d >= thisWeek.start && d <= thisWeek.end; });
    }).length;
    const promotionsThisWeek = allSubtreeCandidates.filter((c) => {
      if (!isNotDropped(c)) return false;
      return c.history.some((h) => { const d = parseISO(h.date); return h.to === "promoted" && d >= thisWeek.start && d <= thisWeek.end; });
    }).length;
    const soloOrAboveCandidateIds = new Set(activeTeam.filter((c) => ["solo", "promoted"].includes(c.stage)).map((c) => c.id));
    const soloUserIds = new Set(
      allProfiles.filter((p) => descendantIds.has(p.id) && p.candidate_record_id && soloOrAboveCandidateIds.has(p.candidate_record_id)).map((p) => p.user_id)
    );
    if (user) soloUserIds.add(user.id);
    const sellingUserIds = new Set<string>();
    crewSalesEntries.forEach((entry: any) => { if ((entry.sales || 0) >= 1) sellingUserIds.add(entry.user_id); });
    const hcs = [...sellingUserIds].filter((uid) => soloUserIds.has(uid)).length;
    const potentialNewStarts = allSubtreeCandidates.filter((c) => (c.stage === "contact_before_start" || c.stage === "rehash") && isNotDropped(c)).length;
    return { headCount, brandAmbassadors, leaders, startsThisWeek, promotionsThisWeek, hcs, potentialNewStarts };
  }, [isLeader, isManager, profile, allCandidates, allProfiles, thisWeek, crewSalesEntries]);

  // Per-crew-member individual average gauges
  const crewMemberGauges = useMemo(() => {
    if (!showCrewColumns || !profile) return [];
    const descendantIds = getDescendantProfileIds(profile.id, allProfiles);
    const byUser = new Map<string, any[]>();
    crewSalesEntries.forEach((e: any) => {
      if (e.user_id === user?.id) return;
      if (!byUser.has(e.user_id)) byUser.set(e.user_id, []);
      byUser.get(e.user_id)!.push(e);
    });
    const members: { userId: string; name: string; means: Record<string, number> }[] = [];
    byUser.forEach((entries, userId) => {
      const prof = allProfiles.find(p => p.user_id === userId);
      if (!prof) return;
      if (!descendantIds.has(prof.id)) return;
      const means = calcMeanGauges(entries);
      if (means) {
        members.push({ userId, name: prof.full_name, means });
      }
    });
    members.sort((a, b) => (b.means.sales || 0) - (a.means.sales || 0));
    return members;
  }, [showCrewColumns, profile, allProfiles, crewSalesEntries, user]);

  // Crew Tree
  const treeCandidatesForBuild = useMemo(() => allCandidates.map((c) => ({ ...c, recruitedBy: c.recruitedBy ?? undefined })), [allCandidates]);
  const subtreeTreeCandidates = useMemo(() => {
    if (!profile || allProfiles.length === 0) return treeCandidatesForBuild;
    const subtreeIds = getDescendantProfileIds(profile.id, allProfiles);
    return treeCandidatesForBuild.filter((c) => c.recruitedBy && subtreeIds.has(c.recruitedBy));
  }, [treeCandidatesForBuild, allProfiles, profile]);
  const crewTree = useMemo(() => {
    if (!profile || allProfiles.length === 0) return { id: "root", name: "You", isLeader: true, isPredicted: false, children: [] } as CrewNode;
    return buildRecursiveTree(profile.id, profile.full_name, allProfiles, subtreeTreeCandidates);
  }, [subtreeTreeCandidates, allProfiles, profile]);
  const crewSalesMap = useMemo(() => {
    const map = new Map<string, number>();
    crewSalesEntries.forEach((e: any) => { map.set(e.user_id, (map.get(e.user_id) || 0) + (e.sales || 0)); });
    return map;
  }, [crewSalesEntries]);
  const profileUserMap = useMemo(() => {
    const m = new Map<string, string>();
    allProfiles.forEach((p) => m.set(p.id, p.user_id));
    return m;
  }, [allProfiles]);
  const candidateStageMap = useMemo(() => {
    const m = new Map<string, string>();
    allCandidates.forEach((c) => m.set(c.id, c.stage));
    return m;
  }, [allCandidates]);
  const crewTreeNodeCount = useMemo(() => {
    function count(n: CrewNode): number { return 1 + n.children.reduce((s, c) => s + count(c), 0); }
    return count(crewTree);
  }, [crewTree]);

  // PDF Export
  const handleDownloadPDF = useCallback(async () => {
    if (!summaryRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(summaryRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) { position = heightLeft - pdfHeight; pdf.addPage(); pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight); heightLeft -= pageHeight; }
      pdf.save(`Weekly_Summary_${format(thisWeek.start, "yyyy-MM-dd")}to${format(thisWeek.end, "yyyy-MM-dd")}.pdf`);
    } catch (err) { console.error("PDF export error:", err); }
    finally { setExporting(false); }
  }, [thisWeek]);

  const loading = candidatesLoading || linkedInLoading || allCandidatesLoading || profilesLoading || salesLoading;

  const crewName = profile ? (allProfiles.find(p => p.user_id === profile.user_id)?.crew_name || "") : "";
  const mondayLabel = format(thisWeek.start, "do MMMM yyyy");
  const summaryTitle = crewName ? `${crewName} – WC ${mondayLabel}` : `WC ${mondayLabel}`;
  const dateLabel = `${format(thisWeek.start, "do MMM")} – ${format(thisWeek.end, "do MMM")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  // ── Improvement simulation tooltip content builder ──
  function SimTooltipContent({ sim, means, entries }: { sim: SimResult; means: Record<string, number>; entries: any[] }) {
    const daysLogged = entries.length;
    const currentWeeklySales = means.sales * daysLogged;
    const projectedWeeklySales = sim.adjusted.sales * daysLogged;
    const delta = projectedWeeklySales - currentWeeklySales;
    const deltaPerWeek = daysLogged > 0 ? delta / daysLogged * 7 : 0;
    return (
      <div className="space-y-1.5 max-w-xs">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-primary" />
          <span className="text-xs font-semibold">Improvement Simulation</span>
        </div>
        {sim.isSpokenPriority ? (
          <p className="text-[11px] text-muted-foreground">Focus: <span className="font-medium text-foreground">Spoken</span> · {sim.spokenActualPct}% of target</p>
        ) : sim.weakestDev && (
          <p className="text-[11px] text-muted-foreground">Focus: <span className="font-medium text-foreground">{GAUGE_LABELS[sim.weakestDev.from]}→{GAUGE_LABELS[sim.weakestDev.to]}</span> · Target {sim.weakestDev.targetPct}% · Actual {sim.weakestDev.pct}%</p>
        )}
        <div className="flex flex-wrap gap-1 text-[10px]">
          {GAUGE_KEYS.map((key) => {
            const changed = sim.adjusted[key] !== means[key];
            return (
              <span key={key} className={`${changed ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                {GAUGE_LABELS[key]} {sim.adjusted[key]}
              </span>
            );
          })}
        </div>
        {deltaPerWeek >= 0.5 && (
          <p className={`text-[10px] ${deltaPerWeek > 1 ? "text-primary font-medium" : "text-muted-foreground"}`}>
            +{deltaPerWeek.toFixed(1)} sales/week
          </p>
        )}
      </div>
    );
  }

  // ── Compact sales gauge row ──
  function SalesGaugeRow({ means, deviations, sim, label }: {
    means: Record<string, number>;
    deviations: ReturnType<typeof calcDeviations>;
    sim: SimResult | null;
    label: string;
  }) {
    const content = (
      <div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{label}</div>
        <div className="grid grid-cols-6 gap-1">
          {GAUGE_KEYS.map((key) => {
            const isSpokenWeak = sim?.isSpokenPriority && key === "spoken";
            return (
              <div key={key} className="text-center">
                <div className={`text-[8px] ${isSpokenWeak ? "text-destructive/70" : "text-muted-foreground"}`}>{GAUGE_LABELS[key]}</div>
                <div className={`text-base font-bold tabular-nums ${isSpokenWeak ? "text-destructive" : "text-foreground"}`}>{means[key]}</div>
              </div>
            );
          })}
        </div>
        {/* Conversion row */}
        <div className="flex justify-center gap-2 mt-0.5">
          {deviations.map((d) => {
            const isWeakest = sim && !sim.isSpokenPriority && sim.weakestDev?.from === d.from;
            return (
              <span key={d.label} className={`text-[9px] tabular-nums ${isWeakest ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {d.label} {d.pct}%
              </span>
            );
          })}
        </div>
      </div>
    );

    if (!sim) return content;

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{content}</div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-popover border-border p-3">
            <SimTooltipContent sim={sim} means={means} entries={label.includes("Crew") ? crewSalesEntries : ownSalesEntries} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ── Compact 2-column KPI funnel ──
  function RecruitmentKPIsCompact() {
    const leftStages: PipelineStage[] = ["obs", "questionnaire", "bottom_line", "final", "rehash"];
    const rightStages: PipelineStage[] = ["contact_before_start", "start", "solo", "promoted"];
    
    function StageBlock({ stages, startConvIdx }: { stages: PipelineStage[]; startConvIdx: number }) {
      return (
        <div className="space-y-0">
          {stages.map((stage, i) => {
            const count = thisWeekCounts[stage] || 0;
            const convIdx = startConvIdx + i;
            const conv = convIdx > 0 && convIdx <= conversionPairs.length ? conversionPairs[convIdx - 1] : null;
            // For right column, first item needs the bridging conversion from rehash→cbs
            const bridgeConv = startConvIdx > 0 && i === 0 ? conversionPairs[startConvIdx - 1] : null;
            const showConv = i > 0 ? conversionPairs[startConvIdx + i - 1] : bridgeConv;
            return (
              <div key={stage}>
                {showConv && (
                  <div className="flex items-center justify-center py-px">
                    <ChevronDown className="w-2 h-2 text-muted-foreground/40" />
                    <span className={`text-[8px] tabular-nums ml-0.5 ${showConv.pct === 0 ? "text-muted-foreground/40" : showConv.pct >= 80 ? "text-primary" : showConv.pct >= 50 ? "text-foreground" : "text-destructive"}`}>
                      {showConv.pct}%
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between bg-muted/20 rounded px-1.5 py-0.5">
                  <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{STAGE_CONFIG[stage].label}</span>
                  <span className="text-xs font-bold text-foreground tabular-nums">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="bg-card/80 border border-border/50 rounded-lg p-2">
        <SectionLabel icon={Target} label="Recruitment KPIs" />
        <div className="grid grid-cols-2 gap-1.5">
          <StageBlock stages={leftStages} startConvIdx={0} />
          <StageBlock stages={rightStages} startConvIdx={5} />
        </div>
      </div>
    );
  }

  // ── Compact crew member gauges list ──
  function CrewMemberGaugesList() {
    if (!showCrewColumns) return null;
    if (crewMemberGauges.length === 0) {
      return (
        <div className="bg-card/80 border border-border/50 rounded-lg p-2.5">
          <SectionLabel icon={Users} label="Crew Individual Averages" />
          <p className="text-[10px] text-muted-foreground text-center py-2">No crew members with data this week</p>
        </div>
      );
    }
    return (
      <div className="bg-card/80 border border-border/50 rounded-lg p-2.5 flex-1 min-h-0 overflow-y-auto">
        <SectionLabel icon={Users} label="Crew Individual Averages" />
        <div className="space-y-1.5">
          {crewMemberGauges.map((member) => (
            <div key={member.userId} className="bg-muted/20 rounded-md px-2 py-1.5">
              <div className="text-[9px] font-medium text-foreground mb-0.5 truncate">{member.name}</div>
              <div className="grid grid-cols-6 gap-0.5">
                {GAUGE_KEYS.map((key) => (
                  <div key={key} className="text-center">
                    <div className="text-[7px] text-muted-foreground">{GAUGE_LABELS[key]}</div>
                    <div className="text-xs font-bold tabular-nums text-foreground">{member.means[key]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── RENDER ──

  return (
    <div ref={summaryRef} className="h-full flex flex-col gap-2 lg:gap-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-foreground leading-tight">{summaryTitle}</h2>
          <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
        </div>
        <button onClick={handleDownloadPDF} disabled={exporting} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          <Download className="w-3 h-3" />
          {exporting ? "…" : "PDF"}
        </button>
      </div>

      {/* ═══ MOBILE: Vertical stack ═══ */}
      <div className="lg:hidden flex-1 overflow-y-auto space-y-3 pb-4">
        {/* Sales */}
        {individualMeans && individualDeviations && (
          <div className="bg-card/80 border border-border/50 rounded-lg p-3">
            <SalesGaugeRow means={individualMeans} deviations={individualDeviations} sim={individualSim} label="My Sales Performance" />
          </div>
        )}
        <BellStreakCard />
        {crewMeans && crewDeviations && (
          <div className="bg-card/80 border border-border/50 rounded-lg p-3">
            <SalesGaugeRow means={crewMeans} deviations={crewDeviations} sim={crewSim} label="Crew Sales" />
          </div>
        )}
        {/* Crew Tree */}
        {showCrewColumns && !isManager && isLeader && (
          <div className="bg-card/80 border border-border/50 rounded-lg p-3">
            <SectionLabel icon={GitBranch} label={`Crew Tree (${crewTreeNodeCount})`} />
            <CrewTree tree={crewTree} showSales salesMap={crewSalesMap} profileUserMap={profileUserMap} candidateStageMap={candidateStageMap} />
          </div>
        )}
        {/* Crew Member Gauges */}
        <CrewMemberGaugesList />
        {/* Commission */}
        {ownTransactions.length > 0 && (
          <div className="bg-card/80 border border-border/50 rounded-lg p-3">
            <SectionLabel icon={Flame} label="Commission" color="hsl(0 70% 50%)" />
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Rep Profit" value={`£${ownFinancials.repProfit.toFixed(0)}`} />
              <StatBox label="Quality (30%)" value={`£${ownFinancials.qualityPending.toFixed(0)}`} className="opacity-60" />
            </div>
          </div>
        )}
        {/* Recruitment KPIs */}
        <RecruitmentKPIsCompact />
        {/* LinkedIn */}
        <div className="bg-card/80 border border-border/50 rounded-lg p-3">
          <SectionLabel icon={Target} label="LinkedIn" />
          <div className="grid grid-cols-2 gap-1.5">
            <StatBox label="Free Ads" value={linkedInThisWeek.freeAds} small />
            <StatBox label="Paid Ads" value={linkedInThisWeek.paidAds} small />
            <StatBox label="CVs" value={linkedInThisWeek.cvs} small />
            <StatBox label="LI OBs" value={linkedInThisWeek.linkedInObs} small />
          </div>
        </div>
        {/* Crew Summary */}
        {showCrewColumns && crewSummary && (
          <div className="bg-card/80 border border-border/50 rounded-lg p-3">
            <SectionLabel icon={Users} label="Crew Summary" />
            <div className="grid grid-cols-2 gap-1.5">
              <StatBox label="Headcount" value={crewSummary.headCount} small />
              <StatBox label="HCS" value={crewSummary.hcs} small />
              <StatBox label="BAs" value={crewSummary.brandAmbassadors} small />
              <StatBox label="Leaders" value={crewSummary.leaders} small />
              <StatBox label="Starts" value={crewSummary.startsThisWeek} small />
              <StatBox label="Promos" value={crewSummary.promotionsThisWeek} small />
            </div>
          </div>
        )}
      </div>

      {/* ═══ DESKTOP: 2-row layout — top panels + bottom panels ═══ */}
      <div className="hidden lg:flex flex-col flex-1 min-h-0 gap-1.5">

        {/* ── TOP ROW: 3 panels (or 2 for BAs) ── */}
        <div className="grid gap-1.5 flex-shrink-0" style={{ gridTemplateColumns: showCrewColumns ? "1fr 1.2fr 1fr" : "1fr 1fr", height: "45%" }}>

          {/* Panel 1: My Sales Performance + Bell Streak */}
          <div className="flex flex-col gap-1.5 min-h-0">
            <div className="bg-card/80 border border-[hsl(0_70%_50%/0.3)] rounded-lg p-2 flex-shrink-0">
              <SectionLabel icon={Flame} label="My Sales Performance — This Week" color="hsl(0 70% 50%)" />
              {individualMeans && individualDeviations ? (
                <SalesGaugeRow means={individualMeans} deviations={individualDeviations} sim={individualSim} label="Daily Average" />
              ) : (
                <div className="text-[10px] text-muted-foreground text-center py-1">No sales data this week</div>
              )}
            </div>
            <div className="flex-shrink-0">
              <BellStreakCard />
            </div>
          </div>

          {/* Panel 2 (Leaders/Managers): Crew Tree */}
          {showCrewColumns && (
            <div className="bg-card/80 border border-border/50 rounded-lg p-2 min-h-0 flex flex-col">
              <SectionLabel icon={GitBranch} label={`Crew Tree (${crewTreeNodeCount})`} />
              <div className="flex-1 min-h-0 overflow-auto">
                {!isManager && isLeader && (
                  <CrewTree tree={crewTree} showSales salesMap={crewSalesMap} profileUserMap={profileUserMap} candidateStageMap={candidateStageMap} />
                )}
              </div>
            </div>
          )}

          {/* Panel 3: Recruitment KPIs (compact 2-col) + LinkedIn inline */}
          <div className="flex flex-col gap-1.5 min-h-0">
            <RecruitmentKPIsCompact />
            <div className="bg-card/80 border border-border/50 rounded-lg p-2 flex-shrink-0">
              <SectionLabel icon={Target} label="LinkedIn" />
              <div className="grid grid-cols-4 gap-1">
                <StatBox label="Free" value={linkedInThisWeek.freeAds} small />
                <StatBox label="Paid" value={linkedInThisWeek.paidAds} small />
                <StatBox label="CVs" value={linkedInThisWeek.cvs} small />
                <StatBox label="LI OBs" value={linkedInThisWeek.linkedInObs} small />
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW: 3 panels (or 2 for BAs) ── */}
        <div className="grid gap-1.5 flex-1 min-h-0" style={{ gridTemplateColumns: showCrewColumns ? "1fr 1.2fr 1fr" : "1fr 1fr" }}>

          {/* Bottom Left: Commission + Personal Best */}
          <div className="flex flex-col gap-1.5 min-h-0">
            {ownTransactions.length > 0 && (
              <div className="bg-card/80 border border-border/50 rounded-lg p-2 flex-shrink-0">
                <SectionLabel icon={Flame} label="Commission" color="hsl(0 70% 50%)" />
                <div className="grid grid-cols-2 gap-1">
                  <StatBox label="Rep Profit" value={`£${ownFinancials.repProfit.toFixed(0)}`} small />
                  <StatBox label="Quality" value={`£${ownFinancials.qualityPending.toFixed(0)}`} small className="opacity-60" />
                </div>
                {crewFinancials && crewFinancials.crewTotalWire > 0 && (
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    <StatBox label="Crew Wire" value={`£${crewFinancials.crewTotalWire.toFixed(0)}`} small />
                    <StatBox label="Avg/Seller" value={`£${crewFinancials.crewAvgWire.toFixed(0)}`} small />
                    <StatBox label="HCS" value={crewFinancials.headcountSelling} small />
                  </div>
                )}
              </div>
            )}
            {/* Personal Best */}
            {(() => {
              const trackMetrics: { key: PipelineStage; label: string }[] = [
                { key: "obs", label: "OBs" }, { key: "start", label: "Starts" }, { key: "promoted", label: "Promotions" },
              ];
              const records: { metric: string; previousBest: number; current: number }[] = [];
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
              if (records.length === 0) return null;
              return (
                <div className="bg-primary/5 border border-primary/30 rounded-lg p-2 flex-shrink-0">
                  <SectionLabel icon={Trophy} label="Personal Best" />
                  {records.map((r) => (
                    <div key={r.metric} className="flex items-center gap-2 text-xs">
                      <span>🏆</span>
                      <span className="text-foreground font-medium">{r.metric}</span>
                      <span className="text-muted-foreground">prev {r.previousBest}</span>
                      <span className="ml-auto text-primary font-bold text-sm">{r.current}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Bottom Center (Leaders/Managers): Crew Performance + Crew Member Averages */}
          {showCrewColumns && (
            <div className="flex flex-col gap-1.5 min-h-0">
              {crewMeans && crewDeviations && (
                <div className="bg-card/80 border border-border/50 rounded-lg p-2 flex-shrink-0">
                  <SalesGaugeRow means={crewMeans} deviations={crewDeviations} sim={crewSim} label="Crew Performance" />
                </div>
              )}
              <CrewMemberGaugesList />
            </div>
          )}

          {/* Bottom Right: Crew Summary (or BA extras) */}
          <div className="flex flex-col gap-1.5 min-h-0">
            {showCrewColumns && crewSummary && (
              <div className="bg-card/80 border border-border/50 rounded-lg p-2">
                <SectionLabel icon={Users} label="Crew Summary" />
                <div className="grid grid-cols-3 gap-1">
                  <StatBox label="Headcount" value={crewSummary.headCount} small />
                  <StatBox label="HCS" value={crewSummary.hcs} small />
                  <StatBox label="BAs" value={crewSummary.brandAmbassadors} small />
                  <StatBox label="Leaders" value={crewSummary.leaders} small />
                  <StatBox label="Starts" value={crewSummary.startsThisWeek} small />
                  <StatBox label="Promos" value={crewSummary.promotionsThisWeek} small />
                  <StatBox label="Pipeline" value={crewSummary.potentialNewStarts} small className="col-span-3" />
                </div>
              </div>
            )}
            {!showCrewColumns && (
              <>
                <RecruitmentKPIsCompact />
                <div className="bg-card/80 border border-border/50 rounded-lg p-2">
                  <SectionLabel icon={Target} label="LinkedIn" />
                  <div className="grid grid-cols-4 gap-1">
                    <StatBox label="Free" value={linkedInThisWeek.freeAds} small />
                    <StatBox label="Paid" value={linkedInThisWeek.paidAds} small />
                    <StatBox label="CVs" value={linkedInThisWeek.cvs} small />
                    <StatBox label="LI OBs" value={linkedInThisWeek.linkedInObs} small />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
