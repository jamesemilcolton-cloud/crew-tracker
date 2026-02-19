import { useState, useMemo, useEffect } from "react";
import { Candidate, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { GitBranch } from "lucide-react";
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

const CREW_STAGES: PipelineStage[] = ["start", "bell", "promoted"];

/**
 * Recursively build the crew tree from profile hierarchy + candidate data.
 *
 * For a given profile node:
 *   1. Find sub-leader profiles (profiles where leader_id = this profile's id)
 *   2. Find candidates recruited_by this profile at start/bell stages (non-promoted crew)
 *   3. Recurse into each sub-leader profile
 *
 * This ensures multi-level propagation: A → B → C all appear correctly nested.
 */
function buildRecursiveTree(
  profileId: string,
  profileName: string,
  allProfiles: Profile[],
  allCandidates: Candidate[],
  visited: Set<string> = new Set()
): CrewNode {
  // Prevent infinite loops
  if (visited.has(profileId)) {
    return { id: profileId, name: profileName, isLeader: true, isPredicted: false, children: [] };
  }
  visited.add(profileId);

  // Find sub-leader profiles (their leader_id points to this profile)
  const subLeaderProfiles = allProfiles.filter((p) => p.leader_id === profileId);

  // Find candidates recruited by this profile that are at crew stages but NOT promoted
  // (promoted candidates should appear as leaders via their profile)
  const directCrew = allCandidates.filter(
    (c) => c.recruitedBy === profileId && (c.stage === "start" || c.stage === "bell")
  );

  const children: CrewNode[] = [];

  // Add sub-leader nodes recursively
  subLeaderProfiles.forEach((subProfile) => {
    children.push(
      buildRecursiveTree(subProfile.id, subProfile.full_name, allProfiles, allCandidates, visited)
    );
  });

  // Add direct non-promoted crew members
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
 * Build predicted tree with 8-week forecast layered on top of the recursive hierarchy.
 */
function buildPredictedRecursiveTree(
  profileId: string,
  profileName: string,
  allProfiles: Profile[],
  allCandidates: Candidate[],
  interviewToStartRate: number,
  startToPromotionRate: number,
  avgStartToPromotionDays: number,
  visited: Set<string> = new Set()
): CrewNode {
  if (visited.has(profileId)) {
    return { id: profileId, name: profileName, isLeader: true, isPredicted: false, children: [] };
  }
  visited.add(profileId);

  const now = new Date();
  const subLeaderProfiles = allProfiles.filter((p) => p.leader_id === profileId);

  // Candidates recruited by this profile
  const recruitedCandidates = allCandidates.filter((c) => c.recruitedBy === profileId);
  const directCrew = recruitedCandidates.filter((c) => c.stage === "start" || c.stage === "bell");

  // Predict which direct crew will be promoted within 8 weeks
  const predictedPromotionIds = new Set<string>();
  directCrew.forEach((c) => {
    if (c.stage === "start" || c.stage === "bell") {
      const startDate = stageEntryDate(c, "start");
      if (startDate) {
        const daysSinceStart = (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
        const daysRemaining = avgStartToPromotionDays - daysSinceStart;
        if (daysRemaining <= 56 && daysRemaining > 0 && startToPromotionRate > 0.15) {
          predictedPromotionIds.add(c.id);
        }
      }
    }
  });

  // Predict pipeline candidates that may start (recruited by this profile's user)
  // We need to find candidates in pre-start stages recruited by this profile
  const preStartStages: PipelineStage[] = ["2nd-round", "final-round", "rehash", "sunday-call"];
  const inPipeline = recruitedCandidates.filter((c) => preStartStages.includes(c.stage) && !c.status);
  const predictedStarts: CrewNode[] = [];
  inPipeline.forEach((c) => {
    const stageIdx = STAGES_ORDER.indexOf(c.stage);
    const stepsToStart = STAGES_ORDER.indexOf("start") - stageIdx;
    const daysToStart = stepsToStart * 7;
    if (daysToStart <= 56) {
      const conversionChance = stageIdx >= 2 ? 0.7 : interviewToStartRate;
      if (conversionChance > 0.3) {
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

  const children: CrewNode[] = [];

  // Recurse into existing sub-leader profiles
  subLeaderProfiles.forEach((subProfile) => {
    children.push(
      buildPredictedRecursiveTree(
        subProfile.id, subProfile.full_name, allProfiles, allCandidates,
        interviewToStartRate, startToPromotionRate, avgStartToPromotionDays, visited
      )
    );
  });

  // Add direct crew — predicted promotions show as leader nodes
  directCrew.forEach((c) => {
    if (predictedPromotionIds.has(c.id)) {
      children.push({
        id: c.id,
        name: c.name,
        isLeader: true,
        isPredicted: true,
        children: [],
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

  // Add predicted starts
  children.push(...predictedStarts);

  return {
    id: profileId,
    name: profileName,
    isLeader: true,
    isPredicted: false,
    children,
  };
}

// Calculate tree dimensions for auto-scaling
function measureTree(node: CrewNode, depth = 0): { width: number; height: number; leafCount: number } {
  if (node.children.length === 0) {
    return { width: 1, height: depth + 1, leafCount: 1 };
  }
  let totalLeaves = 0;
  let maxHeight = 0;
  node.children.forEach((child) => {
    const m = measureTree(child, depth + 1);
    totalLeaves += m.leafCount;
    maxHeight = Math.max(maxHeight, m.height);
  });
  return { width: totalLeaves, height: maxHeight, leafCount: totalLeaves };
}

// Render tree node with dynamic spacing
function TreeNode({
  node,
  x,
  y,
  parentX,
  parentY,
  nodeSpacing,
  levelHeight,
}: {
  node: CrewNode;
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
  nodeSpacing: number;
  levelHeight: number;
}) {
  const nodeWidth = 100;
  const nodeHeight = 26;

  const childMeasures = node.children.map((child) => measureTree(child));
  const totalLeaves = childMeasures.reduce((sum, m) => sum + m.leafCount, 0);
  const totalChildWidth = totalLeaves * nodeSpacing;

  let currentX = x - totalChildWidth / 2;

  return (
    <g>
      {parentX !== undefined && parentY !== undefined && (
        <path
          d={`M ${parentX} ${parentY + nodeHeight / 2} L ${parentX} ${parentY + nodeHeight / 2 + levelHeight * 0.4} L ${x} ${y - levelHeight * 0.1} L ${x} ${y - nodeHeight / 2}`}
          fill="none"
          stroke="hsl(222 30% 20%)"
          strokeWidth="1.5"
          strokeDasharray={node.isPredicted ? "4 4" : "none"}
        />
      )}

      {node.isLeader && (
        <g>
          <rect
            x={x - nodeWidth / 2}
            y={y - nodeHeight / 2}
            width={nodeWidth}
            height={nodeHeight}
            rx="10"
            fill="hsl(172 66% 50% / 0.06)"
            stroke="hsl(172 66% 50%)"
            strokeWidth="1.5"
            strokeDasharray={node.isPredicted ? "4 4" : "none"}
          />
        </g>
      )}

      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={node.isPredicted ? "hsl(215 20% 45%)" : "hsl(210 40% 92%)"}
        fontSize="9"
        fontWeight={node.isLeader ? "600" : "400"}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {node.name}
      </text>

      {node.children.map((child, i) => {
        const childLeafCount = childMeasures[i].leafCount;
        const childWidth = childLeafCount * nodeSpacing;
        const childX = currentX + childWidth / 2;
        const childY = y + levelHeight;
        currentX += childWidth;

        return (
          <TreeNode
            key={child.id}
            node={child}
            x={childX}
            y={childY}
            parentX={x}
            parentY={y}
            nodeSpacing={nodeSpacing}
            levelHeight={levelHeight}
          />
        );
      })}
    </g>
  );
}

export function CrewBubbleForecast({ candidates }: CrewBubbleForecastProps) {
  const [showPredicted, setShowPredicted] = useState(false);
  const { profile } = useAuth();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  // Fetch all profiles for hierarchy building
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

  // Forecast rates
  const forecastRates = useMemo(() => {
    const reached2nd = candidates.filter((c) => reachedStage(c, "2nd-round")).length;
    const reachedStart = candidates.filter((c) => reachedStage(c, "start")).length;
    const reachedPromoted = candidates.filter((c) => reachedStage(c, "promoted")).length;

    const interviewToStartRate = reached2nd > 0 ? reachedStart / reached2nd : 0;
    const startToPromotionRate = reachedStart > 0 ? reachedPromoted / reachedStart : 0;

    const promotedCandidates = candidates.filter((c) => c.stage === "promoted");
    let avgStartToPromotionDays = 60;
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
        avgStartToPromotionDays = durations.reduce((a, b) => a + b, 0) / durations.length;
      }
    }
    return { interviewToStartRate, startToPromotionRate, avgStartToPromotionDays };
  }, [candidates]);

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
      profile.id, profile.full_name, allProfiles, candidates,
      forecastRates.interviewToStartRate,
      forecastRates.startToPromotionRate,
      forecastRates.avgStartToPromotionDays
    );
  }, [candidates, allProfiles, profile, forecastRates]);

  const tree = showPredicted ? predictedTree : currentTree;

  // Calculate viewBox to auto-fit
  const treeMeasure = measureTree(tree);
  const nodeSpacing = 110;
  const levelHeight = 60;
  const padding = 40;

  const svgWidth = Math.max(treeMeasure.leafCount * nodeSpacing + padding * 2, 400);
  const svgHeight = treeMeasure.height * levelHeight + padding * 2;

  const viewBox = `${-svgWidth / 2} ${-padding} ${svgWidth} ${svgHeight}`;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Start → Promotion:</span>
            <span className="text-foreground font-mono font-semibold">{startToPromotionPct}%</span>
          </div>
        </div>
      </div>

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

      {/* Tree canvas — auto-scaled, no zoom/pan */}
      <div
        className="glass-panel"
        style={{ height: "calc(100vh - 280px)", overflow: "hidden" }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMin meet"
          className="select-none"
        >
          <TreeNode
            node={tree}
            x={0}
            y={0}
            nodeSpacing={nodeSpacing}
            levelHeight={levelHeight}
          />
        </svg>
      </div>
    </div>
  );
}
