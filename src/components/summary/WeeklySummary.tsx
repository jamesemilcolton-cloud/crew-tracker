import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { Candidate, STAGES_ORDER, STAGE_CONFIG, PipelineStage } from "@/lib/types";
import { useCandidates } from "@/hooks/useCandidates";
import { useLinkedIn } from "@/hooks/useLinkedIn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trophy, Users, GitBranch, Flame, TrendingUp, Target } from "lucide-react";
import {
  CrewBubbleSnapshot,
  getDescendantProfileIds,
  buildRecursiveTree,
  CrewNode,
} from "@/components/crew/CrewBubbleForecast";
import { startOfWeek, endOfWeek, parseISO, format } from "date-fns";


interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
  crew_name: string;
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

const TREE_NODE_W = 160;
const TREE_NODE_H = 44;
const TREE_NODE_GAP = 14;

function SummaryTreeNode({
  node, salesMap, profileUserMap, candidateStageMap,
}: {
  node: CrewNode;
  salesMap: Map<string, number>;
  profileUserMap: Map<string, string>;
  candidateStageMap: Map<string, string>;
}) {
  const hasChildren = node.children.length > 0;
  const userId = profileUserMap.get(node.id);
  const weeklySales = userId ? salesMap.get(userId) ?? 0 : 0;

  let roleLabel = "";
  if (node.isLeader) {
    roleLabel = "Leader";
  } else {
    const stage = candidateStageMap.get(node.id);
    if (stage) roleLabel = getRoleLabel(stage);
  }

  return (
    <div className="flex flex-col items-center" style={{ minWidth: TREE_NODE_W }}>
      <div
        className="relative flex flex-col items-center justify-center select-none"
        style={{
          width: TREE_NODE_W, minHeight: TREE_NODE_H,
          borderRadius: node.isLeader ? 16 : 8,
          border: node.isLeader ? "1.5px solid hsl(var(--primary))" : "1px solid hsl(var(--border) / 0.5)",
          background: node.isLeader ? "hsl(var(--primary) / 0.08)" : "hsl(var(--muted) / 0.15)",
        }}
      >
        <span className="truncate px-2" style={{ fontSize: 12, fontWeight: node.isLeader ? 600 : 400, color: "hsl(var(--foreground))", maxWidth: TREE_NODE_W - 8 }}>
          {node.name}
        </span>
        <span className="text-[9px] px-2 truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
          {roleLabel ? `${roleLabel} — ${weeklySales} Sale${weeklySales !== 1 ? "s" : ""}` : `${weeklySales} Sale${weeklySales !== 1 ? "s" : ""}`}
        </span>
      </div>
      {hasChildren && (
        <div className="flex flex-col items-center">
          <div style={{ width: 1.5, height: 18, background: "hsl(var(--border))" }} />
          {node.children.length > 1 && (
            <div style={{ height: 1.5, background: "hsl(var(--border))", width: `${(Math.min(node.children.length, 8) - 1) * (TREE_NODE_W + TREE_NODE_GAP)}px`, maxWidth: "90vw" }} />
          )}
          <div className="flex flex-wrap items-start justify-center" style={{ gap: TREE_NODE_GAP, maxWidth: "90vw" }}>
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div style={{ width: 1.5, height: 14, background: "hsl(var(--border))" }} />
                <SummaryTreeNode node={child} salesMap={salesMap} profileUserMap={profileUserMap} candidateStageMap={candidateStageMap} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

  const { profiles: sharedProfiles, loading: profilesLoading } = useProfiles();
  const allProfiles = sharedProfiles as Profile[];

  const isLeader = (userRole?.role === "leader") || (userRole?.role === "manager" && !!userRole?.super_admin);

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

  // Profiles now provided by ProfilesContext - no duplicate fetch needed

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
      let historyRows: any[] = [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from("candidate_stage_history")
          .select("*")
          .in("candidate_id", ids)
          .order("changed_at", { ascending: true });
        historyRows = data ?? [];
      }
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

    // Recursive descendant resolution (excluding leader themselves)
    const descendantIds = getDescendantProfileIds(profile.id, allProfiles);
    descendantIds.delete(profile.id); // exclude the leader
    const headCount = descendantIds.size;

    // Subtree candidates (all generations)
    const subtreeCandidates = allCandidates.filter((c) => c.recruitedBy && descendantIds.has(c.recruitedBy));
    // Also include direct recruits of the leader
    const allSubtreeCandidates = allCandidates.filter(
      (c) => c.recruitedBy === profile.id || (c.recruitedBy && descendantIds.has(c.recruitedBy))
    );

    const activeTeam = allSubtreeCandidates.filter((c) => ["start", "solo", "promoted"].includes(c.stage));
    const brandAmbassadors = activeTeam.filter((c) => c.stage === "start" || c.stage === "solo").length;
    const leaders = activeTeam.filter((c) => c.stage === "promoted").length;

    const startsThisWeek = countInRange(allSubtreeCandidates, "start", thisWeek.start, thisWeek.end);
    const promotionsThisWeek = countInRange(allSubtreeCandidates, "promoted", thisWeek.start, thisWeek.end);

    // HCS: unique crew members with ≥1 sale this week (from crewSalesEntries)
    const sellingUserIds = new Set<string>();
    crewSalesEntries.forEach((entry: any) => {
      if ((entry.sales || 0) >= 1) sellingUserIds.add(entry.user_id);
    });
    // Only count crew members (not the leader themselves)
    const descendantUserIds = new Set(
      allProfiles.filter((p) => descendantIds.has(p.id)).map((p) => p.user_id)
    );
    const hcs = [...sellingUserIds].filter((uid) => descendantUserIds.has(uid)).length;

    // Potential New Starts: candidates in "offered" stage within recursive subtree
    const potentialNewStarts = allSubtreeCandidates.filter((c) => c.stage === "offered" && !c.archivedAt).length;

    return { headCount, brandAmbassadors, leaders, startsThisWeek, promotionsThisWeek, hcs, potentialNewStarts };
  }, [isLeader, profile, allCandidates, allProfiles, thisWeek, crewSalesEntries]);

  // Crew tree data for Week Summary crew structure
  const [treeCandidates, setTreeCandidates] = useState<any[]>([]);
  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("candidates")
        .select("id, name, stage, recruited_by, archived_at, phone, notes, source, status, potential_start_date, has_sales_pitch_access, has_evo_app_access")
        .is("archived_at", null);
      if (data) setTreeCandidates(data);
    }
    fetch();
  }, []);

  const treeCandidatesForBuild = useMemo(() => treeCandidates.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, notes: c.notes,
    source: c.source as "LinkedIn" | "Office", stage: c.stage as any,
    status: c.status as any, potentialStartDate: c.potential_start_date ?? undefined,
    hasSalesPitchAccess: c.has_sales_pitch_access, hasEvoAppAccess: c.has_evo_app_access,
    history: [], createdAt: "", recruitedBy: c.recruited_by ?? undefined, archivedAt: c.archived_at,
  })), [treeCandidates]);

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
    treeCandidates.forEach((c: any) => m.set(c.id, c.stage));
    return m;
  }, [treeCandidates]);

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

  const loading = candidatesLoading || linkedInLoading || allCandidatesLoading || profilesLoading;

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
              {/* Top row: Head Count, HCS, Potential New Starts */}
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
              {/* Bottom row: existing breakdown */}
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
        )}

        {/* SECTION: Crew Bubble with Role Labels & Weekly Sales */}
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
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)", minHeight: 200 }}>
              <div className="p-4 flex justify-center">
                <SummaryTreeNode
                  node={crewTree}
                  salesMap={crewSalesMap}
                  profileUserMap={profileUserMap}
                  candidateStageMap={candidateStageMap}
                />
              </div>
            </div>
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