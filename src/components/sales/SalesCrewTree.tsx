import { useMemo, useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getDescendantProfileIds,
  buildRecursiveTree,
  CrewNode,
} from "@/components/crew/CrewBubbleForecast";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
  crew_name: string;
}

interface CandidateRow {
  id: string;
  name: string;
  stage: string;
  recruited_by: string | null;
  archived_at: string | null;
  
  notes: string;
  source: string;
  status: string | null;
  potential_start_date: string | null;
  has_sales_pitch_access: boolean;
  has_evo_app_access: boolean;
}

/** Map pipeline stage to a display role label */
function getRoleLabel(stage: string): string {
  switch (stage) {
    case "start":
      return "Brand Ambassador";
    case "solo":
      return "First Solo Sale";
    case "promoted":
      return "Leader";
    default:
      return "";
  }
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 44;
const NODE_GAP = 14;

function SalesTreeNode({
  node,
  salesMap,
  profileUserMap,
  candidateStageMap,
}: {
  node: CrewNode;
  salesMap: Map<string, number>;
  profileUserMap: Map<string, string>;
  candidateStageMap: Map<string, string>;
}) {
  const hasChildren = node.children.length > 0;
  const userId = profileUserMap.get(node.id);
  const weeklySales = userId ? salesMap.get(userId) ?? 0 : 0;

  // Determine role label: leaders get "Leader", others use candidate stage
  let roleLabel = "";
  if (node.isLeader) {
    roleLabel = "Leader";
  } else {
    const stage = candidateStageMap.get(node.id);
    if (stage) roleLabel = getRoleLabel(stage);
  }

  return (
    <div className="flex flex-col items-center" style={{ minWidth: NODE_WIDTH }}>
      {/* Node */}
      <div
        className="relative flex flex-col items-center justify-center select-none"
        style={{
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
          borderRadius: node.isLeader ? 16 : 8,
          border: node.isLeader
            ? "1.5px solid hsl(var(--module-sales))"
            : "1px solid hsl(var(--border) / 0.5)",
          background: node.isLeader
            ? "hsl(var(--module-sales) / 0.08)"
            : "hsl(var(--muted) / 0.15)",
        }}
      >
        {/* Weekly sales - top right */}
        <span
          className="absolute text-[10px] font-mono font-medium"
          style={{
            top: 3,
            right: 6,
            color:
              weeklySales > 0
                ? "hsl(var(--module-sales))"
                : "hsl(var(--muted-foreground))",
          }}
        >
          {weeklySales} Sale{weeklySales !== 1 ? "s" : ""}
        </span>

        {/* Name */}
        <span
          className="truncate px-2 mt-1"
          style={{
            fontSize: 12,
            fontWeight: node.isLeader ? 600 : 400,
            color: "hsl(var(--foreground))",
            maxWidth: NODE_WIDTH - 8,
          }}
        >
          {node.name}
        </span>

        {/* Role label */}
        {roleLabel && (
          <span
            className="text-[9px] px-2 truncate"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {roleLabel}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          <div
            style={{
              width: 1.5,
              height: 18,
              background: "hsl(var(--border))",
            }}
          />
          {node.children.length > 1 && (
            <div
              style={{
                height: 1.5,
                background: "hsl(var(--border))",
                width: `${(Math.min(node.children.length, 8) - 1) * (NODE_WIDTH + NODE_GAP)}px`,
                maxWidth: "90vw",
              }}
            />
          )}
          <div
            className="flex flex-wrap items-start justify-center"
            style={{ gap: NODE_GAP, maxWidth: "90vw" }}
          >
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div
                  style={{
                    width: 1.5,
                    height: 14,
                    background: "hsl(var(--border))",
                  }}
                />
                <SalesTreeNode
                  node={child}
                  salesMap={salesMap}
                  profileUserMap={profileUserMap}
                  candidateStageMap={candidateStageMap}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function countNodes(node: CrewNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

interface SalesCrewTreeProps {
  teamEntries: { user_id: string; sales: number }[];
  weekLabel: string;
  isCurrentWeek: boolean;
}

export default function SalesCrewTree({
  teamEntries,
  weekLabel,
  isCurrentWeek,
}: SalesCrewTreeProps) {
  const { profile, userRole } = useAuth();
  const { profiles: sharedProfiles } = useProfiles();
  const allProfiles = sharedProfiles as Profile[];
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);

  // Fetch all candidates for hierarchy building
  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("candidates")
        .select("id, name, stage, recruited_by, archived_at, notes, source, status, potential_start_date, has_sales_pitch_access, has_evo_app_access")
        .is("archived_at", null);
      if (data) setCandidates(data);
    }
    fetch();
  }, []);

  // Build sales map from teamEntries for the selected week
  const salesMap = useMemo(() => {
    const map = new Map<string, number>();
    teamEntries.forEach((e) => {
      map.set(e.user_id, (map.get(e.user_id) || 0) + e.sales);
    });
    return map;
  }, [teamEntries]);

  // Map profile id -> user_id
  const profileUserMap = useMemo(() => {
    const m = new Map<string, string>();
    allProfiles.forEach((p) => m.set(p.id, p.user_id));
    return m;
  }, [allProfiles]);

  // Map candidate id -> stage (for role labels)
  const candidateStageMap = useMemo(() => {
    const m = new Map<string, string>();
    candidates.forEach((c) => m.set(c.id, c.stage));
    return m;
  }, [candidates]);

  // Convert candidates to format expected by buildRecursiveTree
  const candidatesForTree = useMemo(() => {
    return candidates.map((c) => ({
      id: c.id,
      candidateId: (c as any).candidate_id || "",
      name: c.name,
      phone: "",
      notes: c.notes,
      source: c.source as any,
      stage: c.stage as any,
      status: c.status as any,
      potentialStartDate: c.potential_start_date ?? undefined,
      hasSalesPitchAccess: c.has_sales_pitch_access,
      hasEvoAppAccess: c.has_evo_app_access,
      history: [],
      createdAt: "",
      recruitedBy: c.recruited_by ?? undefined,
      archivedAt: c.archived_at,
    }));
  }, [candidates]);

  // Filter to subtree
  const subtreeCandidates = useMemo(() => {
    if (!profile || allProfiles.length === 0) return candidatesForTree;
    const subtreeIds = getDescendantProfileIds(profile.id, allProfiles);
    return candidatesForTree.filter(
      (c) => c.recruitedBy && subtreeIds.has(c.recruitedBy)
    );
  }, [candidatesForTree, allProfiles, profile]);

  // Build tree using same function as Crew Bubble
  const tree = useMemo(() => {
    if (!profile || allProfiles.length === 0) {
      return {
        id: "root",
        name: "You",
        isLeader: true,
        isPredicted: false,
        children: [],
      } as CrewNode;
    }
    return buildRecursiveTree(
      profile.id,
      profile.full_name,
      allProfiles,
      subtreeCandidates
    );
  }, [subtreeCandidates, allProfiles, profile]);

  const totalNodes = countNodes(tree);

  if (totalNodes <= 1) {
    return (
      <div className="glass-panel p-4 text-center">
        <p className="text-xs text-muted-foreground">
          No crew members yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[hsl(var(--module-sales))]" />
            <h3 className="text-sm font-medium text-foreground">
              Crew Structure
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {totalNodes} members •{" "}
            {isCurrentWeek ? "This Week" : weekLabel}
          </span>
        </div>
      </div>

      <div
        className="glass-panel overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: "calc(100vh - 340px)", minHeight: 200 }}
      >
        <div className="p-6 flex justify-center">
          <SalesTreeNode
            node={tree}
            salesMap={salesMap}
            profileUserMap={profileUserMap}
            candidateStageMap={candidateStageMap}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded border-[1.5px] border-[hsl(var(--module-sales))] bg-[hsl(var(--module-sales)/0.08)]" />
          <span>Leader</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded border border-border/50 bg-muted/15" />
          <span>Brand Ambassador</span>
        </div>
      </div>
    </div>
  );
}
