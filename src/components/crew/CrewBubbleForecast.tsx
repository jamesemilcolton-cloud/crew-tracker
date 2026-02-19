import { useState, useMemo, useEffect } from "react";
import { Target } from "lucide-react";
import { Candidate, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { GitBranch, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
}

interface CrewNode {
  id: string;
  name: string;
  isLeader: boolean;
  isPredicted: boolean;
  children: CrewNode[];
}

interface CrewBubbleForecastProps {
  candidates: Candidate[];
}

type ForecastConfidence = "High" | "Medium" | "Low";

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
  if (stage === "2nd-round" && c.history.length === 0 && STAGES_ORDER.indexOf(c.stage) >= 0) {
    return c.createdAt;
  }
  const entry = c.history.find((h) => h.to === stage);
  return entry?.date ?? null;
}

// Get Monday of the week for a given date
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Compute weighted 4-week averages with recency bias.
 * Weeks 1-2 (most recent) weighted 1.5x, Weeks 3-4 weighted 0.5x.
 */
function computeWeightedForecast(candidates: Candidate[]): WeightedForecast {
  const now = new Date();
  const currentMonday = getWeekMonday(now);

  // Build 4 weekly buckets (week 0 = most recent completed week, etc.)
  const weeks: { start: Date; end: Date }[] = [];
  for (let i = 1; i <= 4; i++) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({ start, end });
  }

  // Weights: weeks[0]=most recent completed → higher weight
  // weeks[0,1] = recent (weight 1.5), weeks[2,3] = older (weight 0.5)
  const weights = [1.5, 1.5, 0.5, 0.5];
  const totalWeight = weights.reduce((a, b) => a + b, 0); // 4.0

  // Count events per week
  const weeklyInterviews: number[] = [0, 0, 0, 0];
  const weeklyStarts: number[] = [0, 0, 0, 0];
  const weeklyPromotions: number[] = [0, 0, 0, 0];

  candidates.forEach((c) => {
    // 2nd round entries
    const entryDate2nd = stageEntryDate(c, "2nd-round");
    if (entryDate2nd) {
      const d = new Date(entryDate2nd);
      weeks.forEach((w, i) => {
        if (d >= w.start && d < w.end) weeklyInterviews[i]++;
      });
    }

    // Start entries
    const entryDateStart = stageEntryDate(c, "start");
    if (entryDateStart) {
      const d = new Date(entryDateStart);
      weeks.forEach((w, i) => {
        if (d >= w.start && d < w.end) weeklyStarts[i]++;
      });
    }

    // Promotion entries (exclude bell from forecast per constraints)
    const entryDatePromo = stageEntryDate(c, "promoted");
    if (entryDatePromo) {
      const d = new Date(entryDatePromo);
      weeks.forEach((w, i) => {
        if (d >= w.start && d < w.end) weeklyPromotions[i]++;
      });
    }
  });

  // Weighted averages
  const wAvgInterviews = weights.reduce((sum, w, i) => sum + w * weeklyInterviews[i], 0) / totalWeight;
  const wAvgStarts = weights.reduce((sum, w, i) => sum + w * weeklyStarts[i], 0) / totalWeight;
  const wAvgPromotions = weights.reduce((sum, w, i) => sum + w * weeklyPromotions[i], 0) / totalWeight;

  // Weighted conversion rates
  const totalInterviews4w = weeklyInterviews.reduce((a, b) => a + b, 0);
  const totalStarts4w = weeklyStarts.reduce((a, b) => a + b, 0);
  const totalPromotions4w = weeklyPromotions.reduce((a, b) => a + b, 0);

  const interviewToStartPct = totalInterviews4w > 0 ? totalStarts4w / totalInterviews4w : 0;
  const startToPromotionPct = totalStarts4w > 0 ? totalPromotions4w / totalStarts4w : 0;

  // Average time to promotion from historical data
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

  // Flat 8-week projection (no compounding)
  let expected2ndRounds = wAvgInterviews * 8;
  let expectedStarts = expected2ndRounds * interviewToStartPct;
  let expectedPromotions = expectedStarts * startToPromotionPct;

  // Determine confidence
  let confidence: ForecastConfidence = "High";
  const interviewVariance = computeVariance(weeklyInterviews);
  const startVariance = computeVariance(weeklyStarts);

  if (totalInterviews4w < 10 || totalStarts4w < 5 || totalPromotions4w < 3) {
    confidence = "Low";
    // Conservative smoothing: reduce by 30%
    expected2ndRounds *= 0.7;
    expectedStarts *= 0.7;
    expectedPromotions *= 0.7;
  } else if (interviewVariance > 2 || startVariance > 1.5) {
    confidence = "Medium";
    // Slight smoothing
    expected2ndRounds *= 0.85;
    expectedStarts *= 0.85;
    expectedPromotions *= 0.85;
  }

  return {
    weeklyInterviews: wAvgInterviews,
    weeklyStarts: wAvgStarts,
    weeklyPromotions: wAvgPromotions,
    interviewToStartPct,
    startToPromotionPct,
    avgPromotionDays,
    expected2ndRounds: Math.round(expected2ndRounds * 10) / 10,
    expectedStarts: Math.round(expectedStarts * 10) / 10,
    expectedPromotions: Math.round(expectedPromotions * 10) / 10,
    confidence,
  };
}

function computeVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Recursively build the crew tree from profile hierarchy + candidate data.
 */
function buildRecursiveTree(
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
    (c) => c.recruitedBy === profileId && (c.stage === "start" || c.stage === "bell")
  );
  // Also include promoted candidates as leader nodes (they have no profile entry but should appear in tree)
  const promotedCrew = allCandidates.filter(
    (c) => c.recruitedBy === profileId && c.stage === "promoted" && !allProfiles.some((p) => p.full_name === c.name && p.leader_id === profileId)
  );

  const children: CrewNode[] = [];

  subLeaderProfiles.forEach((subProfile) => {
    children.push(
      buildRecursiveTree(subProfile.id, subProfile.full_name, allProfiles, allCandidates, visited)
    );
  });

  // Add promoted candidates as leader nodes (they don't have profile entries but should appear in tree)
  promotedCrew.forEach((c) => {
    // Recursively build subtree for promoted candidates (they can recruit too)
    const promotedChildren: CrewNode[] = [];
    const promotedDirectCrew = allCandidates.filter(
      (cc) => cc.recruitedBy === c.id && (cc.stage === "start" || cc.stage === "bell")
    );
    promotedDirectCrew.forEach((cc) => {
      promotedChildren.push({
        id: cc.id,
        name: cc.name,
        isLeader: false,
        isPredicted: false,
        children: [],
      });
    });
    children.push({
      id: c.id,
      name: c.name,
      isLeader: true,
      isPredicted: false,
      children: promotedChildren,
    });
  });

  directCrew.forEach((c) => {
    children.push({
      id: c.id,
      name: c.name,
      isLeader: false,
      isPredicted: false,
      children: [],
    });
  });

  return {
    id: profileId,
    name: profileName,
    isLeader: true,
    isPredicted: false,
    children,
  };
}

