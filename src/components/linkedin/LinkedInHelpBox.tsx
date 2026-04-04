import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkedInHelpBoxProps {
  children: React.ReactNode;
}

export function LinkedInHelpBox({ children }: LinkedInHelpBoxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          How to Use
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
