import { useState, useMemo } from "react";
import { Candidate, STAGES_ORDER, PipelineStage } from "@/lib/types";
import { GitBranch } from "lucide-react";

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

// Build crew tree from pipeline candidates
function buildCrewTree(candidates: Candidate[]): CrewNode {
  const START_FORWARD = STAGES_ORDER.slice(STAGES_ORDER.indexOf("start"));
  const crewCandidates = candidates.filter((c) => START_FORWARD.includes(c.stage));

  const promoted = crewCandidates.filter((c) => c.stage === "promoted");
  const nonPromoted = crewCandidates.filter((c) => c.stage !== "promoted");

  // Build leader nodes with their recruits
  const leaderNodes: CrewNode[] = promoted.map((leader) => {
    const recruits = nonPromoted.filter((c) => c.recruitedBy === leader.id);
    return {
      id: leader.id,
      name: leader.name,
      isLeader: true,
      isPredicted: false,
      children: recruits.map((r) => ({
        id: r.id,
        name: r.name,
        isLeader: false,
        isPredicted: false,
        children: [],
      })),
    };
  });

  // Unassigned crew (no recruitedBy or recruitedBy not a promoted leader)
  const assignedIds = new Set(nonPromoted.filter((c) => promoted.some((l) => l.id === c.recruitedBy)).map((c) => c.id));
  const unassigned = nonPromoted.filter((c) => !assignedIds.has(c.id));

  const root: CrewNode = {
    id: "root",
    name: "You",
    isLeader: true,
    isPredicted: false,
    children: [
      ...leaderNodes,
      ...unassigned.map((c) => ({
        id: c.id,
        name: c.name,
        isLeader: false,
        isPredicted: false,
        children: [],
      })),
    ],
  };

  return root;
}

