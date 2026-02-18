import { useState, useRef, useCallback, useEffect } from "react";
import { CrewMember } from "@/lib/types";
import { mockCrewTree, mockPredictedCrewTree } from "@/lib/mock-data";
import { Users, Eye, GitBranch } from "lucide-react";

function TreeNode({ member, x, y, parentX, parentY }: { member: CrewMember; x: number; y: number; parentX?: number; parentY?: number }) {
  const isLeader = member.role === "leader";
  const nodeWidth = 140;
  const nodeHeight = 40;
  const childSpacing = 160;
  const levelHeight = 100;

  const totalWidth = Math.max(member.children.length * childSpacing, nodeWidth);

  return (
    <g>
      {/* Connection line from parent */}
      {parentX !== undefined && parentY !== undefined && (
        <path
          d={`M ${parentX} ${parentY + 20} C ${parentX} ${parentY + 50}, ${x} ${y - 30}, ${x} ${y}`}
          fill="none"
          stroke="hsl(222 30% 20%)"
          strokeWidth="2"
          strokeDasharray={member.id.includes("pred") ? "4 4" : "none"}
        />
      )}

      {/* Node */}
      {isLeader ? (
        <g>
          <rect
            x={x - nodeWidth / 2}
            y={y - nodeHeight / 2}
            width={nodeWidth}
            height={nodeHeight}
            rx="12"
            fill="none"
            stroke="hsl(172 66% 50%)"
            strokeWidth="2"
            strokeDasharray={member.id.includes("pred") ? "4 4" : "none"}
          />
          <rect
            x={x - nodeWidth / 2}
            y={y - nodeHeight / 2}
            width={nodeWidth}
            height={nodeHeight}
            rx="12"
            fill="hsl(172 66% 50% / 0.08)"
          />
        </g>
      ) : null}

      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={member.id.includes("pred") ? "hsl(215 20% 45%)" : "hsl(210 40% 92%)"}
        fontSize="12"
        fontWeight={isLeader ? "600" : "400"}
        fontFamily="Inter, system-ui, sans-serif"
        textDecoration={member.closeToPromotion ? "underline" : "none"}
        style={{ textDecorationColor: "hsl(45 93% 47%)", textUnderlineOffset: "3px" }}
      >
        {member.name}
      </text>

      {member.closeToPromotion && (
        <circle cx={x + nodeWidth / 2 - 8} cy={y - nodeHeight / 2 + 8} r="4" fill="hsl(45 93% 47%)" />
      )}

      {/* Children */}
      {member.children.map((child, i) => {
        const childX = x - ((member.children.length - 1) * childSpacing) / 2 + i * childSpacing;
        const childY = y + levelHeight;
        return <TreeNode key={child.id} member={child} x={childX} y={childY} parentX={x} parentY={y} />;
      })}
    </g>
  );
}

interface CrewBubbleForecastProps {
  startEmpty?: boolean;
}

const emptyTree: CrewMember = { id: "empty", name: "No Data", role: "leader", closeToPromotion: false, children: [] };

export function CrewBubbleForecast({ startEmpty = false }: CrewBubbleForecastProps) {
  const [showPredicted, setShowPredicted] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const tree = startEmpty ? emptyTree : (showPredicted ? mockPredictedCrewTree : mockCrewTree);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * delta, 0.3), 3),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Conversion rates for forecast info
  const interviewToStart = 42;
  const startToPromotion = 28;

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
                Predicted Team
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Interview → Start: <span className="text-foreground font-mono">{interviewToStart}%</span></span>
            <span>Start → Promotion: <span className="text-foreground font-mono">{startToPromotion}%</span></span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded border-2 border-primary bg-primary/10" />
          <span>Leader</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-foreground">Name</span>
          <span>Brand Ambassador</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="underline text-foreground" style={{ textDecorationColor: "hsl(45 93% 47%)" }}>Name</span>
          <span>Close to Promotion</span>
        </div>
        {showPredicted && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-dashed border-muted-foreground" />
            <span>Predicted</span>
          </div>
        )}
      </div>

      {/* Tree canvas */}
      <div
        className="glass-panel overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: "calc(100vh - 300px)" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg ref={svgRef} width="100%" height="100%" className="select-none">
          <g transform={`translate(${transform.x + 500}, ${transform.y + 60}) scale(${transform.scale})`}>
            <TreeNode member={tree} x={0} y={0} />
          </g>
        </svg>
      </div>
    </div>
  );
}
