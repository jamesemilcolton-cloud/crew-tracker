import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { getAdjustedRepProfit } from "@/lib/commission";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { SalesTransaction } from "@/hooks/useSalesTransactions";
import { Candidate, STAGES_ORDER, STAGE_CONFIG, PipelineStage } from "@/lib/types";
import { useCandidates } from "@/hooks/useCandidates";
import { useLinkedIn } from "@/hooks/useLinkedIn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trophy, Users, GitBranch, Flame, TrendingUp, Target, Lock } from "lucide-react";
import {
  CrewBubbleSnapshot,
  getDescendantProfileIds,
  buildRecursiveTree,
  CrewNode,
} from "@/components/crew/CrewBubbleForecast";
import { CrewTree } from "@/components/crew/CrewTree";
import { BellStreakCard } from "@/components/summary/BellStreakCard";
import { startOfWeek, endOfWeek, parseISO, format } from "date-fns";


interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
  crew_name: string;
  phone: string;
}

/** Map pipeline stage to a display role label */
function getRoleLabel(stage: string): string {
  switch (stage) {
    case "start": return "Brand Ambassador";
    case "solo": return "Solo";
    case "promoted": return "Leader";
    default: return "";
  }
}

// Summary tree rendering is now handled by the shared CrewTree component

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
      return;
    }
    // Use snapshot approach: check if candidate's final position in the range includes this stage
    const historyInRange = c.history.filter((h) => {
      const d = parseISO(h.date);
      return d >= start && d <= end;
    });
    if (historyInRange.length > 0) {
      const lastEntry = historyInRange[historyInRange.length - 1];
      const finalIdx = STAGES_ORDER.indexOf(lastEntry.to as PipelineStage);
      const stageIdx = STAGES_ORDER.indexOf(stage);
      // Candidate counts for this stage if their final position is at or beyond it
      if (finalIdx >= stageIdx) count++;
    }
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

  const { profiles: sharedProfiles, loading: profilesLoading } = useProfiles();
  const allProfilesRaw = sharedProfiles as Profile[];

  // Fetch manager user_ids to exclude from crew tree
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

  // Filter out manager/super_admin profiles from tree building
  const allProfiles = useMemo(
    () => allProfilesRaw.filter((p) => !managerUserIds.has(p.user_id)),
    [allProfilesRaw, managerUserIds]
  );

  const isManager = userRole?.role === "manager" && !!userRole?.super_admin;
  const isLeader = userRole?.role === "leader";

  // Sales snapshot data
  const [salesLoading, setSalesLoading] = useState(true);
  const [ownSalesEntries, setOwnSalesEntries] = useState<any[]>([]);
  const [crewSalesEntries, setCrewSalesEntries] = useState<any[]>([]);
  const [ownTransactions, setOwnTransactions] = useState<SalesTransaction[]>([]);
  const [crewTransactions, setCrewTransactions] = useState<SalesTransaction[]>([]);

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
      const [salesRes, txRes] = await Promise.all([
        supabase
          .from("sales_entries")
          .select("*")
          .eq("user_id", user!.id)
          .gte("entry_date", currentWeekBounds.start)
          .lte("entry_date", currentWeekBounds.end),
        supabase
          .from("sales_transactions")
          .select("id, user_id, date, week_start, age_band, ask_amount, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
          .eq("user_id", user!.id)
          .gte("date", currentWeekBounds.start)
          .lte("date", currentWeekBounds.end),
      ]);
      setOwnSalesEntries(salesRes.data ?? []);
      setOwnTransactions((txRes.data ?? []) as SalesTransaction[]);
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
        setCrewTransactions([]);
        setSalesLoading(false);
        return;
      }

      if (role === "manager" && userRole.super_admin) {
        const [salesRes, txRes] = await Promise.all([
          supabase.from("sales_entries").select("*")
            .gte("entry_date", currentWeekBounds.start)
            .lte("entry_date", currentWeekBounds.end),
          supabase.from("sales_transactions").select("id, user_id, date, week_start, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
            .gte("date", currentWeekBounds.start)
            .lte("date", currentWeekBounds.end),
        ]);
        setCrewSalesEntries(salesRes.data ?? []);
        setCrewTransactions((txRes.data ?? []) as SalesTransaction[]);
      } else {
        const { data: profiles } = await supabase.from("profiles").select("id, user_id, leader_id");
        if (!profiles || !profile) { setSalesLoading(false); return; }

        const myProfileId = profile.id;
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

        const [salesRes, txRes] = await Promise.all([
          supabase.from("sales_entries").select("*")
            .in("user_id", uniqueIds)
            .gte("entry_date", currentWeekBounds.start)
            .lte("entry_date", currentWeekBounds.end),
          supabase.from("sales_transactions").select("id, user_id, date, week_start, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
            .in("user_id", uniqueIds)
            .gte("date", currentWeekBounds.start)
            .lte("date", currentWeekBounds.end),
        ]);
        setCrewSalesEntries(salesRes.data ?? []);
        setCrewTransactions((txRes.data ?? []) as SalesTransaction[]);
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

  // Target gauge values for deviation analysis
  const TARGET_GAUGES: Record<string, number> = {
    doors: 120, spoken: 80, presentations: 30, closes: 25, tablets: 10, sales: 3,
  };

  // Funnel conversion % between adjacent stages (excluding Doors→Spoken)
  const FUNNEL_PAIRS = [
    { from: "spoken", to: "presentations", label: "S→P" },
    { from: "presentations", to: "closes", label: "P→C" },
    { from: "closes", to: "tablets", label: "C→T" },
    { from: "tablets", to: "sales", label: "T→S" },
  ] as const;

  // Target conversion benchmarks derived from TARGET_GAUGES
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
      ...a,
      targetPct: TARGET_CONVERSIONS[i].pct,
      gap: TARGET_CONVERSIONS[i].pct - a.pct,
    }));
  }

  // Spoken priority: check if Spoken volume underperformance is worse than all conversion deviations
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

    // Step 1: Check Spoken volume vs target
    const spokenActualPct = TARGET_GAUGES.spoken > 0 ? Math.round((means.spoken / TARGET_GAUGES.spoken) * 100) : 100;
    const spokenGap = 100 - spokenActualPct; // how far from 100% of target

    // Find worst conversion deviation
    const worstConv = deviations.reduce((worst, d) => d.gap > worst.gap ? d : worst, deviations[0]);

    if (spokenGap > 0 && spokenGap > worstConv.gap) {
      // Spoken volume is the primary weakness
      const adjusted = { ...means };
      adjusted.spoken = TARGET_GAUGES.spoken;
      // Propagate downstream using actual conversion ratios
      for (let i = 1; i < funnel.length - 1; i++) {
        const actualConv = actuals.find(c => c.from === funnel[i] && c.to === funnel[i + 1]);
        const ratio = actualConv ? actualConv.pct / 100 : 0;
        adjusted[funnel[i + 1]] = Math.round(adjusted[funnel[i]] * ratio);
      }
      return { adjusted, isSpokenPriority: true, weakestDev: null, spokenTargetPct: 100, spokenActualPct };
    }

    if (worstConv.gap <= 0) return null;

    // Step 2: Conversion stage is weakest
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

  // Financial summaries from transactions
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
      (acc, t) => ({
        totalWire: acc.totalWire + Number(t.total_wire),
        count: acc.count + 1,
      }),
      { totalWire: 0, count: 0 }
    );
    // Count unique sellers
    const sellerIds = new Set(crewTransactions.map((t) => t.user_id));
    const sellerCount = sellerIds.size;
    return {
      crewTotalWire: +totals.totalWire.toFixed(2),
      crewAvgWire: sellerCount > 0 ? +(totals.totalWire / sellerCount).toFixed(2) : 0,
      headcountSelling: sellerCount,
    };
  }, [crewTransactions, userRole]);

  // Profiles now provided by ProfilesContext - no duplicate fetch needed

  const thisWeek = useMemo(() => getWeekBounds(0), []);

  // Use ownCandidates from useCandidates("own") instead of a separate fetch
  const allOwnCandidates = ownCandidates;

  // SECTION 1: Recruitment KPIs
  const kpiStages: PipelineStage[] = ["obs", "questionnaire", "bottom_line", "final", "rehash", "contact_before_start", "start", "solo", "promoted"];
  const thisWeekCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    kpiStages.forEach((s) => { counts[s] = countInRange(allOwnCandidates, s, thisWeek.start, thisWeek.end); });
    return counts;
  }, [allOwnCandidates, thisWeek]);

  const conversions = useMemo(() => {
    const pairs: { from: PipelineStage; to: PipelineStage; label: string }[] = [
      { from: "obs", to: "questionnaire", label: "Obs → Quest" },
      { from: "questionnaire", to: "bottom_line", label: "Quest → BL" },
      { from: "bottom_line", to: "final", label: "BL → Final" },
      { from: "final", to: "rehash", label: "Final → Rehash" },
      { from: "rehash", to: "contact_before_start", label: "Rehash → CBS" },
      { from: "contact_before_start", to: "start", label: "CBS → Start" },
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
    const linkedInObs = allOwnCandidates.filter((c) => {
      const created = new Date(c.createdAt);
      return c.source?.toLowerCase() === "linkedin" && created >= thisWeek.start && created <= thisWeek.end;
    }).length;
    return { freeAds, paidAds, cvs, linkedInObs };
  }, [adUploads, cvDownloads, thisWeek, thisWeekCounts]);

  // SECTION 3: Crew Summary (leaders + managers)
  const crewSummary = useMemo(() => {
    if ((!isLeader && !isManager) || !profile) return null;

    // Helper: check if a candidate is NOT dropped
    const isNotDropped = (c: Candidate) =>
      c.status?.toLowerCase() !== "dropped" && !c.archivedAt && !c.dropOffDate;

    // Recursive descendant profile IDs (inclusive of self)
    const descendantIds = getDescendantProfileIds(profile.id, allProfiles);

    // All subtree candidates: recruited by anyone in the subtree (including leader's own recruits)
    const allSubtreeCandidates = allCandidates.filter(
      (c) => c.recruitedBy && descendantIds.has(c.recruitedBy)
    );

    // 1. HEADCOUNT: candidates at start/solo/promoted, not dropped
    const activeTeam = allSubtreeCandidates.filter(
      (c) => ["start", "solo", "promoted"].includes(c.stage) && isNotDropped(c)
    );
    // Include the current user themselves (they are a leader, so they've reached start+)
    // +1 for self
    const headCount = activeTeam.length + 1;

    // 4. BRAND AMBASSADORS: active team at start or solo (self is leader, not BA)
    const brandAmbassadors = activeTeam.filter((c) => c.stage === "start" || c.stage === "solo").length;

    // 5. LEADERS: active team at promoted + self (current user is a leader)
    const leaders = activeTeam.filter((c) => c.stage === "promoted").length + 1;

    // 6. TEAM STARTS THIS WEEK: unique candidates with a history entry "to: start" this week
    const startsThisWeek = allSubtreeCandidates.filter((c) => {
      if (!isNotDropped(c)) return false;
      return c.history.some((h) => {
        const d = parseISO(h.date);
        return h.to === "start" && d >= thisWeek.start && d <= thisWeek.end;
      });
    }).length;

    // 7. TEAM PROMOTIONS THIS WEEK: unique candidates with history entry "to: promoted" this week
    const promotionsThisWeek = allSubtreeCandidates.filter((c) => {
      if (!isNotDropped(c)) return false;
      return c.history.some((h) => {
        const d = parseISO(h.date);
        return h.to === "promoted" && d >= thisWeek.start && d <= thisWeek.end;
      });
    }).length;

    // 2. HCS: crew members at solo+ with ≥1 sale this week
    // Build phone→candidate stage map for active candidates at solo+
    const soloOrAbovePhones = new Set(
      activeTeam.filter((c) => ["solo", "promoted"].includes(c.stage)).map((c) => c.phone).filter(Boolean)
    );
    // Get user_ids of crew members at solo+ by matching profile phone to candidate phone
    const soloUserIds = new Set(
      allProfiles
        .filter((p) => descendantIds.has(p.id) && p.phone && soloOrAbovePhones.has(p.phone))
        .map((p) => p.user_id)
    );
    // Also include the current user (leader) — they are solo+ by definition
    if (user) soloUserIds.add(user.id);
    // Count those with ≥1 sale this week
    const sellingUserIds = new Set<string>();
    crewSalesEntries.forEach((entry: any) => {
      if ((entry.sales || 0) >= 1) sellingUserIds.add(entry.user_id);
    });
    const hcs = [...sellingUserIds].filter((uid) => soloUserIds.has(uid)).length;

    // 3. POTENTIAL NEW STARTS: candidates in rehash or contact_before_start, not dropped
    const potentialNewStarts = allSubtreeCandidates.filter(
      (c) => (c.stage === "contact_before_start" || c.stage === "rehash") && isNotDropped(c)
    ).length;

    return { headCount, brandAmbassadors, leaders, startsThisWeek, promotionsThisWeek, hcs, potentialNewStarts };
  }, [isLeader, isManager, profile, allCandidates, allProfiles, thisWeek, crewSalesEntries]);

  // Reuse allCandidates from useCandidates("all") instead of a separate fetch
  const treeCandidatesForBuild = useMemo(() => allCandidates.map((c) => ({
    ...c,
    recruitedBy: c.recruitedBy ?? undefined,
  })), [allCandidates]);

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

  const loading = candidatesLoading || linkedInLoading || allCandidatesLoading || profilesLoading || salesLoading;

  const crewName = profile ? (allProfiles.find(p => p.user_id === profile.user_id)?.crew_name || "") : "";
  const mondayLabel = format(thisWeek.start, "do MMMM yyyy");
  const summaryTitle = crewName
    ? `${crewName} – Week Commencing ${mondayLabel} Summary`
    : `Week Commencing ${mondayLabel} Summary`;

  const dateLabel = `${format(thisWeek.start, "do MMM")} – ${format(thisWeek.end, "do MMM yyyy")}`;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted/30 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-40 bg-muted/20 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!salesLoading && ownSalesEntries.length === 0 && ownCandidates.length === 0) {
    // Show empty state only if all data has loaded
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
          <CardContent className="space-y-3">
            {/* YOUR PERFORMANCE */}
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Your Performance</div>

            {individualMeans && individualDeviations ? (
              <>
                {/* Conversion % row - only 4 values, positioned between gauges 2-3, 3-4, 4-5, 5-6 */}
                <div className="relative">
                  <div className="grid" style={{ gridTemplateColumns: `repeat(11, 1fr)` }}>
                    {individualDeviations.map((d, i) => {
                      const isWeakest = individualSim && !individualSim.isSpokenPriority && individualSim.weakestDev?.from === d.from;
                      return (
                        <div key={d.label} className="text-center" style={{ gridColumn: `${(i + 1) * 2 + 2} / ${(i + 1) * 2 + 3}` }}>
                          <span className={`text-[10px] font-semibold ${isWeakest ? "text-destructive" : "text-muted-foreground"}`}>
                            {d.pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* SVG curved arrows */}
                  <div className="grid" style={{ gridTemplateColumns: `repeat(11, 1fr)` }}>
                    {individualDeviations.map((d, i) => {
                      const isWeakest = individualSim && !individualSim.isSpokenPriority && individualSim.weakestDev?.from === d.from;
                      const color = isWeakest ? "hsl(0 70% 50%)" : "hsl(var(--muted-foreground) / 0.35)";
                      return (
                        <div key={d.label + "-arrow"} className="flex justify-center" style={{ gridColumn: `${(i + 1) * 2 + 2} / ${(i + 1) * 2 + 3}` }}>
                          <svg width="32" height="16" viewBox="0 0 32 16">
                            <path d="M8 2 Q16 14 16 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ filter: isWeakest ? "drop-shadow(0 0 2px hsl(0 70% 50% / 0.4))" : "none" }} />
                            <path d="M24 2 Q16 14 16 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ filter: isWeakest ? "drop-shadow(0 0 2px hsl(0 70% 50% / 0.4))" : "none" }} />
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                  {/* Gauge row */}
                  <div className="grid mt-0.5" style={{ gridTemplateColumns: `repeat(11, 1fr)` }}>
                    {GAUGE_KEYS.map((key, i) => {
                      const isSpokenWeak = individualSim?.isSpokenPriority && key === "spoken";
                      return (
                        <div key={key} className="text-center" style={{ gridColumn: `${i * 2 + 1} / ${i * 2 + 2}` }}>
                          <div className={`text-[9px] ${isSpokenWeak ? "text-destructive/70" : "text-muted-foreground"}`}>
                            {GAUGE_LABELS[key]}
                          </div>
                          <div className={`text-sm font-bold ${isSpokenWeak ? "text-destructive" : "text-foreground"}`}>{individualMeans[key]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Improvement Simulation */}
                {individualSim && (
                  <div className="rounded-md p-2.5 border border-border/30 bg-muted/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-foreground">Improvement Simulation</span>
                    </div>
                    {individualSim.isSpokenPriority ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Primary Focus: <span className="font-medium text-foreground">Spoken</span>
                          {" · "}Current: {individualSim.spokenActualPct}% of target
                        </p>
                        <p className="text-[10px] text-muted-foreground">If Spoken improved to target ({TARGET_GAUGES.spoken}):</p>
                      </>
                    ) : individualSim.weakestDev && (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Primary Focus: <span className="font-medium text-foreground">{GAUGE_LABELS[individualSim.weakestDev.from]} → {GAUGE_LABELS[individualSim.weakestDev.to]}</span>
                          {" · "}Target: {individualSim.weakestDev.targetPct}% · Current: {individualSim.weakestDev.pct}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">If improved to target:</p>
                      </>
                    )}
                    <div className="flex items-center gap-1 flex-wrap text-xs">
                      {GAUGE_KEYS.map((key, i) => {
                        const changed = individualSim.adjusted[key] !== individualMeans[key];
                        return (
                          <span key={key} className="inline-flex items-center gap-0.5">
                            <span className="text-muted-foreground">{GAUGE_LABELS[key]}</span>
                            <span className={`font-semibold ${changed ? "text-primary" : "text-foreground"}`}>{individualSim.adjusted[key]}</span>
                            {i < GAUGE_KEYS.length - 1 && <span className="text-border mx-1">|</span>}
                          </span>
                        );
                      })}
                    </div>
                    {(() => {
                      const daysLogged = ownSalesEntries.length;
                      const currentWeeklySales = individualMeans.sales * daysLogged;
                      const projectedWeeklySales = individualSim.adjusted.sales * daysLogged;
                      const delta = projectedWeeklySales - currentWeeklySales;
                      const deltaPerWeek = daysLogged > 0 ? delta / daysLogged * 7 : 0;
                      if (deltaPerWeek < 0.5) {
                        return <p className="text-[10px] text-muted-foreground/70 mt-1">Impact minimal. Focus on activity volume.</p>;
                      } else if (deltaPerWeek > 1) {
                        return <p className="text-[10px] text-primary/80 mt-1 font-medium">High leverage improvement. Estimated +{deltaPerWeek.toFixed(1)} sales/week.</p>;
                      } else {
                        return <p className="text-[10px] text-muted-foreground mt-1">Estimated improvement: +{deltaPerWeek.toFixed(1)} sales/week.</p>;
                      }
                    })()}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground py-3 text-center">No sales data logged this week.</div>
            )}

        {/* Your Commission Summary */}
            {ownTransactions.length > 0 && (
              <div className="border-t border-border/30 pt-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Your Commission</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-md p-2 text-center">
                    <div className="text-[9px] uppercase text-muted-foreground">Rep Profit</div>
                    <div className="text-sm font-bold text-foreground">£{ownFinancials.repProfit.toFixed(2)}</div>
                  </div>
                  <div className="bg-muted/20 rounded-md p-2 text-center opacity-60">
                    <div className="text-[9px] uppercase text-muted-foreground">Quality (30%)</div>
                    <div className="text-sm font-bold text-muted-foreground">£{ownFinancials.qualityPending.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* CREW PERFORMANCE (Leader + Manager only) */}
            {crewMeans && crewDeviations && (
              <div className="border-t border-border/30 pt-3 space-y-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Crew Performance</div>

                <div className="relative">
                  <div className="grid" style={{ gridTemplateColumns: `repeat(11, 1fr)` }}>
                    {crewDeviations.map((d, i) => {
                      const isWeakest = crewSim && !crewSim.isSpokenPriority && crewSim.weakestDev?.from === d.from;
                      return (
                        <div key={d.label} className="text-center" style={{ gridColumn: `${(i + 1) * 2 + 2} / ${(i + 1) * 2 + 3}` }}>
                          <span className={`text-[10px] font-semibold ${isWeakest ? "text-destructive" : "text-muted-foreground"}`}>
                            {d.pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: `repeat(11, 1fr)` }}>
                    {crewDeviations.map((d, i) => {
                      const isWeakest = crewSim && !crewSim.isSpokenPriority && crewSim.weakestDev?.from === d.from;
                      const color = isWeakest ? "hsl(0 70% 50%)" : "hsl(var(--muted-foreground) / 0.35)";
                      return (
                        <div key={d.label + "-arrow"} className="flex justify-center" style={{ gridColumn: `${(i + 1) * 2 + 2} / ${(i + 1) * 2 + 3}` }}>
                          <svg width="32" height="16" viewBox="0 0 32 16">
                            <path d="M8 2 Q16 14 16 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ filter: isWeakest ? "drop-shadow(0 0 2px hsl(0 70% 50% / 0.4))" : "none" }} />
                            <path d="M24 2 Q16 14 16 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ filter: isWeakest ? "drop-shadow(0 0 2px hsl(0 70% 50% / 0.4))" : "none" }} />
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid mt-0.5" style={{ gridTemplateColumns: `repeat(11, 1fr)` }}>
                    {GAUGE_KEYS.map((key, i) => {
                      const isSpokenWeak = crewSim?.isSpokenPriority && key === "spoken";
                      return (
                        <div key={key} className="text-center" style={{ gridColumn: `${i * 2 + 1} / ${i * 2 + 2}` }}>
                          <div className={`text-[9px] ${isSpokenWeak ? "text-destructive/70" : "text-muted-foreground"}`}>
                            {GAUGE_LABELS[key]}
                          </div>
                          <div className={`text-sm font-bold ${isSpokenWeak ? "text-destructive" : "text-foreground"}`}>{crewMeans[key]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {crewSim && (
                  <div className="rounded-md p-2.5 border border-border/30 bg-muted/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-foreground">Improvement Simulation</span>
                    </div>
                    {crewSim.isSpokenPriority ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Primary Focus: <span className="font-medium text-foreground">Spoken</span>
                          {" · "}Current: {crewSim.spokenActualPct}% of target
                        </p>
                        <p className="text-[10px] text-muted-foreground">If Spoken improved to target ({TARGET_GAUGES.spoken}):</p>
                      </>
                    ) : crewSim.weakestDev && (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Primary Focus: <span className="font-medium text-foreground">{GAUGE_LABELS[crewSim.weakestDev.from]} → {GAUGE_LABELS[crewSim.weakestDev.to]}</span>
                          {" · "}Target: {crewSim.weakestDev.targetPct}% · Current: {crewSim.weakestDev.pct}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">If improved to target:</p>
                      </>
                    )}
                    <div className="flex items-center gap-1 flex-wrap text-xs">
                      {GAUGE_KEYS.map((key, i) => {
                        const changed = crewSim.adjusted[key] !== crewMeans[key];
                        return (
                          <span key={key} className="inline-flex items-center gap-0.5">
                            <span className="text-muted-foreground">{GAUGE_LABELS[key]}</span>
                            <span className={`font-semibold ${changed ? "text-primary" : "text-foreground"}`}>{crewSim.adjusted[key]}</span>
                            {i < GAUGE_KEYS.length - 1 && <span className="text-border mx-1">|</span>}
                          </span>
                        );
                      })}
                    </div>
                    {(() => {
                      const crewDaysLogged = crewSalesEntries.length;
                      const currentWeeklySales = crewMeans.sales * crewDaysLogged;
                      const projectedWeeklySales = crewSim.adjusted.sales * crewDaysLogged;
                      const delta = projectedWeeklySales - currentWeeklySales;
                      const deltaPerWeek = crewDaysLogged > 0 ? delta / crewDaysLogged * 7 : 0;
                      if (deltaPerWeek < 0.5) {
                        return <p className="text-[10px] text-muted-foreground/70 mt-1">Impact minimal. Focus on activity volume.</p>;
                      } else if (deltaPerWeek > 1) {
                        return <p className="text-[10px] text-primary/80 mt-1 font-medium">High leverage improvement. Estimated +{deltaPerWeek.toFixed(1)} sales/week.</p>;
                      } else {
                        return <p className="text-[10px] text-muted-foreground mt-1">Estimated improvement: +{deltaPerWeek.toFixed(1)} sales/week.</p>;
                      }
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Crew Commission Summary */}
            {crewFinancials && crewFinancials.crewTotalWire > 0 && (
              <div className="border-t border-border/30 pt-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Crew Commission</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[hsl(0_70%_50%/0.1)] rounded-md p-2 text-center">
                    <div className="text-[9px] uppercase text-muted-foreground">Crew Total Wire</div>
                    <div className="text-sm font-bold" style={{ color: "hsl(0 70% 50%)" }}>£{crewFinancials.crewTotalWire.toFixed(2)}</div>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2 text-center">
                    <div className="text-[9px] uppercase text-muted-foreground">Avg Wire / Seller</div>
                    <div className="text-sm font-bold text-foreground">£{crewFinancials.crewAvgWire.toFixed(2)}</div>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2 text-center">
                    <div className="text-[9px] uppercase text-muted-foreground">Headcount Selling</div>
                    <div className="text-sm font-bold text-foreground">{crewFinancials.headcountSelling}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bell Streak — under Sales section */}
        <BellStreakCard />

        {(isLeader || isManager) && crewSummary ? (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Crew Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                {[
                  { label: "Head Count", value: crewSummary.headCount },
                  { label: "Head Count Selling", value: crewSummary.hcs },
                  { label: "Potential New Starts", value: crewSummary.potentialNewStarts },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-2xl font-bold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
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
        ) : !isManager && (
          <Card className="border-border/50 bg-card/80 relative overflow-hidden">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground font-medium">Unlocked when promoted to Leader</p>
            </div>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-40">
                <Users className="w-4 h-4" />
                Crew Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="opacity-30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                {["Head Count", "Head Count Selling", "Potential New Starts"].map((label) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["Brand Ambassadors", "Leaders", "Team Starts", "Team Promotions"].map((label) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION: Crew Bubble with Role Labels & Weekly Sales */}
        {!isManager && (isLeader ? (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" />
                Crew Bubble
                {crewTreeNodeCount > 1 && (
                  <span className="text-xs font-normal text-muted-foreground">{crewTreeNodeCount} members</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CrewTree
                tree={crewTree}
                showSales
                salesMap={crewSalesMap}
                profileUserMap={profileUserMap}
                candidateStageMap={candidateStageMap}
              />
              {crewTreeNodeCount > 1 && (
                <div className="flex items-center gap-6 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-4 rounded border-[1.5px] border-primary bg-primary/10" />
                    <span>Leader</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-4 rounded border border-border/50 bg-muted/15" />
                    <span>Brand Ambassador</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/80 relative overflow-hidden">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground font-medium">Unlocked when promoted to Leader</p>
            </div>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-40">
                <GitBranch className="w-4 h-4" />
                Crew Bubble
              </CardTitle>
            </CardHeader>
            <CardContent className="opacity-30">
              <div className="h-24" />
            </CardContent>
          </Card>
        ))}

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