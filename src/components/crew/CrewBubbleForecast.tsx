import { useState, useMemo, useEffect } from "react";
import { CrewTree } from "./CrewTree";
import { Target, AlertTriangle, PoundSterling } from "lucide-react";
import { Candidate, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { GitBranch, Shield, BarChart3, TrendingDown, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { SalesTransaction } from "@/hooks/useSalesTransactions";

/** Hook to fetch manager/super_admin user_ids so they can be excluded from crew trees */
function useManagerUserIds() {
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
  return managerUserIds;
}

/** Hook to fetch ALL sales transactions for crew wire calculations */
function useCrewSalesTransactions(crewUserIds: string[]) {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  useEffect(() => {
    if (crewUserIds.length === 0) { setTransactions([]); return; }
    // Fetch last 4 weeks of transactions for all crew members
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const dateStr = fourWeeksAgo.toISOString().split("T")[0];
    supabase
      .from("sales_transactions")
      .select("id, user_id, date, week_start, age_band, ask_amount, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
      .in("user_id", crewUserIds)
      .gte("date", dateStr)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setTransactions((data ?? []) as SalesTransaction[]);
      });
  }, [crewUserIds.join(",")]);
  return transactions;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
  crew_name: string;
}

export function getDescendantProfileIds(
  rootProfileId: string,
  allProfiles: Profile[],
  visited: Set<string> = new Set()
): Set<string> {
  if (visited.has(rootProfileId)) return visited;
  visited.add(rootProfileId);
  const children = allProfiles.filter((p) => p.leader_id === rootProfileId);
  children.forEach((child) => getDescendantProfileIds(child.id, allProfiles, visited));
  return visited;
}

function getSubtreeCandidates(
  rootProfileId: string,
  allProfiles: Profile[],
  allCandidates: Candidate[]
): Candidate[] {
  const subtreeIds = getDescendantProfileIds(rootProfileId, allProfiles);
  return allCandidates.filter((c) => c.recruitedBy && subtreeIds.has(c.recruitedBy));
}

export interface CrewNode {
  id: string;
  name: string;
  isLeader: boolean;
  isPredicted: boolean;
  children: CrewNode[];
  weeklySales?: number;
}

interface CrewBubbleForecastProps {
  candidates: Candidate[];
}

type ForecastConfidence = "High" | "Medium" | "Low";

interface RetentionMetrics {
  starterRetentionPct: number;
  leaderRetentionPct: number;
  starterTotal4w: number;
  starterActive4w: number;
  leaderTotal4w: number;
  leaderActive4w: number;
}

interface WeightedForecast {
  weeklyInterviews: number;
  weeklyStarts: number;
  weeklyPromotions: number;
  interviewToStartPct: number;
  startToPromotionPct: number;
  avgPromotionDays: number;
  expected2ndRounds: number;
  expectedStarts: number;
  expectedPromotions: number;
  adjustedStarts: number;
  adjustedPromotions: number;
  retention: RetentionMetrics;
  confidence: ForecastConfidence;
}

// Helper: check if candidate reached a stage historically
function reachedStage(c: Candidate, stage: PipelineStage): boolean {
  if (c.stage === stage) return true;
  const stageIdx = STAGES_ORDER.indexOf(stage);
  const currentIdx = STAGES_ORDER.indexOf(c.stage);
  if (currentIdx >= stageIdx) return true;
  return c.history.some((h) => h.to === stage || STAGES_ORDER.indexOf(h.to) >= stageIdx);
}

// Helper: get date when candidate entered a stage
function stageEntryDate(c: Candidate, stage: PipelineStage): string | null {
  if (stage === "obs" && c.history.length === 0 && STAGES_ORDER.indexOf(c.stage) >= 0) {
    return c.createdAt;
  }
  const entry = c.history.find((h) => h.to === stage);
  return entry?.date ?? null;
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeWeightedForecast(candidates: Candidate[]): WeightedForecast {
  const now = new Date();
  const currentMonday = getWeekMonday(now);
  const weeks: { start: Date; end: Date }[] = [];
  for (let i = 1; i <= 4; i++) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({ start, end });
  }
  const weights = [1.5, 1.5, 0.5, 0.5];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weeklyInterviews: number[] = [0, 0, 0, 0];
  const weeklyStarts: number[] = [0, 0, 0, 0];
  const weeklyPromotions: number[] = [0, 0, 0, 0];

  candidates.forEach((c) => {
    const entryDate2nd = stageEntryDate(c, "obs");
    if (entryDate2nd) {
      const d = new Date(entryDate2nd);
      weeks.forEach((w, i) => { if (d >= w.start && d < w.end) weeklyInterviews[i]++; });
    }
    const entryDateStart = stageEntryDate(c, "start");
    if (entryDateStart) {
      const d = new Date(entryDateStart);
      weeks.forEach((w, i) => { if (d >= w.start && d < w.end) weeklyStarts[i]++; });
    }
    const entryDatePromo = stageEntryDate(c, "promoted");
    if (entryDatePromo) {
      const d = new Date(entryDatePromo);
      weeks.forEach((w, i) => { if (d >= w.start && d < w.end) weeklyPromotions[i]++; });
    }
  });

  const wAvgInterviews = weights.reduce((sum, w, i) => sum + w * weeklyInterviews[i], 0) / totalWeight;
  const wAvgStarts = weights.reduce((sum, w, i) => sum + w * weeklyStarts[i], 0) / totalWeight;
  const wAvgPromotions = weights.reduce((sum, w, i) => sum + w * weeklyPromotions[i], 0) / totalWeight;

  // Use LIFETIME blended conversion rates (all sources)
  const totalLifetimeOBS = candidates.filter((c) => reachedStage(c, "obs")).length;
  const totalLifetimeStarts = candidates.filter((c) => reachedStage(c, "start")).length;
  const totalLifetimePromotions = candidates.filter((c) => reachedStage(c, "promoted")).length;

  const interviewToStartPct = totalLifetimeOBS > 0 ? totalLifetimeStarts / totalLifetimeOBS : 0;
  const startToPromotionPct = totalLifetimeStarts > 0 ? totalLifetimePromotions / totalLifetimeStarts : 0;

  const promotedCandidates = candidates.filter((c) => c.stage === "promoted");
  let avgPromotionDays = 60;
  if (promotedCandidates.length > 0) {
    const durations = promotedCandidates.map((c) => {
      const startDate = stageEntryDate(c, "start");
      const promoDate = stageEntryDate(c, "promoted");
      if (startDate && promoDate) {
        return (new Date(promoDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
      }
      return null;
    }).filter((d): d is number => d !== null);
    if (durations.length > 0) {
      avgPromotionDays = durations.reduce((a, b) => a + b, 0) / durations.length;
    }
  }

  // --- Retention Calculation (last 4 weeks) ---
  const fourWeeksAgo = new Date(currentMonday);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // Starters in last 4 weeks: candidates who reached "start" in that window
  const startersIn4w = candidates.filter((c) => {
    const d = stageEntryDate(c, "start");
    if (!d) return false;
    const dt = new Date(d);
    return dt >= fourWeeksAgo && dt < now;
  });
  const starterTotal4w = startersIn4w.length;
  const starterActive4w = startersIn4w.filter((c) => c.status !== "Dropped" && c.status !== "dropped").length;
  const starterRetentionPct = starterTotal4w > 0 ? starterActive4w / starterTotal4w : 1;

  // Leaders in last 4 weeks: candidates who reached "promoted" in that window
  const leadersIn4w = candidates.filter((c) => {
    const d = stageEntryDate(c, "promoted");
    if (!d) return false;
    const dt = new Date(d);
    return dt >= fourWeeksAgo && dt < now;
  });
  const leaderTotal4w = leadersIn4w.length;
  const leaderActive4w = leadersIn4w.filter((c) => c.status !== "Dropped" && c.status !== "dropped").length;
  const leaderRetentionPct = leaderTotal4w > 0 ? leaderActive4w / leaderTotal4w : 1;

  const retention: RetentionMetrics = {
    starterRetentionPct: Math.round(starterRetentionPct * 100),
    leaderRetentionPct: Math.round(leaderRetentionPct * 100),
    starterTotal4w, starterActive4w, leaderTotal4w, leaderActive4w,
  };

  let expected2ndRounds = wAvgInterviews * 8;
  let expectedStarts = expected2ndRounds * interviewToStartPct;
  let expectedPromotions = expectedStarts * startToPromotionPct;

  let confidence: ForecastConfidence = "High";
  const interviewVariance = computeVariance(weeklyInterviews);
  const startVariance = computeVariance(weeklyStarts);

  if (totalLifetimeOBS < 10 || totalLifetimeStarts < 5 || totalLifetimePromotions < 3) {
    confidence = "Low";
    expected2ndRounds *= 0.7;
    expectedStarts *= 0.7;
    expectedPromotions *= 0.7;
  } else if (interviewVariance > 2 || startVariance > 1.5) {
    confidence = "Medium";
    expected2ndRounds *= 0.85;
    expectedStarts *= 0.85;
    expectedPromotions *= 0.85;
  }

  const adjustedStarts = Math.round(expectedStarts * starterRetentionPct * 10) / 10;
  const adjustedPromotions = Math.round(expectedPromotions * leaderRetentionPct * 10) / 10;

  return {
    weeklyInterviews: wAvgInterviews, weeklyStarts: wAvgStarts, weeklyPromotions: wAvgPromotions,
    interviewToStartPct, startToPromotionPct, avgPromotionDays,
    expected2ndRounds: Math.round(expected2ndRounds * 10) / 10,
    expectedStarts: Math.round(expectedStarts * 10) / 10,
    expectedPromotions: Math.round(expectedPromotions * 10) / 10,
    adjustedStarts, adjustedPromotions, retention,
    confidence,
  };
}

function computeVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function buildRecursiveTree(
  profileId: string,
  profileName: string,
  allProfiles: Profile[],
  allCandidates: Candidate[],
  visited: Set<string> = new Set()
): CrewNode {
  if (visited.has(profileId)) {
    return { id: profileId, name: profileName, isLeader: true, isPredicted: false, children: [] };
  }
  visited.add(profileId);

  const subLeaderProfiles = allProfiles.filter((p) => p.leader_id === profileId);
  const directCrew = allCandidates.filter(
    (c) => c.recruitedBy === profileId && (c.stage === "start" || c.stage === "solo")
  );
  const promotedCrew = allCandidates.filter(
    (c) => c.recruitedBy === profileId && c.stage === "promoted" && !allProfiles.some((p) => p.full_name === c.name && p.leader_id === profileId)
  );

  const children: CrewNode[] = [];

  subLeaderProfiles.forEach((subProfile) => {
    children.push(buildRecursiveTree(subProfile.id, subProfile.full_name, allProfiles, allCandidates, visited));
  });

  promotedCrew.forEach((c) => {
    const promotedChildren: CrewNode[] = [];
    const promotedDirectCrew = allCandidates.filter(
      (cc) => cc.recruitedBy === c.id && (cc.stage === "start" || cc.stage === "solo")
    );
    promotedDirectCrew.forEach((cc) => {
      promotedChildren.push({ id: cc.id, name: cc.name, isLeader: false, isPredicted: false, children: [] });
    });
    children.push({ id: c.id, name: c.name, isLeader: true, isPredicted: false, children: promotedChildren });
  });

  directCrew.forEach((c) => {
    children.push({ id: c.id, name: c.name, isLeader: false, isPredicted: false, children: [] });
  });

  return { id: profileId, name: profileName, isLeader: true, isPredicted: false, children };
}

function buildPredictedRecursiveTree(
  profileId: string,
  profileName: string,
  allProfiles: Profile[],
  allCandidates: Candidate[],
  forecast: WeightedForecast,
  visited: Set<string> = new Set()
): CrewNode {
  if (visited.has(profileId)) {
    return { id: profileId, name: profileName, isLeader: true, isPredicted: false, children: [] };
  }
  visited.add(profileId);

  const now = new Date();
  const subLeaderProfiles = allProfiles.filter((p) => p.leader_id === profileId);
  const recruitedCandidates = allCandidates.filter((c) => c.recruitedBy === profileId);
  const directCrew = recruitedCandidates.filter((c) => c.stage === "start" || c.stage === "solo");
  const promotedCrew = recruitedCandidates.filter(
    (c) => c.stage === "promoted" && !allProfiles.some((p) => p.full_name === c.name && p.leader_id === profileId)
  );

  const promotionThreshold = forecast.avgPromotionDays * 0.7;
  const predictedPromotionIds = new Set<string>();

  directCrew.forEach((c) => {
    const startDate = stageEntryDate(c, "start");
    if (startDate) {
      const daysSinceStart = (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceStart >= promotionThreshold) {
        const daysRemaining = forecast.avgPromotionDays - daysSinceStart;
        if (daysRemaining <= 56 && daysRemaining > 0 && forecast.startToPromotionPct > 0.1) {
          predictedPromotionIds.add(c.id);
        }
      }
    }
  });

  const preStartStages: PipelineStage[] = ["obs", "questionnaire", "final", "job_offered", "rehash", "contact_before_start", "attended_induction"];
  const inPipeline = recruitedCandidates.filter((c) => preStartStages.includes(c.stage) && !c.status);
  const predictedStarts: CrewNode[] = [];
  inPipeline.forEach((c) => {
    const stageIdx = STAGES_ORDER.indexOf(c.stage);
    const stepsToStart = STAGES_ORDER.indexOf("start") - stageIdx;
    const daysToStart = stepsToStart * 7;
    if (daysToStart <= 56 && forecast.interviewToStartPct > 0.15) {
      predictedStarts.push({ id: `pred-start-${c.id}`, name: `${c.name} (Predicted)`, isLeader: false, isPredicted: true, children: [] });
    }
  });

  const predictedNewCount = Math.round(forecast.weeklyInterviews * 8 * forecast.interviewToStartPct);
  const smoothedNewCount = forecast.confidence === "Low" ? Math.max(0, Math.floor(predictedNewCount * 0.5))
    : forecast.confidence === "Medium" ? Math.max(0, Math.floor(predictedNewCount * 0.75)) : predictedNewCount;

  const predictedNewRecruits: CrewNode[] = [];
  if (inPipeline.length > 0 || directCrew.length > 0) {
    const countForThisNode = Math.min(smoothedNewCount, 3);
    for (let i = 0; i < countForThisNode; i++) {
      predictedNewRecruits.push({ id: `pred-new-${profileId}-${i}`, name: `New Recruit ${i + 1}`, isLeader: false, isPredicted: true, children: [] });
    }
  }

  const children: CrewNode[] = [];

  subLeaderProfiles.forEach((subProfile) => {
    children.push(buildPredictedRecursiveTree(subProfile.id, subProfile.full_name, allProfiles, allCandidates, forecast, visited));
  });

  promotedCrew.forEach((c) => {
    children.push({ id: c.id, name: c.name, isLeader: true, isPredicted: false, children: [] });
  });

  directCrew.forEach((c) => {
    if (predictedPromotionIds.has(c.id)) {
      children.push({ id: c.id, name: c.name, isLeader: true, isPredicted: true, children: [] });
    } else {
      children.push({ id: c.id, name: c.name, isLeader: false, isPredicted: false, children: [] });
    }
  });

  children.push(...predictedStarts);
  children.push(...predictedNewRecruits);

  return { id: profileId, name: profileName, isLeader: true, isPredicted: false, children };
}

function countNodes(node: CrewNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

// --- Management Criteria (FIXED) ---
// First-gen leaders = direct children of root that are leaders
// Second-gen leaders = children of first-gen leaders that are leaders
interface ManagementCounts {
  firstGenLeaders: number;
  secondGenLeaders: number;
  achieved: boolean;
}

function countManagementCriteria(tree: CrewNode): ManagementCounts {
  const firstGenLeaders = tree.children.filter((c) => c.isLeader && !c.isPredicted);
  const firstGenCount = firstGenLeaders.length;
  let secondGenCount = 0;
  for (const fg of firstGenLeaders) {
    secondGenCount += fg.children.filter((c) => c.isLeader && !c.isPredicted).length;
  }
  return {
    firstGenLeaders: firstGenCount,
    secondGenLeaders: secondGenCount,
    achieved: firstGenCount >= 4 && secondGenCount >= 1,
  };
}

interface ManagementResult {
  status: "achieved" | "predicted" | "beyond";
  weeksToManagement: number | null;
  confidence: ForecastConfidence;
  currentFirstGen: number;
  currentSecondGen: number;
  firstGenNeeded: number;
  secondGenNeeded: number;
  structuralAchieved: boolean;
}

// --- Financial Qualification ---
interface FinancialMetrics {
  weeklyCrewWire: { weekStart: string; total: number }[];
  avgWeeklyCrewWire: number;
  avgWirePerActiveSeller: number;
  activeSellersCount: number;
  requiredActiveSellers: number;
  additionalSellersRequired: number;
  consecutiveWeeksAbove7500: number;
  revenueStatus: "achieved" | "needs_one_more" | "not_proven";
  projectedWeeklyWire: number;
  revenueShortfall: number;
  revenueLikelyAchievable: boolean;
}

function computeFinancialMetrics(
  crewTransactions: SalesTransaction[],
  forecast: WeightedForecast
): FinancialMetrics {
  // Group transactions by week_start
  const weekMap = new Map<string, number>();
  crewTransactions.forEach((t) => {
    const ws = t.week_start;
    weekMap.set(ws, (weekMap.get(ws) ?? 0) + Number(t.total_wire));
  });

  // Get last 4 week mondays
  const now = new Date();
  const currentMonday = getWeekMonday(now);
  const last4Weeks: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() - i * 7);
    last4Weeks.push(d.toISOString().split("T")[0]);
  }

  const weeklyCrewWire = last4Weeks.map((ws) => ({
    weekStart: ws,
    total: Math.round((weekMap.get(ws) ?? 0) * 100) / 100,
  }));

  const weeksWithData = weeklyCrewWire.filter((w) => w.total > 0).length;
  const avgWeeklyCrewWire = weeksWithData > 0
    ? Math.round(weeklyCrewWire.reduce((s, w) => s + w.total, 0) / Math.max(1, weeksWithData) * 100) / 100
    : 0;

  // Active sellers per week: users with ≥1 sale in each week
  const weekSellerMap = new Map<string, Set<string>>();
  crewTransactions.forEach((t) => {
    if (!weekSellerMap.has(t.week_start)) weekSellerMap.set(t.week_start, new Set());
    weekSellerMap.get(t.week_start)!.add(t.user_id);
  });
  const activeSellersPerWeek = last4Weeks.map((ws) => weekSellerMap.get(ws)?.size ?? 0);
  const weeksWithSellers = activeSellersPerWeek.filter((c) => c > 0).length;
  const avgActiveSellers = weeksWithSellers > 0
    ? activeSellersPerWeek.reduce((a, b) => a + b, 0) / weeksWithSellers
    : 0;

  const avgWirePerActiveSeller = avgActiveSellers > 0
    ? Math.round((avgWeeklyCrewWire / avgActiveSellers) * 100) / 100
    : 0;

  const activeSellersCount = Math.round(avgActiveSellers * 10) / 10;

  const requiredActiveSellers = avgWirePerActiveSeller > 0
    ? Math.ceil(7500 / avgWirePerActiveSeller)
    : 0;

  const additionalSellersRequired = Math.max(0, requiredActiveSellers - Math.round(avgActiveSellers));

  // 2-week consecutive check (most recent first)
  const sortedWeeks = [...weeklyCrewWire].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  let consecutiveWeeksAbove7500 = 0;
  for (const w of sortedWeeks) {
    if (w.total >= 7500) consecutiveWeeksAbove7500++;
    else break;
  }

  let revenueStatus: "achieved" | "needs_one_more" | "not_proven" = "not_proven";
  if (consecutiveWeeksAbove7500 >= 2) revenueStatus = "achieved";
  else if (weeklyCrewWire.filter((w) => w.total >= 7500).length >= 1) revenueStatus = "needs_one_more";

  // Projected weekly wire using retention-adjusted sellers
  const projectedSellers = Math.round(avgActiveSellers) + Math.round(forecast.adjustedStarts);
  const projectedWeeklyWire = Math.round(avgWirePerActiveSeller * projectedSellers * 100) / 100;
  const revenueShortfall = Math.max(0, Math.round((7500 - projectedWeeklyWire) * 100) / 100);
  const revenueLikelyAchievable = projectedWeeklyWire >= 7500;

  return {
    weeklyCrewWire,
    avgWeeklyCrewWire,
    avgWirePerActiveSeller,
    activeSellersCount,
    requiredActiveSellers,
    additionalSellersRequired,
    consecutiveWeeksAbove7500,
    revenueStatus,
    projectedWeeklyWire,
    revenueShortfall,
    revenueLikelyAchievable,
  };
}

interface SimBA { weekStarted: number; recruitedByLeaderId: string; }
interface SimLeader { id: string; parentId: string | null; isFirstGen: boolean; }

function simulateManagementTimeline(currentTree: CrewNode, forecast: WeightedForecast, candidates: Candidate[]): ManagementResult {
  const mc = countManagementCriteria(currentTree);
  const base = {
    currentFirstGen: mc.firstGenLeaders,
    currentSecondGen: mc.secondGenLeaders,
    firstGenNeeded: Math.max(0, 4 - mc.firstGenLeaders),
    secondGenNeeded: Math.max(0, 1 - mc.secondGenLeaders),
  };

  if (mc.achieved) {
    return { status: "achieved", weeksToManagement: null, confidence: forecast.confidence, structuralAchieved: true, ...base };
  }

  const startedCandidates = candidates.filter((c) => (c.stage === "start" || c.stage === "solo") && !c.status);
  const now = new Date();

  const baWeekMap: Map<string, number> = new Map();
  startedCandidates.forEach((c) => {
    const startDate = stageEntryDate(c, "start");
    if (startDate) {
      const weeksInRole = (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 7);
      baWeekMap.set(c.id, -Math.floor(weeksInRole));
    }
  });

  // Track first-gen and second-gen leaders separately
  let simFirstGen = mc.firstGenLeaders;
  let simSecondGen = mc.secondGenLeaders;
  
  const bas: SimBA[] = [];
  startedCandidates.forEach((c) => {
    const weekStarted = baWeekMap.get(c.id) ?? -99;
    bas.push({ weekStarted, recruitedByLeaderId: c.recruitedBy ?? currentTree.id });
  });

  const avgPromotionWeeks = Math.max(1, Math.round(forecast.avgPromotionDays / 7));
  const promotionThresholdWeeks = Math.floor(avgPromotionWeeks * 0.7);
  // Use retention-adjusted weekly starts for simulation
  const weeklyNewStarts = forecast.weeklyStarts * (forecast.retention.starterRetentionPct / 100);
  const promoRate = forecast.startToPromotionPct * (forecast.retention.leaderRetentionPct / 100);

  // Track which leaders are first-gen (recruited by root)
  const firstGenLeaderIds = new Set<string>();
  currentTree.children.filter((c) => c.isLeader && !c.isPredicted).forEach((c) => firstGenLeaderIds.add(c.id));

  for (let week = 1; week <= 12; week++) {
    const newStartCount = Math.round(weeklyNewStarts);
    for (let i = 0; i < newStartCount; i++) {
      bas.push({ weekStarted: week, recruitedByLeaderId: currentTree.id });
    }

    const toPromote: number[] = [];
    bas.forEach((ba, idx) => {
      const weeksInRole = week - ba.weekStarted;
      if (weeksInRole >= promotionThresholdWeeks && promoRate > 0) toPromote.push(idx);
    });

    const promoteCount = Math.min(toPromote.length, Math.max(0, Math.round(toPromote.length * promoRate)));
    const promoted = toPromote.slice(0, promoteCount);

    promoted.forEach((idx) => {
      const ba = bas[idx];
      if (ba.recruitedByLeaderId === currentTree.id) {
        simFirstGen++;
        firstGenLeaderIds.add(`sim-fg-${week}-${idx}`);
      } else if (firstGenLeaderIds.has(ba.recruitedByLeaderId)) {
        simSecondGen++;
      }
    });

    const sortedPromoted = [...new Set(promoted)].sort((a, b) => b - a);
    sortedPromoted.forEach((idx) => bas.splice(idx, 1));

    if (simFirstGen >= 4 && simSecondGen >= 1) {
      return {
        status: "predicted", weeksToManagement: week, confidence: forecast.confidence,
        currentFirstGen: mc.firstGenLeaders, currentSecondGen: mc.secondGenLeaders,
        firstGenNeeded: Math.max(0, 4 - mc.firstGenLeaders), secondGenNeeded: Math.max(0, 1 - mc.secondGenLeaders),
        structuralAchieved: simFirstGen >= 4 && simSecondGen >= 1,
      };
    }
  }

  return {
    status: "beyond", weeksToManagement: null, confidence: forecast.confidence,
    structuralAchieved: false,
    ...base,
  };
}

// --- Lifetime stats for breakdown ---
interface LifetimeBreakdown {
  totalOBS: number;
  totalStarts: number;
  totalPromotions: number;
  obsToStartPct: number;
  startToPromoPct: number;
  avgWeeksStartToPromo: number | null;
  avgWeeklyOBVolume: number;
  weeksOfData: number;
  // Per-source
  sources: { label: string; addedToOB: number; obToStart: number; startToPromo: number; added: number; reachedOB: number; reachedStart: number; reachedPromo: number }[];
  // Insufficiency
  insufficiency: string[];
  // Weakest source
  weakestSource: { name: string; improvementGain: number } | null;
}

function computeLifetimeBreakdown(candidates: Candidate[]): LifetimeBreakdown {
  const totalOBS = candidates.filter((c) => reachedStage(c, "obs")).length;
  const totalStarts = candidates.filter((c) => reachedStage(c, "start")).length;
  const totalPromotions = candidates.filter((c) => reachedStage(c, "promoted")).length;

  const obsToStartPct = totalOBS > 0 ? (totalStarts / totalOBS) * 100 : 0;
  const startToPromoPct = totalStarts > 0 ? (totalPromotions / totalStarts) * 100 : 0;

  // Avg weeks start → promotion
  const promotedCandidates = candidates.filter((c) => c.stage === "promoted");
  let avgWeeksStartToPromo: number | null = null;
  if (promotedCandidates.length > 0) {
    const durations = promotedCandidates.map((c) => {
      const startDate = stageEntryDate(c, "start");
      const promoDate = stageEntryDate(c, "promoted");
      if (startDate && promoDate) {
        return (new Date(promoDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 7);
      }
      return null;
    }).filter((d): d is number => d !== null);
    if (durations.length > 0) {
      avgWeeksStartToPromo = Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
    }
  }

  // Avg weekly OB volume (lifetime)
  let weeksOfData = 1;
  if (candidates.length > 0) {
    const earliest = candidates.reduce((min, c) => {
      const d = new Date(c.createdAt).getTime();
      return d < min ? d : min;
    }, Date.now());
    weeksOfData = Math.max(1, Math.round((Date.now() - earliest) / (1000 * 60 * 60 * 24 * 7)));
  }
  const avgWeeklyOBVolume = Math.round((totalOBS / weeksOfData) * 10) / 10;

  // Per-source breakdown
  const sourceLabels = ["Office", "LinkedIn", "Personal"] as const;
  const sources = sourceLabels.map((label) => {
    const src = candidates.filter((c) => c.source === label);
    const added = src.length;
    const reachedOB = src.filter((c) => reachedStage(c, "obs")).length;
    const reachedStart = src.filter((c) => reachedStage(c, "start")).length;
    const reachedPromo = src.filter((c) => reachedStage(c, "promoted")).length;
    return {
      label,
      added,
      reachedOB,
      reachedStart,
      reachedPromo,
      addedToOB: added > 0 ? Math.round((reachedOB / added) * 100) : 0,
      obToStart: reachedOB > 0 ? Math.round((reachedStart / reachedOB) * 100) : 0,
      startToPromo: reachedStart > 0 ? Math.round((reachedPromo / reachedStart) * 100) : 0,
    };
  });

  // Insufficiency warnings
  const insufficiency: string[] = [];
  if (totalPromotions < 5) insufficiency.push("Need at least 5 promotions to stabilise Start → Promotion %");
  if (totalOBS < 5) insufficiency.push("Need at least 5 OBs to stabilise OBS → Start %");

  // Weakest source (by OB → Start)
  const sourcesWithOB = sources.filter((s) => s.reachedOB > 0);
  let weakestSource: { name: string; improvementGain: number } | null = null;
  if (sourcesWithOB.length > 0) {
    const weakest = sourcesWithOB.reduce((prev, curr) => (curr.obToStart < prev.obToStart ? curr : prev));
    // Calculate: if we improve this source's OB→Start by 10%, how many additional promotions in 8 weeks?
    const currentStarts = weakest.reachedOB * (weakest.obToStart / 100);
    const improvedStarts = weakest.reachedOB * ((weakest.obToStart + 10) / 100);
    const additionalStarts = improvedStarts - currentStarts;
    const avgWeeklyAdditionalStarts = additionalStarts / Math.max(1, weeksOfData);
    const additionalPromos = avgWeeklyAdditionalStarts * 8 * (startToPromoPct / 100);
    weakestSource = { name: weakest.label, improvementGain: Math.round(additionalPromos * 10) / 10 };
  }

  return {
    totalOBS, totalStarts, totalPromotions, obsToStartPct, startToPromoPct,
    avgWeeksStartToPromo, avgWeeklyOBVolume, weeksOfData, sources, insufficiency, weakestSource,
  };
}

export function CrewBubbleSnapshot({ candidates }: { candidates: Candidate[] }) {
  const { profile, userRole } = useAuth();
  const { profiles: sharedProfiles } = useProfiles();
  const allProfilesRaw = sharedProfiles as Profile[];
  const managerUserIds = useManagerUserIds();

  const allProfiles = useMemo(
    () => allProfilesRaw.filter((p) => !managerUserIds.has(p.user_id)),
    [allProfilesRaw, managerUserIds]
  );

  const isManager = userRole?.role === "manager" && !!userRole?.super_admin;
  
  const subtreeCandidates = useMemo(() => {
    if (!profile || allProfiles.length === 0) return candidates;
    return getSubtreeCandidates(profile.id, allProfiles, candidates);
  }, [candidates, allProfiles, profile]);

  const tree = useMemo(() => {
    if (!profile || allProfiles.length === 0) {
      return { id: "root", name: "You", isLeader: true, isPredicted: false, children: [] } as CrewNode;
    }
    return buildRecursiveTree(profile.id, profile.full_name, allProfiles, subtreeCandidates);
  }, [subtreeCandidates, allProfiles, profile]);

  const totalNodes = countNodes(tree);

  if (isManager || totalNodes <= 1) return null;

  return <CrewTree tree={tree} />;
}

const CONFIDENCE_STYLES: Record<ForecastConfidence, { color: string; bg: string }> = {
  High: { color: "text-green-400", bg: "bg-green-400/10" },
  Medium: { color: "text-yellow-400", bg: "bg-yellow-400/10" },
  Low: { color: "text-red-400", bg: "bg-red-400/10" },
};

export function CrewBubbleForecast({ candidates }: CrewBubbleForecastProps) {
  const [showPredicted, setShowPredicted] = useState(false);
  const { profile, userRole } = useAuth();
  const { profiles: sharedProfiles } = useProfiles();
  const allProfilesRaw = sharedProfiles as Profile[];
  const managerUserIds = useManagerUserIds();

  const allProfiles = useMemo(
    () => allProfilesRaw.filter((p) => !managerUserIds.has(p.user_id)),
    [allProfilesRaw, managerUserIds]
  );

  const isManager = userRole?.role === "manager" && !!userRole?.super_admin;

  // Get crew user IDs for sales transaction fetching
  const crewUserIds = useMemo(() => {
    if (!profile || allProfiles.length === 0) return [] as string[];
    const subtreeProfileIds = getDescendantProfileIds(profile.id, allProfiles);
    return allProfiles
      .filter((p) => subtreeProfileIds.has(p.id))
      .map((p) => p.user_id);
  }, [profile, allProfiles]);

  const crewTransactions = useCrewSalesTransactions(crewUserIds);

  const subtreeCandidates = useMemo(() => {
    if (!profile || allProfiles.length === 0) return candidates;
    return getSubtreeCandidates(profile.id, allProfiles, candidates);
  }, [candidates, allProfiles, profile]);

  const startToPromotionPct = useMemo(() => {
    const reachedStart = subtreeCandidates.filter((c) => reachedStage(c, "start")).length;
    const reachedPromoted = subtreeCandidates.filter((c) => reachedStage(c, "promoted")).length;
    if (reachedStart === 0) return 0;
    return Math.round((reachedPromoted / reachedStart) * 100);
  }, [subtreeCandidates]);

  const forecast = useMemo(() => computeWeightedForecast(subtreeCandidates), [subtreeCandidates]);
  const breakdown = useMemo(() => computeLifetimeBreakdown(subtreeCandidates), [subtreeCandidates]);

  const financialMetrics = useMemo(
    () => computeFinancialMetrics(crewTransactions, forecast),
    [crewTransactions, forecast]
  );

  const currentTree = useMemo(() => {
    if (!profile || allProfiles.length === 0) {
      return { id: "root", name: "You", isLeader: true, isPredicted: false, children: [] } as CrewNode;
    }
    return buildRecursiveTree(profile.id, profile.full_name, allProfiles, subtreeCandidates);
  }, [subtreeCandidates, allProfiles, profile]);

  const predictedTree = useMemo(() => {
    if (!profile || allProfiles.length === 0) {
      return { id: "root", name: "You", isLeader: true, isPredicted: false, children: [] } as CrewNode;
    }
    return buildPredictedRecursiveTree(profile.id, profile.full_name, allProfiles, subtreeCandidates, forecast);
  }, [subtreeCandidates, allProfiles, profile, forecast]);

  const isTopLeader = profile ? !profile.leader_id : false;

  const managementResult = useMemo<ManagementResult | null>(() => {
    if (!isTopLeader || !profile) return null;
    return simulateManagementTimeline(currentTree, forecast, subtreeCandidates);
  }, [isTopLeader, profile, currentTree, forecast, subtreeCandidates]);

  const tree = showPredicted ? predictedTree : currentTree;
  const totalNodes = countNodes(tree);

  const confStyle = CONFIDENCE_STYLES[forecast.confidence];

  // Behavioural diagnostics
  const showRetrainingWarning = breakdown.startToPromoPct < 25 && breakdown.totalStarts > 0;
  const showVolumeWarning = breakdown.avgWeeklyOBVolume < 5;
  const showStarterRetentionWarning = forecast.retention.starterRetentionPct < 60 && forecast.retention.starterTotal4w > 0;
  const showLeaderRetentionWarning = forecast.retention.leaderRetentionPct < 75 && forecast.retention.leaderTotal4w > 0;

  // Overall eligibility (only for top leader)
  const overallEligibility = useMemo(() => {
    if (!managementResult) return null;
    const structuralMet = managementResult.structuralAchieved;
    const revenueMet = financialMetrics.revenueStatus === "achieved";
    let label: string;
    if (structuralMet && revenueMet) label = "Management Achieved";
    else if (!structuralMet && !revenueMet) label = "Blocked by Structure & Revenue";
    else if (!structuralMet) label = "Blocked by Structure";
    else label = "Blocked by Revenue";
    return { structuralMet, revenueMet, label };
  }, [managementResult, financialMetrics]);

  if (isManager) return null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Crew Bubble Forecast</h3>
            </div>
            <div className="flex items-center bg-muted/30 rounded-lg p-0.5">
              <button
                onClick={() => setShowPredicted(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!showPredicted ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Current Team
              </button>
              <button
                onClick={() => setShowPredicted(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${showPredicted ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Predicted Team (8 weeks)
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">{totalNodes} members</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Start → Promotion:</span>
              <span className="text-foreground font-mono font-semibold">{startToPromotionPct}%</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${confStyle.bg}`}>
              <Shield className="w-3 h-3" />
              <span className={`font-medium ${confStyle.color}`}>
                Confidence: {forecast.confidence}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast summary when predicted */}
      {showPredicted && (
        <div className="glass-panel p-3">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">Expected 2nd Rounds</div>
              <div className="text-foreground font-mono font-semibold text-sm mt-0.5">{forecast.expected2ndRounds}</div>
              <div className="text-muted-foreground/60 text-[10px]">~{forecast.weeklyInterviews.toFixed(1)}/wk weighted avg</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Expected Starts</div>
              <div className="text-foreground font-mono font-semibold text-sm mt-0.5">{forecast.expectedStarts}</div>
              <div className="text-muted-foreground/60 text-[10px]">{(forecast.interviewToStartPct * 100).toFixed(0)}% conversion</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Expected Promotions</div>
              <div className="text-foreground font-mono font-semibold text-sm mt-0.5">{forecast.expectedPromotions}</div>
              <div className="text-muted-foreground/60 text-[10px]">{(forecast.startToPromotionPct * 100).toFixed(0)}% promotion rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Management Criteria — only for top leader */}
      {managementResult && (
        <div className="glass-panel p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-foreground">Management Criteria</span>
            </div>
            <div className="flex-1" />
            {managementResult.status === "achieved" ? (
              <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-md">
                ✓ Management Criteria Achieved
              </span>
            ) : managementResult.status === "predicted" ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Predicted Time to Management:</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {managementResult.weeksToManagement} week{managementResult.weeksToManagement !== 1 ? "s" : ""}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/70 bg-muted/20 px-2.5 py-1 rounded-md">Beyond 12-week forecast window</span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current First Gen Leaders</span>
              <span className="font-mono text-foreground">{managementResult.currentFirstGen}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Second Gen Leaders</span>
              <span className="font-mono text-foreground">{managementResult.currentSecondGen}</span>
            </div>
            {managementResult.firstGenNeeded > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">First Gen Still Needed</span>
                <span className="font-mono text-destructive">{managementResult.firstGenNeeded}</span>
              </div>
            )}
            {managementResult.secondGenNeeded > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Second Gen Still Needed</span>
                <span className="font-mono text-destructive">{managementResult.secondGenNeeded}</span>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground/60">
            Requires ≥4 first-gen leaders + ≥1 second-gen leader + £7,500 crew wire for 2 consecutive weeks
          </div>

          {/* Overall Eligibility Status */}
          {overallEligibility && (
            <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Structural Criteria</span>
                <span className={`font-mono font-semibold ${overallEligibility.structuralMet ? "text-green-400" : "text-destructive"}`}>
                  {overallEligibility.structuralMet ? "✓ Met" : "✗ Not Met"}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Revenue Criteria</span>
                <span className={`font-mono font-semibold ${overallEligibility.revenueMet ? "text-green-400" : "text-destructive"}`}>
                  {overallEligibility.revenueMet ? "✓ Met" : "✗ Not Met"}
                </span>
              </div>
              <div className="flex justify-between text-[11px] pt-1">
                <span className="text-muted-foreground font-semibold">Overall Status</span>
                <span className={`font-mono font-bold text-xs ${overallEligibility.structuralMet && overallEligibility.revenueMet ? "text-green-400" : "text-destructive"}`}>
                  {overallEligibility.label}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial Qualification — only for top leader */}
      {managementResult && (
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <PoundSterling className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Financial Qualification</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current Revenue (4w)</h4>
              <StatRow label="Avg Wire Per Active Seller" value={`£${financialMetrics.avgWirePerActiveSeller.toFixed(2)}`} />
              <StatRow label="Current Weekly Crew Wire" value={`£${financialMetrics.avgWeeklyCrewWire.toFixed(2)}`} />
              <StatRow label="Active Sellers (avg)" value={financialMetrics.activeSellersCount} />
              <StatRow label="Sellers Needed for £7,500" value={financialMetrics.requiredActiveSellers || "—"} />
              <StatRow
                label="Additional Sellers Required"
                value={financialMetrics.additionalSellersRequired}
                highlight={financialMetrics.additionalSellersRequired > 0}
              />
            </div>
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue Projection</h4>
              <StatRow label="Projected Weekly Crew Wire" value={`£${financialMetrics.projectedWeeklyWire.toFixed(2)}`} />
              {!financialMetrics.revenueLikelyAchievable && (
                <StatRow label="Revenue Shortfall" value={`£${financialMetrics.revenueShortfall.toFixed(2)}`} highlight />
              )}
              <StatRow
                label="Revenue Target (£7,500)"
                value={financialMetrics.revenueLikelyAchievable ? "Likely Achievable" : "Gap Exists"}
                highlight={!financialMetrics.revenueLikelyAchievable}
              />

              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-2">2-Week Consistency</h4>
              <StatRow
                label="Consecutive Weeks ≥ £7,500"
                value={`${financialMetrics.consecutiveWeeksAbove7500} / 2`}
                highlight={financialMetrics.consecutiveWeeksAbove7500 < 2}
              />
              <div className={`mt-1 text-[11px] font-semibold px-2 py-1 rounded-md inline-block ${
                financialMetrics.revenueStatus === "achieved"
                  ? "text-green-400 bg-green-400/10"
                  : financialMetrics.revenueStatus === "needs_one_more"
                    ? "text-yellow-400 bg-yellow-400/10"
                    : "text-destructive bg-destructive/10"
              }`}>
                {financialMetrics.revenueStatus === "achieved"
                  ? "✓ Revenue Criteria Achieved"
                  : financialMetrics.revenueStatus === "needs_one_more"
                    ? "Needs 1 More Consecutive Week"
                    : "Revenue Stability Not Proven"}
              </div>
            </div>
          </div>

          {/* Weekly breakdown */}
          <div className="mt-3 pt-3 border-t border-border/30">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Weekly Wire (Last 4 Weeks)</h4>
            <div className="grid grid-cols-4 gap-2">
              {financialMetrics.weeklyCrewWire.map((w) => (
                <div key={w.weekStart} className="bg-muted/20 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">{w.weekStart.slice(5)}</div>
                  <div className={`text-xs font-mono font-semibold mt-0.5 ${w.total >= 7500 ? "text-green-400" : "text-foreground"}`}>
                    £{w.total.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Forecast Breakdown */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Forecast Breakdown</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Stats */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current Stats</h4>
            {managementResult && (
              <>
                <StatRow label="Current First Gen Leaders" value={managementResult.currentFirstGen} />
                <StatRow label="Current Second Gen Leaders" value={managementResult.currentSecondGen} />
              </>
            )}
            <StatRow label="OBS → Start %" value={`${Math.round(breakdown.obsToStartPct)}%`} />
            <StatRow label="Start → Promotion %" value={`${Math.round(breakdown.startToPromoPct)}%`} />
            <StatRow label="Avg Weeks Start → Promotion" value={breakdown.avgWeeksStartToPromo !== null ? `${breakdown.avgWeeksStartToPromo}` : "—"} />
            <StatRow label="Avg Weekly OB Volume" value={breakdown.avgWeeklyOBVolume} />
            <StatRow label="Starter Retention % (4w)" value={`${forecast.retention.starterRetentionPct}%`} highlight={forecast.retention.starterRetentionPct < 60 && forecast.retention.starterTotal4w > 0} />
            <StatRow label="Leader Retention % (4w)" value={`${forecast.retention.leaderRetentionPct}%`} highlight={forecast.retention.leaderRetentionPct < 75 && forecast.retention.leaderTotal4w > 0} />
          </div>

          {/* Projection Model */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projection Model (8 Weeks)</h4>
            <StatRow label="Projected New Starts" value={forecast.expectedStarts} />
            <StatRow label="Projected Promotions" value={forecast.expectedPromotions} />

            <h4 className="text-[11px] font-semibold text-primary uppercase tracking-wider pt-2">Retention Adjusted Projection</h4>
            <StatRow label="Adjusted Projected Starters" value={forecast.adjustedStarts} />
            <StatRow label="Adjusted Projected Leaders" value={forecast.adjustedPromotions} />

            {managementResult && (
              <>
                <StatRow label="Projected First Gen Leaders" value={managementResult.currentFirstGen + Math.round(forecast.adjustedPromotions)} />
                <StatRow label="Projected Second Gen Leaders" value={managementResult.currentSecondGen} />
              </>
            )}
            {managementResult && managementResult.status !== "achieved" && (
              <>
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-2">Management Criteria Gap</h4>
                <StatRow label="First Gen Still Needed" value={managementResult.firstGenNeeded} highlight={managementResult.firstGenNeeded > 0} />
                <StatRow label="Second Gen Still Needed" value={managementResult.secondGenNeeded} highlight={managementResult.secondGenNeeded > 0} />
              </>
            )}
          </div>
        </div>

        {/* KPI Insufficiency */}
        {breakdown.insufficiency.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-lg">
            <h4 className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider mb-1.5">Insufficient Data</h4>
            {breakdown.insufficiency.map((msg, i) => (
              <p key={i} className="text-[11px] text-yellow-400/80">• {msg}</p>
            ))}
          </div>
        )}

        {/* Behavioural Diagnostics */}
        {(showRetrainingWarning || showVolumeWarning || showStarterRetentionWarning || showLeaderRetentionWarning) && (
          <div className="mt-4 space-y-2">
            {showRetrainingWarning && (
              <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-destructive">⚠ Retraining needs work</p>
                  <p className="text-[10px] text-destructive/70">Less than 25% of starters are promoting. Current rate: {Math.round(breakdown.startToPromoPct)}%</p>
                </div>
              </div>
            )}
            {showVolumeWarning && (
              <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-destructive">⚠ More OBS needed</p>
                  <p className="text-[10px] text-destructive/70">Taking less than 5 OBS per week on average. Current: {breakdown.avgWeeklyOBVolume}/wk</p>
                </div>
              </div>
            )}
            {showStarterRetentionWarning && (
              <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-destructive">⚠ High Starter Drop-Off</p>
                  <p className="text-[10px] text-destructive/70">Starter retention is below 60% over the last 4 weeks. Current: {forecast.retention.starterRetentionPct}%</p>
                </div>
              </div>
            )}
            {showLeaderRetentionWarning && (
              <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-destructive">⚠ Leader Retention Low</p>
                  <p className="text-[10px] text-destructive/70">Leader retention is below 75% over the last 4 weeks. Current: {forecast.retention.leaderRetentionPct}%</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recruitment Weakness Impact */}
      {breakdown.weakestSource && (
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Recruitment Weakness Impact</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            {breakdown.sources.map((s) => (
              <div key={s.label} className="bg-muted/20 rounded-lg p-3 space-y-1.5">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{s.label}</h4>
                <StatRow label="Added → OB" value={`${s.addedToOB}%`} />
                <StatRow label="OB → Start" value={`${s.obToStart}%`} />
                <StatRow label="Start → Promotion" value={`${s.startToPromo}%`} />
              </div>
            ))}
          </div>
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-[11px] text-foreground">
              <span className="font-semibold">Weakest Source: {breakdown.weakestSource.name}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Improving this conversion by 10% would result in approximately <span className="font-mono font-semibold text-primary">{breakdown.weakestSource.improvementGain}</span> additional promotions in 8 weeks.
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded border-[1.5px] border-primary bg-primary/10" />
          <span>Leader</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-foreground">Name</span>
          <span>Brand Ambassador</span>
        </div>
        {showPredicted && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-[1.5px] border-dashed border-muted-foreground" />
            <span>Predicted</span>
          </div>
        )}
      </div>

      {/* Tree container */}
      <div className="glass-panel">
        <CrewTree tree={tree} />
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${highlight ? "text-destructive" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