/**
 * Build predicted tree with flat weighted 8-week forecast.
 * No compounding: predicted promotions do NOT generate new predicted recruits.
 * Promotion eligibility: time in Start >= 70% of weighted avg promotion time.
 */
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
  const directCrew = recruitedCandidates.filter((c) => c.stage === "start" || c.stage === "bell");
  const promotedCrew = recruitedCandidates.filter(
    (c) => c.stage === "promoted" && !allProfiles.some((p) => p.full_name === c.name && p.leader_id === profileId)
  );

  // Promotion eligibility: time in Start >= 70% of weighted average promotion time
  const promotionThreshold = forecast.avgPromotionDays * 0.7;
  const predictedPromotionIds = new Set<string>();

  directCrew.forEach((c) => {
    const startDate = stageEntryDate(c, "start");
    if (startDate) {
      const daysSinceStart = (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
      // Must have already served 70% of avg time AND remaining time fits within 8 weeks
      if (daysSinceStart >= promotionThreshold) {
        const daysRemaining = forecast.avgPromotionDays - daysSinceStart;
        if (daysRemaining <= 56 && daysRemaining > 0 && forecast.startToPromotionPct > 0.1) {
          predictedPromotionIds.add(c.id);
        }
      }
    }
  });

  // Pipeline candidates likely to start (flat rate, no compounding)
  const preStartStages: PipelineStage[] = ["2nd-round", "final-round", "rehash", "sunday-call"];
  const inPipeline = recruitedCandidates.filter((c) => preStartStages.includes(c.stage) && !c.status);
  const predictedStarts: CrewNode[] = [];
  inPipeline.forEach((c) => {
    const stageIdx = STAGES_ORDER.indexOf(c.stage);
    const stepsToStart = STAGES_ORDER.indexOf("start") - stageIdx;
    const daysToStart = stepsToStart * 7;
    if (daysToStart <= 56) {
      // Use flat weighted conversion rate, no escalation for advanced stages
      if (forecast.interviewToStartPct > 0.15) {
        predictedStarts.push({
          id: `pred-start-${c.id}`,
          name: `${c.name} (Predicted)`,
          isLeader: false,
          isPredicted: true,
          children: [],
        });
      }
    }
  });

  // Add predicted new recruits based on flat weekly average (no compounding from predicted promotions)
  const predictedNewCount = Math.round(forecast.weeklyInterviews * 8 * forecast.interviewToStartPct);
  const smoothedNewCount = forecast.confidence === "Low"
    ? Math.max(0, Math.floor(predictedNewCount * 0.5))
    : forecast.confidence === "Medium"
    ? Math.max(0, Math.floor(predictedNewCount * 0.75))
    : predictedNewCount;

  // Distribute predicted new recruits only under this specific recruiter proportionally
  // Use a simple ratio: total predicted divided among all recruiters in tree
  // For simplicity, attach to current node only if this recruiter has pipeline
  const predictedNewRecruits: CrewNode[] = [];
  if (inPipeline.length > 0 || directCrew.length > 0) {
    const countForThisNode = Math.min(smoothedNewCount, 3); // cap per node to avoid visual clutter
    for (let i = 0; i < countForThisNode; i++) {
      predictedNewRecruits.push({
        id: `pred-new-${profileId}-${i}`,
        name: `New Recruit ${i + 1}`,
        isLeader: false,
        isPredicted: true,
        children: [],
      });
    }
  }

  const children: CrewNode[] = [];

  // Recurse into existing sub-leaders (no predicted promotions generating new activity)
  subLeaderProfiles.forEach((subProfile) => {
    children.push(
      buildPredictedRecursiveTree(
        subProfile.id, subProfile.full_name, allProfiles, allCandidates, forecast, visited
      )
    );
  });

  // Already promoted candidates as leader nodes
  promotedCrew.forEach((c) => {
    children.push({
      id: c.id,
      name: c.name,
      isLeader: true,
      isPredicted: false,
      children: [],
    });
  });

  // Direct crew — predicted promotions show as leader nodes but with NO children (flat, no compounding)
  directCrew.forEach((c) => {
    if (predictedPromotionIds.has(c.id)) {
      children.push({
        id: c.id,
        name: c.name,
        isLeader: true,
        isPredicted: true,
        children: [], // No predicted recruitment from predicted promotions
      });
    } else {
      children.push({
        id: c.id,
        name: c.name,
        isLeader: false,
        isPredicted: false,
        children: [],
      });
    }
  });

  // Add predicted starts from pipeline
  children.push(...predictedStarts);

  // Add predicted new recruits
  children.push(...predictedNewRecruits);

  return {
    id: profileId,
    name: profileName,
    isLeader: true,
    isPredicted: false,
    children,
  };
}

