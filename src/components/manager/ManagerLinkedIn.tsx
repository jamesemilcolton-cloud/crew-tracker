import { Linkedin } from "lucide-react";
import { LinkedInPerformanceIntelligence } from "./LinkedInPerformanceIntelligence";

export function ManagerLinkedIn() {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Linkedin className="w-4 h-4" style={{ color: "hsl(210 70% 50%)" }} /> LinkedIn Performance Intelligence
      </h2>
      <LinkedInPerformanceIntelligence />
    </div>
  );
}
