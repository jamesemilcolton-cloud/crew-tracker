import { CrewNode } from "./CrewBubbleForecast";

const NODE_W = 150;
const NODE_H = 48;
const H_GAP = 16;
const V_GAP = 40;
const LINE_COLOR = "hsl(var(--border))";

interface CrewTreeProps {
  tree: CrewNode;
  /** When true, display weekly sales on each node */
  showSales?: boolean;
  /** Map from profile/candidate id → user_id (for sales lookup) */
  profileUserMap?: Map<string, string>;
  /** Map from user_id → weekly sales count */
  salesMap?: Map<string, number>;
  /** Map from candidate id → stage string (for role labels) */
  candidateStageMap?: Map<string, string>;
}

function getRoleLabel(stage: string): string {
  switch (stage) {
    case "start": return "Brand Ambassador";
    case "solo": return "Solo";
    case "promoted": return "Leader";
    default: return "";
  }
}

function TreeNode({
  node,
  showSales,
  profileUserMap,
  salesMap,
  candidateStageMap,
}: {
  node: CrewNode;
  showSales?: boolean;
  profileUserMap?: Map<string, string>;
  salesMap?: Map<string, number>;
  candidateStageMap?: Map<string, string>;
}) {
  const hasChildren = node.children.length > 0;

  // Determine role label
  let roleLabel = "";
  if (node.isLeader) {
    roleLabel = "Leader";
  } else {
    const stage = candidateStageMap?.get(node.id);
    if (stage) roleLabel = getRoleLabel(stage);
  }

  // Weekly sales
  let weeklySales = 0;
  if (showSales && profileUserMap && salesMap) {
    const userId = profileUserMap.get(node.id);
    if (userId) weeklySales = salesMap.get(userId) ?? 0;
  }

  return (
    <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
      {/* Node */}
      <div
        className="flex flex-col items-center justify-center select-none"
        style={{
          width: NODE_W,
          height: NODE_H,
          borderRadius: node.isLeader ? 14 : 8,
          border: node.isLeader
            ? `1.5px ${node.isPredicted ? "dashed" : "solid"} hsl(var(--primary))`
            : "1px solid hsl(var(--border) / 0.5)",
          background: node.isLeader
            ? node.isPredicted
              ? "hsl(var(--primary) / 0.03)"
              : "hsl(var(--primary) / 0.08)"
            : "hsl(var(--muted) / 0.15)",
          opacity: node.isPredicted ? 0.55 : 1,
          flexShrink: 0,
        }}
      >
        <span
          className="truncate px-2 leading-tight"
          style={{
            fontSize: 12,
            fontWeight: node.isLeader ? 600 : 400,
            fontStyle: node.isPredicted ? "italic" : "normal",
            color: node.isPredicted
              ? "hsl(var(--muted-foreground))"
              : "hsl(var(--foreground))",
            maxWidth: NODE_W - 12,
          }}
        >
          {node.name}
        </span>
        {(roleLabel || showSales) && (
          <span
            className="text-[9px] truncate px-2 leading-tight"
            style={{ color: "hsl(var(--muted-foreground))", maxWidth: NODE_W - 12 }}
          >
            {showSales
              ? roleLabel
                ? `${roleLabel} — ${weeklySales} Sale${weeklySales !== 1 ? "s" : ""}`
                : `${weeklySales} Sale${weeklySales !== 1 ? "s" : ""}`
              : roleLabel}
          </span>
        )}
      </div>

      {/* Children with connectors */}
      {hasChildren && (
        <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
          {/* Vertical line down from parent */}
          <div
            style={{
              width: 1.5,
              height: V_GAP / 2,
              background: LINE_COLOR,
            }}
          />

          {/* Horizontal branch line spanning all children */}
          {node.children.length > 1 && (
            <div className="relative w-full flex justify-center">
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  height: 1.5,
                  background: LINE_COLOR,
                  /* The bar spans from the center of the first child to the center of the last child */
                  width: `calc(100% - ${NODE_W}px)`,
                }}
              />
            </div>
          )}

          {/* Children row */}
          <div
            className="flex items-start justify-center"
            style={{ gap: H_GAP, flexShrink: 0 }}
          >
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center" style={{ flexShrink: 0 }}>
                {/* Vertical line into child */}
                <div
                  style={{
                    width: child.isPredicted ? 0 : 1.5,
                    height: V_GAP / 2,
                    background: child.isPredicted ? "transparent" : LINE_COLOR,
                    borderLeft: child.isPredicted
                      ? `1.5px dashed ${LINE_COLOR}`
                      : undefined,
                  }}
                />
                <TreeNode
                  node={child}
                  showSales={showSales}
                  profileUserMap={profileUserMap}
                  salesMap={salesMap}
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

export function CrewTree({
  tree,
  showSales,
  profileUserMap,
  salesMap,
  candidateStageMap,
}: CrewTreeProps) {
  return (
    <div
      className="overflow-y-auto overflow-x-hidden"
      style={{ maxHeight: "calc(100vh - 340px)", minHeight: 200 }}
    >
      <div className="flex justify-center py-6 px-4">
        <TreeNode
          node={tree}
          showSales={showSales}
          profileUserMap={profileUserMap}
          salesMap={salesMap}
          candidateStageMap={candidateStageMap}
        />
      </div>
    </div>
  );
}
