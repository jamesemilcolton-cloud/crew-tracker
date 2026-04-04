import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Send, MessageSquareReply, PhoneCall, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ActivityLogEntry {
  type: "sent" | "reply" | "interview";
  label: string;
}

interface OutreachData {
  id?: string;
  sent: number;
  replies: number;
  interviews: number;
  activity_log: ActivityLogEntry[];
}

const TARGETS = { sent: 25, replies: 10, interviews: 4 };

export function LinkedInOutreach() {
  const [date, setDate] = useState<Date>(new Date());
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: outreach, isLoading } = useQuery({
    queryKey: ["linkedin-outreach", user?.id, dateStr],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("linkedin_outreach")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_date", dateStr)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        sent: data.sent,
        replies: data.replies,
        interviews: data.interviews,
        activity_log: (data.activity_log as unknown as ActivityLogEntry[]) ?? [],
      };
    },
    enabled: !!user?.id,
  });

  const current: OutreachData = useMemo(() => ({
    sent: outreach?.sent ?? 0,
    replies: outreach?.replies ?? 0,
    interviews: outreach?.interviews ?? 0,
    activity_log: (outreach?.activity_log as ActivityLogEntry[] | null) ?? [],
  }), [outreach]);

  const mutation = useMutation({
    mutationFn: async (update: Partial<OutreachData>) => {
      if (!user?.id) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        activity_date: dateStr,
        sent: update.sent ?? current.sent,
        replies: update.replies ?? current.replies,
        interviews: update.interviews ?? current.interviews,
        activity_log: JSON.parse(JSON.stringify(update.activity_log ?? current.activity_log)),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("linkedin_outreach")
        .upsert(payload as any, { onConflict: "user_id,activity_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin-outreach", user?.id, dateStr] });
    },
    onError: () => toast.error("Failed to save"),
  });

  const increment = useCallback((type: "sent" | "reply" | "interview") => {
    const labels = { sent: "+1 Sent", reply: "+1 Reply", interview: "+1 Interview" };
    const fieldMap = { sent: "sent", reply: "replies", interview: "interviews" } as const;
    const field = fieldMap[type];
    const newLog: ActivityLogEntry = { type, label: labels[type] };
    mutation.mutate({
      [field]: current[field] + 1,
      activity_log: [...current.activity_log, newLog],
    });
  }, [current, mutation]);

  const replyRate = current.sent > 0 ? Math.round((current.replies / current.sent) * 100) : 0;
  const interviewRate = current.sent > 0 ? Math.round((current.interviews / current.sent) * 100) : 0;

  const cards = [
    { key: "sent" as const, label: "Sent", sub: "Messages sent today", value: current.sent, target: TARGETS.sent, color: "210 70% 50%", icon: Send, incrementType: "sent" as const },
    { key: "replies" as const, label: "Replies", sub: "People who replied", value: current.replies, target: TARGETS.replies, color: "45 90% 55%", icon: MessageSquareReply, incrementType: "reply" as const },
    { key: "interviews" as const, label: "Interviews", sub: "Calls booked", value: current.interviews, target: TARGETS.interviews, color: "142 60% 45%", icon: PhoneCall, incrementType: "interview" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header with date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">LinkedIn Outreach</h2>
          <p className="text-sm text-muted-foreground">Track your daily outreach activity</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-fit">
              <CalendarIcon className="w-4 h-4" />
              {format(date, "EEE, MMM d yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Target bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg border border-border/50 bg-card/30">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Daily Target</span>
        <div className="flex items-center gap-4 text-xs">
          <span className="font-semibold" style={{ color: `hsl(210 70% 50%)` }}>{TARGETS.sent} Sent</span>
          <span className="text-muted-foreground">|</span>
          <span className="font-semibold" style={{ color: `hsl(45 90% 55%)` }}>{TARGETS.replies} Replies</span>
          <span className="text-muted-foreground">|</span>
          <span className="font-semibold" style={{ color: `hsl(142 60% 45%)` }}>{TARGETS.interviews} Interviews</span>
        </div>
      </div>

      {/* Tracker cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const pct = card.target > 0 ? Math.min((card.value / card.target) * 100, 100) : 0;
          return (
            <Card key={card.key} className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
              <div className="absolute top-0 left-0 right-0 h-1 bg-muted/30">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: `hsl(${card.color})` }}
                />
              </div>
              <CardContent className="pt-6 pb-4 px-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `hsl(${card.color} / 0.15)` }}>
                    <card.icon className="w-5 h-5" style={{ color: `hsl(${card.color})` }} />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => increment(card.incrementType)}
                    disabled={mutation.isPending}
                    className="text-xs font-bold h-9 px-4 rounded-lg border-0"
                    style={{ background: `hsl(${card.color})`, color: "#fff" }}
                  >
                    +1
                  </Button>
                </div>
                <div className="text-4xl font-bold tracking-tight text-foreground">{card.value}</div>
                <div className="text-sm font-semibold mt-1" style={{ color: `hsl(${card.color})` }}>{card.label}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                <div className="text-[10px] text-muted-foreground mt-2">{card.value}/{card.target} target</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Conversion rates */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Reply Rate", value: replyRate },
          { label: "Interview Rate", value: interviewRate },
        ].map((rate) => (
          <Card key={rate.label} className="border-border/50 bg-card/60">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{rate.label}</p>
                <p className="text-2xl font-bold text-foreground">{rate.value}%</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/30">
                {rate.value > 30 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : rate.value > 0 ? (
                  <Minus className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity log */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="py-4 px-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Activity Log — {format(date, "EEEE, MMM d")}</h3>
          {current.activity_log.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No activity yet. Start tracking with the +1 buttons above.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {[...current.activity_log].reverse().map((entry, i) => {
                const colorMap: Record<string, string> = { sent: "210 70% 50%", reply: "45 90% 55%", interview: "142 60% 45%" };
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/20 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${colorMap[entry.type]})` }} />
                    <span className="text-xs text-foreground">{entry.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
