import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CONTACT_TYPES = ["Door", "Event", "Friend", "Referral", "Other"] as const;

interface PersonalActivity {
  id: string;
  activity_date: string;
  contact_type: string;
  people_spoken_to: number;
  invited_to_ob: number;
  attended_ob: number;
}

export function PersonalActivityLogger() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<PersonalActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [date, setDate] = useState<Date>(new Date());
  const [contactType, setContactType] = useState("");
  const [spokenTo, setSpokenTo] = useState("0");
  const [invitedOB, setInvitedOB] = useState("0");
  const [attendedOB, setAttendedOB] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("personal_recruitment_activity" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false });
    setActivities((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const handleSubmit = async () => {
    if (!user || !contactType) return;
    setSubmitting(true);
    const { error } = await supabase.from("personal_recruitment_activity" as any).insert({
      user_id: user.id,
      activity_date: format(date, "yyyy-MM-dd"),
      contact_type: contactType,
      people_spoken_to: parseInt(spokenTo) || 0,
      invited_to_ob: parseInt(invitedOB) || 0,
      attended_ob: parseInt(attendedOB) || 0,
    } as any);
    if (error) {
      toast.error("Failed to log activity");
    } else {
      toast.success("Personal activity logged");
      setContactType("");
      setSpokenTo("0");
      setInvitedOB("0");
      setAttendedOB("0");
      setDate(new Date());
      await fetchActivities();
    }
    setSubmitting(false);
  };

  // Lifetime totals
  const totals = activities.reduce(
    (acc, a) => ({
      spoken: acc.spoken + a.people_spoken_to,
      invited: acc.invited + a.invited_to_ob,
      attended: acc.attended + a.attended_ob,
    }),
    { spoken: 0, invited: 0, attended: 0 }
  );

  return (
    <div className="glass-panel p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary" />
        Personal Recruitment Activity
      </h3>

      {/* Lifetime totals */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "People Spoken To", value: totals.spoken },
          { label: "Invited to OB", value: totals.invited },
          { label: "Attended OB", value: totals.attended },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-bold font-mono text-foreground">{value}</p>
            <p className="text-[9px] text-muted-foreground">Lifetime</p>
          </div>
        ))}
      </div>

      {/* Log form */}
      <div className="bg-muted/20 rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal h-9", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {date ? format(date, "PP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Contact Type</Label>
            <Select value={contactType} onValueChange={setContactType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">People Spoken To</Label>
            <Input type="number" min="0" value={spokenTo} onChange={(e) => setSpokenTo(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Invited To OB</Label>
            <Input type="number" min="0" value={invitedOB} onChange={(e) => setInvitedOB(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Attended OB</Label>
            <Input type="number" min="0" value={attendedOB} onChange={(e) => setAttendedOB(e.target.value)} className="h-9 text-xs" />
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={!contactType || submitting} size="sm" className="w-full">
          {submitting ? "Logging..." : "Log Activity"}
        </Button>
      </div>

      {/* Past entries table */}
      {activities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Type</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Spoken</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Invited</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Attended</th>
              </tr>
            </thead>
            <tbody>
              {activities.slice(0, 20).map((a) => (
                <tr key={a.id} className="border-b border-border/10">
                  <td className="py-1.5 text-foreground">{a.activity_date}</td>
                  <td className="py-1.5 text-foreground">{a.contact_type}</td>
                  <td className="py-1.5 text-right font-mono text-foreground">{a.people_spoken_to}</td>
                  <td className="py-1.5 text-right font-mono text-foreground">{a.invited_to_ob}</td>
                  <td className="py-1.5 text-right font-mono text-foreground">{a.attended_ob}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
