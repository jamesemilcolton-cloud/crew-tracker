import { useState, useCallback, useMemo } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, eachDayOfInterval, isAfter } from "date-fns";
import { CalendarIcon, Send, MessageSquareReply, PhoneCall, TrendingUp, TrendingDown, Minus, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { LinkedInHelpBox } from "./LinkedInHelpBox";

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

type WeeklyFilter = "this_week" | "last_week" | "last_4" | "last_8" | "last_12" | "all_time";

const FILTER_OPTIONS: { value: WeeklyFilter; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "last_4", label: "Last 4 Weeks" },
  { value: "last_8", label: "Last 8 Weeks" },
  { value: "last_12", label: "Last 12 Weeks" },
  { value: "all_time", label: "All Time" },
];

function getFilterRange(filter: WeeklyFilter): { start: Date; end: Date } {
  const now = new Date();
  const thisMonday = startOfWeek(now, { weekStartsOn: 1 });

  switch (filter) {
    case "this_week":
      return { start: thisMonday, end: now };
    case "last_week": {
      const prevMonday = subWeeks(thisMonday, 1);
      const prevSunday = endOfWeek(prevMonday, { weekStartsOn: 1 });
      return { start: prevMonday, end: prevSunday };
    }
    case "last_4":
    case "last_8":
    case "last_12": {
      const weeks = filter === "last_4" ? 4 : filter === "last_8" ? 8 : 12;
      const rangeStart = subWeeks(thisMonday, weeks);
      const prevSunday = new Date(thisMonday);
      prevSunday.setDate(thisMonday.getDate() - 1);
      prevSunday.setHours(23, 59, 59, 999);
      return { start: rangeStart, end: prevSunday };
    }
    case "all_time":
      return { start: new Date(2020, 0, 1), end: now };
  }
}

function isDailyView(filter: WeeklyFilter): boolean {
  return filter === "this_week" || filter === "last_week";
}