// Count total nodes for informational display
function countNodes(node: CrewNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

// --- Management Criteria Simulation ---
// Management = ≥4 leaders in full tree AND ≥1 leader has a sub-leader (2-level depth)

interface ManagementResult {
  status: "achieved" | "predicted" | "beyond";
  weeksToManagement: number | null;
  confidence: ForecastConfidence;
}

function countLeadersInTree(node: CrewNode): number {
  let count = node.isLeader ? 1 : 0;
  for (const c of node.children) count += countLeadersInTree(c);
  return count;
}

function hasLeaderWithSubLeader(node: CrewNode): boolean {
  if (!node.isLeader) return false;
  for (const child of node.children) {
    if (child.isLeader) {
      // child is a leader - check if child has a leader child (2-level depth)
      for (const grandchild of child.children) {
        if (grandchild.isLeader) return true;
      }
    }
  }
  // Recurse into children
  for (const child of node.children) {
    if (hasLeaderWithSubLeader(child)) return true;
  }
  return false;
}

function checkManagementCriteria(tree: CrewNode): boolean {
  const totalLeaders = countLeadersInTree(tree) - 1; // exclude root (me)
  return totalLeaders >= 4 && hasLeaderWithSubLeader(tree);
}

interface SimBA {
  weekStarted: number; // week number they started
  recruitedByLeaderId: string;
}

interface SimLeader {
  id: string;
  parentId: string | null;
  hasSubLeader: boolean;
}

/**
 * Simulate week-by-week to determine when management criteria is met.
 * Uses weighted 4-week forecast data. Flat pace, no compounding.
 */
function simulateManagementTimeline(
  currentTree: CrewNode,
  forecast: WeightedForecast,
  candidates: Candidate[]
): ManagementResult {
  // Check if already achieved with current tree
  if (checkManagementCriteria(currentTree)) {
    return { status: "achieved", weeksToManagement: null, confidence: forecast.confidence };
  }

  // Gather current state from tree
  const currentLeaders: SimLeader[] = [];
  const currentBAs: SimBA[] = [];

  function walkTree(node: CrewNode, parentId: string | null) {
    if (node.isLeader && !node.isPredicted) {
      const hasSubLeader = node.children.some((c) => c.isLeader && !c.isPredicted);
      currentLeaders.push({ id: node.id, parentId, hasSubLeader });
    }
    if (!node.isLeader && !node.isPredicted) {
      currentBAs.push({ weekStarted: -99, recruitedByLeaderId: parentId ?? "root" }); // already started long ago
    }
    for (const c of node.children) walkTree(c, node.id);
  }
  walkTree(currentTree, null);

  // Also include pipeline candidates with time-in-start info
  const now = new Date();
  const startedCandidates = candidates.filter(
    (c) => (c.stage === "start" || c.stage === "bell") && !c.status
  );
  const baWeekMap: Map<string, number> = new Map();
  startedCandidates.forEach((c) => {
    const startDate = stageEntryDate(c, "start");
    if (startDate) {
      const weeksInRole = (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 7);
      baWeekMap.set(c.id, -Math.floor(weeksInRole)); // negative = started X weeks ago
    }
  });

  // Simulation state
  let leaders = [...currentLeaders];
  const bas: SimBA[] = [];
  // Populate BAs with actual time data
  startedCandidates.forEach((c) => {
    const weekStarted = baWeekMap.get(c.id) ?? -99;
    bas.push({ weekStarted, recruitedByLeaderId: c.recruitedBy ?? leaders[0]?.id ?? "root" });
  });

  const avgPromotionWeeks = Math.max(1, Math.round(forecast.avgPromotionDays / 7));
  const promotionThresholdWeeks = Math.floor(avgPromotionWeeks * 0.7);
  const weeklyNewStarts = forecast.weeklyStarts; // flat pace
  const promoRate = forecast.startToPromotionPct;

  // Simulate up to 12 weeks
  for (let week = 1; week <= 12; week++) {
    // 1. Add new starts (flat pace, distributed to root leader)
    const newStartCount = Math.round(weeklyNewStarts);
    for (let i = 0; i < newStartCount; i++) {
      bas.push({ weekStarted: week, recruitedByLeaderId: leaders[0]?.id ?? "root" });
    }

    // 2. Check promotion eligibility for existing BAs
    const toPromote: number[] = [];
    bas.forEach((ba, idx) => {
      const weeksInRole = week - ba.weekStarted;
      if (weeksInRole >= promotionThresholdWeeks && promoRate > 0) {
        // Probabilistic: only promote if expected by rate
        // Simple: promote ceil(rate * eligible) per week, but cap to avoid inflation
        toPromote.push(idx);
      }
    });

    // Apply promotion rate: only promote (promoRate * eligible) rounded
    const promoteCount = Math.min(toPromote.length, Math.max(0, Math.round(toPromote.length * promoRate)));
    const promoted = toPromote.slice(0, promoteCount);

    // Process promotions (remove from BAs, add as leaders)
    const promotedSet = new Set(promoted);
    promoted.forEach((idx) => {
      const ba = bas[idx];
      const newLeaderId = `sim-leader-${week}-${idx}`;
      // Check if parent leader now has a sub-leader
      const parentLeader = leaders.find((l) => l.id === ba.recruitedByLeaderId);
      if (parentLeader) parentLeader.hasSubLeader = true;
      leaders.push({ id: newLeaderId, parentId: ba.recruitedByLeaderId, hasSubLeader: false });
    });

    // Remove promoted BAs (reverse order to preserve indices)
    const sortedPromoted = [...promotedSet].sort((a, b) => b - a);
    sortedPromoted.forEach((idx) => bas.splice(idx, 1));

    // 3. Check management criteria
    const totalLeaders = leaders.length - 1; // exclude root
    const anyLeaderWithSubLeader = leaders.some((l) => l.parentId !== null && l.hasSubLeader);
    // Also check: does root have a sub-leader who has a sub-leader?
    const rootHasDepth2 = leaders.some((l) => {
      if (l.parentId !== leaders[0]?.id) return false; // not direct child of root
      return l.hasSubLeader;
    });

    if (totalLeaders >= 4 && (anyLeaderWithSubLeader || rootHasDepth2)) {
      return { status: "predicted", weeksToManagement: week, confidence: forecast.confidence };
    }
  }

  return { status: "beyond", weeksToManagement: null, confidence: forecast.confidence };
}

// HTML-based tree node component with fixed sizes
function TreeNode({
  node,
  collapsedIds,
  onToggle,
}: {
  node: CrewNode;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 32;
  const isCollapsed = collapsedIds.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center" style={{ minWidth: NODE_WIDTH }}>
      {/* Node */}
      <div
        className="relative flex items-center justify-center cursor-pointer select-none"
        style={{
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          borderRadius: node.isLeader ? 16 : 8,
          border: node.isLeader
            ? `1.5px ${node.isPredicted ? "dashed" : "solid"} hsl(172 66% 50%)`
            : "none",
          background: node.isLeader
            ? node.isPredicted
              ? "hsl(172 66% 50% / 0.03)"
              : "hsl(172 66% 50% / 0.08)"
            : "transparent",
          opacity: node.isPredicted ? 0.55 : 1,
        }}
        onClick={() => hasChildren && onToggle(node.id)}
        title={hasChildren ? (isCollapsed ? "Expand" : "Collapse") : undefined}
      >
        <span
          className="truncate px-2"
          style={{
            fontSize: 12,
            fontWeight: node.isLeader ? 600 : 400,
            fontStyle: node.isPredicted ? "italic" : "normal",
            color: node.isPredicted
              ? "hsl(215 20% 55%)"
              : "hsl(210 40% 92%)",
          }}
        >
          {node.name}
        </span>
        {hasChildren && (
          <span
            className="absolute -right-1 -bottom-1 text-[9px] font-mono rounded-full flex items-center justify-center"
            style={{
              width: 16,
              height: 16,
              background: "hsl(222 30% 18%)",
              border: "1px solid hsl(222 30% 30%)",
              color: "hsl(215 20% 65%)",
            }}
          >
            {isCollapsed ? "+" : "−"}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center">
          {/* Vertical connector from parent */}
          <div
            style={{
              width: 1.5,
              height: 24,
              background: "hsl(222 30% 25%)",
            }}
          />

          {/* Horizontal bar spanning all children */}
          {node.children.length > 1 && (
            <div className="relative w-full" style={{ height: 1.5 }}>
              {/* We use a flex row to measure, then draw the bar */}
            </div>
          )}

          {/* Children row */}
          <div className="flex items-start" style={{ gap: 12 }}>
            {node.children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical connector into child */}
                <div
                  style={{
                    width: 1.5,
                    height: 24,
                    background: "hsl(222 30% 25%)",
                    borderLeft: child.isPredicted ? "1.5px dashed hsl(222 30% 25%)" : undefined,
                    ...(child.isPredicted
                      ? { width: 0, borderLeft: "1.5px dashed hsl(222 30% 35%)" }
                      : {}),
                  }}
                />
                <TreeNode
                  node={child}
                  collapsedIds={collapsedIds}
                  onToggle={onToggle}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Collect all IDs that have children (for expand/collapse all)
function collectExpandableIds(node: CrewNode, ids: Set<string> = new Set()): Set<string> {
  if (node.children.length > 0) ids.add(node.id);
  node.children.forEach((c) => collectExpandableIds(c, ids));
  return ids;
}

const CONFIDENCE_STYLES: Record<ForecastConfidence, { color: string; bg: string }> = {
  High: { color: "text-green-400", bg: "bg-green-400/10" },
  Medium: { color: "text-yellow-400", bg: "bg-yellow-400/10" },
  Low: { color: "text-red-400", bg: "bg-red-400/10" },
};

export function CrewBubbleForecast({ candidates }: CrewBubbleForecastProps) {
  const [showPredicted, setShowPredicted] = useState(false);
  // Note: line numbers shifted due to inserted code above
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const { profile } = useAuth();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    async function fetchProfiles() {
      const { data } = await supabase.from("profiles").select("id, user_id, full_name, leader_id");
      if (data) setAllProfiles(data);
    }
    fetchProfiles();
  }, []);

  // Compute historical Start → Promotion %
  const startToPromotionPct = useMemo(() => {
    const reachedStart = candidates.filter((c) => reachedStage(c, "start")).length;
    const reachedPromoted = candidates.filter((c) => reachedStage(c, "promoted")).length;
    if (reachedStart === 0) return 0;
    return Math.round((reachedPromoted / reachedStart) * 100);
  }, [candidates]);

  // Weighted forecast
  const forecast = useMemo(() => computeWeightedForecast(candidates), [candidates]);

  const currentTree = useMemo(() => {
    if (!profile || allProfiles.length === 0) {
      return { id: "root", name: "You", isLeader: true, isPredicted: false, children: [] };
    }
    return buildRecursiveTree(profile.id, profile.full_name, allProfiles, candidates);
  }, [candidates, allProfiles, profile]);

  const predictedTree = useMemo(() => {
    if (!profile || allProfiles.length === 0) {
      return { id: "root", name: "You", isLeader: true, isPredicted: false, children: [] };
    }
    return buildPredictedRecursiveTree(
      profile.id, profile.full_name, allProfiles, candidates, forecast
    );
  }, [candidates, allProfiles, profile, forecast]);

  // Management criteria: only for top leader (no leader_id)
  const isTopLeader = profile ? !profile.leader_id : false;

  const managementResult = useMemo<ManagementResult | null>(() => {
    if (!isTopLeader || !profile) return null;
    return simulateManagementTimeline(currentTree, forecast, candidates);
  }, [isTopLeader, profile, currentTree, forecast, candidates]);

  const tree = showPredicted ? predictedTree : currentTree;
  const totalNodes = countNodes(tree);

  const expandableIds = useMemo(() => collectExpandableIds(tree), [tree]);

  const handleToggle = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());
  const collapseAll = () => setCollapsedIds(new Set(expandableIds));

  const confStyle = CONFIDENCE_STYLES[forecast.confidence];

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
            {showPredicted && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${confStyle.bg}`}>
                <Shield className="w-3 h-3" />
                <span className={`font-medium ${confStyle.color}`}>
                  Confidence: {forecast.confidence}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forecast summary when predicted */}
      {showPredicted && (
        <div className="glass-panel p-3">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">Expected 2nd Rounds</div>
              <div className="text-foreground font-mono font-semibold text-sm mt-0.5">
                {forecast.expected2ndRounds}
              </div>
              <div className="text-muted-foreground/60 text-[10px]">
                ~{forecast.weeklyInterviews.toFixed(1)}/wk weighted avg
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Expected Starts</div>
              <div className="text-foreground font-mono font-semibold text-sm mt-0.5">
                {forecast.expectedStarts}
              </div>
              <div className="text-muted-foreground/60 text-[10px]">
                {(forecast.interviewToStartPct * 100).toFixed(0)}% conversion
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Expected Promotions</div>
              <div className="text-foreground font-mono font-semibold text-sm mt-0.5">
                {forecast.expectedPromotions}
              </div>
              <div className="text-muted-foreground/60 text-[10px]">
                {(forecast.startToPromotionPct * 100).toFixed(0)}% promotion rate
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Management Criteria — only for top leader */}
      {managementResult && (
        <div className="glass-panel p-3">
          <div className="flex items-center gap-3">
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
                {managementResult.confidence === "Low" && (
                  <span className="text-[10px] text-red-400/80 bg-red-400/10 px-2 py-0.5 rounded">
                    Low confidence due to limited recent data
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground/70 bg-muted/20 px-2.5 py-1 rounded-md">
                  Beyond 12-week forecast window
                </span>
                {managementResult.confidence === "Low" && (
                  <span className="text-[10px] text-red-400/80 bg-red-400/10 px-2 py-0.5 rounded">
                    Low confidence due to limited recent data
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground/60">
            Requires ≥4 leaders in your team + at least 1 leader with a promoted sub-leader
          </div>
        </div>
      )}


      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
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
        {expandableIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-2 py-1 text-[10px] font-medium rounded bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-[10px] font-medium rounded bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Tree container — scrollable, no shrink */}
      <div
        className="glass-panel overflow-auto"
        style={{ maxHeight: "calc(100vh - 340px)", minHeight: 200 }}
      >
        <div className="p-8 flex justify-center" style={{ minWidth: "fit-content" }}>
          <TreeNode
            node={tree}
            collapsedIds={collapsedIds}
            onToggle={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