// Build predicted tree (8-week forecast)
function buildPredictedTree(candidates: Candidate[]): CrewNode {
  const START_FORWARD = STAGES_ORDER.slice(STAGES_ORDER.indexOf("start"));
  const now = new Date("2026-02-18");
  const eightWeeks = new Date(now);
  eightWeeks.setDate(eightWeeks.getDate() + 56);

  // Calculate historical conversion rates
  const allCandidates = candidates;
  const reached2nd = allCandidates.filter((c) => reachedStage(c, "2nd-round")).length;
  const reachedStart = allCandidates.filter((c) => reachedStage(c, "start")).length;
  const reachedPromoted = allCandidates.filter((c) => reachedStage(c, "promoted")).length;

  const interviewToStartRate = reached2nd > 0 ? reachedStart / reached2nd : 0;
  const startToPromotionRate = reachedStart > 0 ? reachedPromoted / reachedStart : 0;

  // Calculate avg days from start to promoted
  const promotedCandidates = allCandidates.filter((c) => c.stage === "promoted");
  let avgStartToPromotionDays = 60; // default
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

  // Current crew
  const currentCrew = allCandidates.filter((c) => START_FORWARD.includes(c.stage));

  // Predict who will start: candidates in pre-start stages
  const preStartStages: PipelineStage[] = ["2nd-round", "final-round", "rehash", "sunday-call"];
  const inPipeline = allCandidates.filter((c) => preStartStages.includes(c.stage) && !c.status);
  const predictedStarts: { id: string; name: string }[] = [];

  // Weight by how far along they are
  inPipeline.forEach((c) => {
    const stageIdx = STAGES_ORDER.indexOf(c.stage);
    const stepsToStart = STAGES_ORDER.indexOf("start") - stageIdx;
    // Rough: assume ~7 days per stage
    const daysToStart = stepsToStart * 7;
    if (daysToStart <= 56) {
      // Apply conversion rate based on how close they are
      const conversionChance = stageIdx >= 2 ? 0.7 : interviewToStartRate;
      if (conversionChance > 0.3) {
        predictedStarts.push({ id: `pred-start-${c.id}`, name: c.name });
      }
    }
  });

  // Predict who will be promoted: current start/bell candidates
  const startBellCandidates = currentCrew.filter((c) => c.stage === "start" || c.stage === "bell");
  const predictedPromotions: string[] = [];

  startBellCandidates.forEach((c) => {
    const startDate = stageEntryDate(c, "start");
    if (startDate) {
      const daysSinceStart = (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
      const daysRemaining = avgStartToPromotionDays - daysSinceStart;
      if (daysRemaining <= 56 && daysRemaining > 0 && startToPromotionRate > 0.15) {
        predictedPromotions.push(c.id);
      }
    }
  });

  // Build the predicted tree
  const promoted = allCandidates.filter((c) => c.stage === "promoted");
  const nonPromoted = currentCrew.filter((c) => c.stage !== "promoted");

  // Create leader nodes (current promoted + predicted promotions)
  const allLeaderIds = new Set([...promoted.map((c) => c.id), ...predictedPromotions]);

  const leaderNodes: CrewNode[] = [];

  // Current promoted leaders
  promoted.forEach((leader) => {
    const recruits = nonPromoted.filter((c) => c.recruitedBy === leader.id && !predictedPromotions.includes(c.id));
    const predictedRecruitNodes: CrewNode[] = [];
    // Predicted promotions that were under this leader become sub-leaders
    const subLeaders = nonPromoted.filter((c) => c.recruitedBy === leader.id && predictedPromotions.includes(c.id));

    leaderNodes.push({
      id: leader.id,
      name: leader.name,
      isLeader: true,
      isPredicted: false,
      children: [
        ...recruits.map((r) => ({
          id: r.id,
          name: r.name,
          isLeader: false,
          isPredicted: false,
          children: [],
        })),
        ...subLeaders.map((sl) => ({
          id: sl.id,
          name: sl.name,
          isLeader: true,
          isPredicted: true,
          children: [],
        })),
      ],
    });
  });

  // Newly predicted promotions not under any leader
  const predictedPromotionsUnassigned = predictedPromotions.filter(
    (id) => !nonPromoted.find((c) => c.id === id)?.recruitedBy || !promoted.some((l) => l.id === nonPromoted.find((c) => c.id === id)?.recruitedBy)
  );

  predictedPromotionsUnassigned.forEach((id) => {
    const c = allCandidates.find((cc) => cc.id === id);
    if (c) {
      leaderNodes.push({
        id: c.id,
        name: c.name,
        isLeader: true,
        isPredicted: true,
        children: [],
      });
    }
  });

  // Unassigned non-promoted
  const assignedIds = new Set([
    ...nonPromoted.filter((c) => promoted.some((l) => l.id === c.recruitedBy)).map((c) => c.id),
    ...predictedPromotions,
  ]);
  const unassigned = nonPromoted.filter((c) => !assignedIds.has(c.id));

  // Add predicted starts
  const predictedStartNodes: CrewNode[] = predictedStarts.map((ps) => ({
    id: ps.id,
    name: `${ps.name} (Predicted)`,
    isLeader: false,
    isPredicted: true,
    children: [],
  }));

  return {
    id: "root",
    name: "You",
    isLeader: true,
    isPredicted: false,
    children: [
      ...leaderNodes,
      ...unassigned.map((c) => ({
        id: c.id,
        name: c.name,
        isLeader: false,
        isPredicted: false,
        children: [],
      })),
      ...predictedStartNodes,
    ],
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

  // Calculate children positions
  const childMeasures = node.children.map((child) => measureTree(child));
  const totalLeaves = childMeasures.reduce((sum, m) => sum + m.leafCount, 0);
  const totalChildWidth = totalLeaves * nodeSpacing;

  let currentX = x - totalChildWidth / 2;

  return (
    <g>
      {/* Connection line from parent */}
      {parentX !== undefined && parentY !== undefined && (
        <path
          d={`M ${parentX} ${parentY + nodeHeight / 2} L ${parentX} ${parentY + nodeHeight / 2 + levelHeight * 0.4} L ${x} ${y - levelHeight * 0.1} L ${x} ${y - nodeHeight / 2}`}
          fill="none"
          stroke="hsl(222 30% 20%)"
          strokeWidth="1.5"
          strokeDasharray={node.isPredicted ? "4 4" : "none"}
        />
      )}

      {/* Node: Leader = outline bubble, BA = plain text */}
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

      {/* Children */}
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

  // Compute historical Start → Promotion %
  const startToPromotionPct = useMemo(() => {
    const reachedStart = candidates.filter((c) => reachedStage(c, "start")).length;
    const reachedPromoted = candidates.filter((c) => reachedStage(c, "promoted")).length;
    if (reachedStart === 0) return 0;
    return Math.round((reachedPromoted / reachedStart) * 100);
  }, [candidates]);

  const currentTree = useMemo(() => buildCrewTree(candidates), [candidates]);
  const predictedTree = useMemo(() => buildPredictedTree(candidates), [candidates]);

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