export function LinkedInOutreach() {
  const [date, setDate] = useState<Date>(new Date());
  const [weeklyFilter, setWeeklyFilter] = useState<WeeklyFilter>("this_week");
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

  // Fetch range data for weekly performance chart
  const filterRange = useMemo(() => getFilterRange(weeklyFilter), [weeklyFilter]);
  const { data: rangeData } = useQuery({
    queryKey: ["linkedin-outreach-range", user?.id, format(filterRange.start, "yyyy-MM-dd"), format(filterRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("linkedin_outreach")
        .select("activity_date, sent, replies, interviews")
        .eq("user_id", user.id)
        .gte("activity_date", format(filterRange.start, "yyyy-MM-dd"))
        .lte("activity_date", format(filterRange.end, "yyyy-MM-dd"))
        .order("activity_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const chartData = useMemo(() => {
    if (!rangeData || rangeData.length === 0) return [];

    if (isDailyView(weeklyFilter)) {
      const { start, end } = filterRange;
      const days = eachDayOfInterval({ start, end: isAfter(end, new Date()) ? new Date() : end });
      const dayMap = new Map(rangeData.map((r) => [r.activity_date, r]));
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const row = dayMap.get(key);
        return {
          label: format(d, "EEE"),
          sent: row?.sent ?? 0,
          replies: row?.replies ?? 0,
          interviews: row?.interviews ?? 0,
        };
      });
    }

    // Group by week
    const weekBuckets = new Map<string, { sent: number; replies: number; interviews: number }>();
    rangeData.forEach((r) => {
      const d = new Date(r.activity_date + "T00:00:00");
      const mon = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(mon, "yyyy-MM-dd");
      const bucket = weekBuckets.get(key) ?? { sent: 0, replies: 0, interviews: 0 };
      bucket.sent += r.sent;
      bucket.replies += r.replies;
      bucket.interviews += r.interviews;
      weekBuckets.set(key, bucket);
    });

    const sorted = Array.from(weekBuckets.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([key, vals], i) => ({
      label: weeklyFilter === "all_time" ? format(new Date(key + "T00:00:00"), "MMM d") : `Week ${i + 1}`,
      ...vals,
    }));
  }, [rangeData, weeklyFilter, filterRange]);

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
      // Log activity
      import("@/lib/activityLogger").then(m => m.logActivity("linkedin", "sent_messages"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin-outreach", user?.id, dateStr] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-outreach-range"] });
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

  const decrement = useCallback((type: "sent" | "reply" | "interview") => {
    const fieldMap = { sent: "sent", reply: "replies", interview: "interviews" } as const;
    const field = fieldMap[type];
    if (current[field] <= 0) return;
    // Remove the last matching log entry
    const logCopy = [...current.activity_log];
    const lastIdx = logCopy.map(e => e.type).lastIndexOf(type);
    if (lastIdx !== -1) logCopy.splice(lastIdx, 1);
    mutation.mutate({
      [field]: current[field] - 1,
      activity_log: logCopy,
    });
  }, [current, mutation]);

  const replyRate = current.sent > 0 ? Math.round((current.replies / current.sent) * 100) : 0;
  const interviewRate = current.sent > 0 ? Math.round((current.interviews / current.sent) * 100) : 0;

  const incrementCards = [
    { key: "sent" as const, label: "Sent", sub: "Messages sent today", value: current.sent, target: TARGETS.sent, color: "210 70% 50%", icon: Send, incrementType: "sent" as const },
    { key: "replies" as const, label: "Replies", sub: "People who replied", value: current.replies, target: TARGETS.replies, color: "45 90% 55%", icon: MessageSquareReply, incrementType: "reply" as const },
  ];

  return (
    <div className="space-y-6">
      <LinkedInHelpBox>
        <p className="font-medium text-foreground">LinkedIn Outreach — How to Use</p>
        <p>This page is used to track your personal outreach performance.</p>
        <p>You are measuring:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Messages Sent</li>
          <li>Replies</li>
          <li>Interviews booked</li>
        </ul>
        <p>This shows your conversion rate from outreach → hires.</p>
        <hr className="border-border/30" />
        <div>
          <p className="font-medium text-foreground mb-1">Best Practice</p>
          <p className="font-medium text-foreground/80 mb-1">Finding candidates</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Search on LinkedIn for:
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Marketing</li>
                <li>Sales</li>
                <li>Hospitality</li>
                <li>Retail</li>
              </ul>
            </li>
            <li>These backgrounds tend to perform well in this role</li>
            <li>Filter location to Belfast / Northern Ireland</li>
          </ul>
        </div>
        <hr className="border-border/30" />
        <div>
          <p className="font-medium text-foreground/80 mb-1">Connection strategy</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Send connection requests first</li>
            <li>Once accepted, you can message them for free</li>
          </ul>
        </div>
        <hr className="border-border/30" />
        <div>
          <p className="font-medium text-foreground/80 mb-1">Outreach process</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>Connect with candidates</li>
            <li>Wait for acceptance</li>
            <li>Send a message</li>
            <li>Track results on this page</li>
          </ol>
        </div>
        <hr className="border-border/30" />
        <div>
          <p className="font-medium text-foreground mb-1">Daily Targets</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Aim for:
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>25 connections per day</li>
                <li>25 messages per day</li>
              </ul>
            </li>
          </ul>
          <p className="mt-1">This builds momentum and creates a steady pipeline.</p>
        </div>
        <hr className="border-border/30" />
        <div>
          <p className="font-medium text-foreground mb-1">Tracking</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Log your activity daily:
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Sent → Replies → Interviews</li>
              </ul>
            </li>
          </ul>
          <p className="mt-1">This helps you understand:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>What messaging works</li>
            <li>Your conversion rate</li>
            <li>How to improve over time</li>
          </ul>
        </div>
        <hr className="border-border/30" />
        <p className="font-medium text-foreground italic">Consistency is key — small daily actions compound into strong results.</p>
      </LinkedInHelpBox>

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
        {incrementCards.map((card) => {
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
                  <div className="flex items-center gap-1.5">
                    {card.value > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decrement(card.incrementType)}
                        disabled={mutation.isPending}
                        className="text-xs font-bold h-9 w-9 p-0 rounded-lg"
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    )}
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
                </div>
                <div className="text-4xl font-bold tracking-tight text-foreground">{card.value}</div>
                <div className="text-sm font-semibold mt-1" style={{ color: `hsl(${card.color})` }}>{card.label}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                <div className="text-[10px] text-muted-foreground mt-2">{card.value}/{card.target} target</div>
              </CardContent>
            </Card>
          );
        })}

        {/* Interviews card - no +1 button, shows instructional message */}
        <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted/30">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${TARGETS.interviews > 0 ? Math.min((current.interviews / TARGETS.interviews) * 100, 100) : 0}%`, background: `hsl(142 60% 45%)` }}
            />
          </div>
          <CardContent className="pt-6 pb-4 px-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `hsl(142 60% 45% / 0.15)` }}>
                <PhoneCall className="w-5 h-5" style={{ color: `hsl(142 60% 45%)` }} />
              </div>
            </div>
            <div className="text-4xl font-bold tracking-tight text-foreground">{current.interviews}</div>
            <div className="text-sm font-semibold mt-1" style={{ color: `hsl(142 60% 45%)` }}>Interviews</div>
            <p className="text-xs text-muted-foreground mt-0.5">Calls booked</p>
            <div className="text-[10px] text-muted-foreground mt-2">{current.interviews}/{TARGETS.interviews} target</div>
            <div className="mt-3 p-2.5 rounded-md bg-primary/5 border border-primary/20">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Add a candidate to the recruitment pipeline on the Recruitment module with <span className="font-semibold text-foreground">'LinkedIn Messages'</span> as source to register this count.
              </p>
            </div>
          </CardContent>
        </Card>
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

      {/* Weekly Performance */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="py-5 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h3 className="text-sm font-semibold text-foreground">Weekly Performance</h3>
            <div className="flex flex-wrap gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={weeklyFilter === opt.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setWeeklyFilter(opt.value)}
                  className={cn(
                    "text-[11px] h-7 px-2.5 rounded-md",
                    weeklyFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {chartData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No outreach data for this period.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border) / 0.3)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                  <Line type="monotone" dataKey="sent" stroke="hsl(210 70% 50%)" strokeWidth={2} dot={{ r: 3 }} name="Sent" />
                  <Line type="monotone" dataKey="replies" stroke="hsl(45 90% 55%)" strokeWidth={2} dot={{ r: 3 }} name="Replies" />
                  <Line type="monotone" dataKey="interviews" stroke="hsl(142 60% 45%)" strokeWidth={2} dot={{ r: 3 }} name="Interviews" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

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