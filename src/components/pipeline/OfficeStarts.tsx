import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ThumbsUp, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StarterCandidate {
  id: string;
  name: string;
  notes: string;
  source: string;
  potentialStartDate: string;
  candidateId: string;
  recruitedByName?: string;
}

interface ReadMark {
  candidate_id: string;
  user_id: string;
  reader_name: string;
}

/**
 * Returns the Saturday before the Monday of the week containing startDate.
 * A candidate appears on the Saturday before their start week.
 */
function getAppearDate(startDateStr: string): Date {
  const d = new Date(startDateStr + "T00:00:00");
  // Find Monday of start week
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  // Saturday before = monday - 2
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() - 2);
  saturday.setHours(0, 0, 0, 0);
  return saturday;
}

const SOURCE_STYLES: Record<string, { border: string; badge: string }> = {
  Office: { border: "border-l-purple-500", badge: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  LinkedIn: { border: "border-l-blue-500", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  "LinkedIn Ads": { border: "border-l-blue-500", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  Personal: { border: "border-l-yellow-500", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  "LinkedIn Messages": { border: "border-l-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const DEFAULT_STYLE = { border: "border-l-muted", badge: "bg-muted text-muted-foreground border-border" };

export function OfficeStarts() {
  const { user, profile } = useAuth();
  const [starters, setStarters] = useState<StarterCandidate[]>([]);
  const [readMarks, setReadMarks] = useState<ReadMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch all candidates with a start date that haven't passed yet
      // and are in a valid pre-start or start-adjacent stage
      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("id, name, notes, source, potential_start_date, candidate_id, recruited_by, stage, drop_off_reason")
        .not("potential_start_date", "is", null)
        .is("drop_off_reason", null)
        .in("stage", ["contact_before_start", "attended_induction", "rehash", "final", "job_offered", "start"]);

      if (error) throw error;

      const todayStr = today.toISOString().slice(0, 10);

      const filtered = (candidates || []).filter((c) => {
        if (!c.potential_start_date) return false;
        // Start date must not have passed
        if (c.potential_start_date < todayStr) return false;
        // Must have appeared (today >= appear date)
        const appearDate = getAppearDate(c.potential_start_date);
        return today >= appearDate;
      });

      // Get recruiter names
      const recruiterIds = [...new Set(filtered.map(c => c.recruited_by).filter(Boolean))];
      let recruiterMap: Record<string, string> = {};
      if (recruiterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", recruiterIds);
        if (profiles) {
          recruiterMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
        }
      }

      setStarters(
        filtered.map((c) => ({
          id: c.id,
          name: c.name,
          notes: c.notes || "",
          source: c.source,
          potentialStartDate: c.potential_start_date!,
          candidateId: c.candidate_id,
          recruitedByName: c.recruited_by ? recruiterMap[c.recruited_by] : undefined,
        }))
        .sort((a, b) => a.potentialStartDate.localeCompare(b.potentialStartDate))
      );

      // Fetch read marks for these candidates
      const candidateIds = filtered.map(c => c.id);
      if (candidateIds.length > 0) {
        const { data: reads } = await supabase
          .from("office_starts_read")
          .select("candidate_id, user_id, reader_name")
          .in("candidate_id", candidateIds);
        setReadMarks(reads || []);
      } else {
        setReadMarks([]);
      }
    } catch (err) {
      console.error("Failed to load office starts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkAsRead = async (candidateId: string) => {
    if (!user || !profile || marking) return;

    // Check if already marked
    const alreadyMarked = readMarks.some(
      (r) => r.candidate_id === candidateId && r.user_id === user.id
    );
    if (alreadyMarked) return;

    setMarking(candidateId);
    try {
      const { error } = await supabase.from("office_starts_read").insert({
        candidate_id: candidateId,
        user_id: user.id,
        profile_id: profile.id,
        reader_name: profile.full_name || profile.first_name || "Unknown",
      } as any);

      if (error) {
        if (error.code === "23505") {
          // Already exists, just refresh
        } else {
          throw error;
        }
      }

      setReadMarks((prev) => [
        ...prev,
        {
          candidate_id: candidateId,
          user_id: user.id,
          reader_name: profile.full_name || profile.first_name || "Unknown",
        },
      ]);
      toast.success("Marked as read");
    } catch (err) {
      toast.error("Failed to mark as read");
    } finally {
      setMarking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (starters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Calendar className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-medium">No upcoming starters</p>
        <p className="text-xs mt-1">Candidates will appear here from the Saturday before their start week</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Upcoming Starters</h2>
        <Badge variant="secondary" className="text-xs">{starters.length}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {starters.map((candidate) => {
          const style = SOURCE_STYLES[candidate.source] || DEFAULT_STYLE;
          const candidateReads = readMarks.filter((r) => r.candidate_id === candidate.id);
          const userHasRead = candidateReads.some((r) => r.user_id === user?.id);

          return (
            <Card
              key={candidate.id}
              className={cn(
                "border-l-[3px] transition-all",
                style.border,
                userHasRead && "opacity-80"
              )}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm text-foreground truncate">{candidate.name}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">{candidate.candidateId}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 flex-shrink-0", style.badge)}>
                    {candidate.source === "Office" ? "The Office" : candidate.source}
                  </Badge>
                </div>

                {/* Start Date */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Starts{" "}
                    {new Date(candidate.potentialStartDate).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>

                {/* Recruiter */}
                {candidate.recruitedByName && (
                  <p className="text-[11px] text-muted-foreground">
                    Recruited by <span className="text-foreground font-medium">{candidate.recruitedByName}</span>
                  </p>
                )}

                {/* Notes */}
                <div className="bg-muted/30 rounded-md p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Notes</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {candidate.notes || "No notes recorded"}
                  </p>
                </div>

                {/* Read marks */}
                {candidateReads.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {candidateReads.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full"
                      >
                        <ThumbsUp className="w-2.5 h-2.5" />
                        {r.reader_name.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                )}

                {/* Mark as read button */}
                {!userHasRead && (
                  <button
                    onClick={() => handleMarkAsRead(candidate.id)}
                    disabled={marking === candidate.id}
                    className={cn(
                      "flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-xs font-medium transition-colors",
                      "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {marking === candidate.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Mark as Read
                      </>
                    )}
                  </button>
                )}

                {userHasRead && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 py-1">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>You've reviewed this</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
