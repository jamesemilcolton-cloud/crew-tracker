import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Minus, Save, Check, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSalesData, SalesEntry } from "@/hooks/useSalesData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const FIELD_LABELS = ["Doors", "Spoken", "Presentations", "Closes", "Tablets", "Sales"] as const;
type FieldKey = "doors" | "spoken" | "presentations" | "closes" | "tablets" | "sales";
const FIELD_KEYS: FieldKey[] = ["doors", "spoken", "presentations", "closes", "tablets", "sales"];

export default function Sales() {
  const navigate = useNavigate();
  const { profile, userRole } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);

  const {
    currentWeekEntries, saveDayMutation, getDateForDay, getEntryForDate,
    getWeekTotals, calcLOA, calcCloseLOA, getWeeklyLOAData, getPrevWeekTotals,
    getPersonalBestSales, teamEntries, profiles, DAYS, isCurrentWeek, weekLabel,
  } = useSalesData(weekOffset);

  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });

  const [formData, setFormData] = useState<Record<FieldKey, string>>({
    doors: "0", spoken: "0", presentations: "0", closes: "0", tablets: "0", sales: "0",
  });

  const [pbGlow, setPbGlow] = useState(false);

  const currentDate = getDateForDay(selectedDay);
  const existingEntry = getEntryForDate(currentDate);

  useEffect(() => {
    if (existingEntry) {
      setFormData({
        doors: String(existingEntry.doors),
        spoken: String(existingEntry.spoken),
        presentations: String(existingEntry.presentations),
        closes: String(existingEntry.closes),
        tablets: String(existingEntry.tablets),
        sales: String(existingEntry.sales),
      });
    } else {
      setFormData({ doors: "", spoken: "", presentations: "", closes: "", tablets: "", sales: "" });
    }
  }, [selectedDay, existingEntry?.id, weekOffset]);

  // Validation: all fields must be non-empty (numbers including 0)
  const allFieldsFilled = FIELD_KEYS.every((k) => formData[k] !== "");
  const numericData = useMemo(() => {
    const out: Record<FieldKey, number> = {} as any;
    for (const k of FIELD_KEYS) {
      out[k] = formData[k] === "" ? 0 : Math.max(0, parseInt(formData[k]) || 0);
    }
    return out;
  }, [formData]);

  const handleSave = () => {
    if (!allFieldsFilled) return;
    saveDayMutation.mutate({ date: currentDate, data: numericData }, {
      onSuccess: () => toast.success("Day saved"),
      onError: () => toast.error("Failed to save"),
    });
  };

  const savedDays = new Set(currentWeekEntries.map((e) => e.entry_date));
  const weekTotals = getWeekTotals(currentWeekEntries);
  const prevTotals = getPrevWeekTotals();
  const loaData = getWeeklyLOAData();
  const personalBest = getPersonalBestSales();

  useEffect(() => {
    if (personalBest !== null && weekTotals.sales > 0 && weekTotals.sales >= personalBest) {
      setPbGlow(true);
      const t = setTimeout(() => setPbGlow(false), 2000);
      return () => clearTimeout(t);
    }
  }, [weekTotals.sales, personalBest]);

  const currLOANum = weekTotals.sales > 0 ? Math.round(weekTotals.spoken / weekTotals.sales) : null;
  const prevLOANum = prevTotals.sales > 0 ? Math.round(prevTotals.spoken / prevTotals.sales) : null;
  let loaTrend: "better" | "worse" | "same" = "same";
  if (currLOANum !== null && prevLOANum !== null) {
    if (currLOANum < prevLOANum) loaTrend = "better";
    else if (currLOANum > prevLOANum) loaTrend = "worse";
  }

  

  const role = userRole?.role;
  const myProfileId = profile?.id;
  const myUserId = profile?.user_id;

  const getCrewMembers = () => {
    if (!role || role === "brand_ambassador") return [];
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    let relevantUserIds: string[];
    if (role === "manager" && userRole?.super_admin) {
      relevantUserIds = profiles.map((p) => p.user_id);
    } else {
      // Build hierarchy map and recursively collect all descendants
      const childrenMap = new Map<string, string[]>();
      profiles.forEach((p) => {
        if (p.leader_id) {
          const existing = childrenMap.get(p.leader_id) || [];
          existing.push(p.id);
          childrenMap.set(p.leader_id, existing);
        }
      });
      const getDescendantUserIds = (profileId: string): string[] => {
        const children = childrenMap.get(profileId) || [];
        const result: string[] = [];
        for (const childId of children) {
          const child = profiles.find((p) => p.id === childId);
          if (child) result.push(child.user_id);
          result.push(...getDescendantUserIds(childId));
        }
        return result;
      };
      relevantUserIds = myProfileId ? getDescendantUserIds(myProfileId) : [];
    }
    const members = relevantUserIds.map((uid) => {
      const p = profileMap.get(uid);
      const entries = teamEntries.filter((e) => e.user_id === uid);
      const totals = getWeekTotals(entries);
      const loaNum = totals.sales > 0 ? Math.round(totals.spoken / totals.sales) : Infinity;
      return { userId: uid, name: p?.full_name || "Unknown", sales: totals.sales, spoken: totals.spoken, loa: calcLOA(totals.spoken, totals.sales), loaNum };
    });
    members.sort((a, b) => {
      if (b.sales !== a.sales) return b.sales - a.sales;
      if (a.loaNum !== b.loaNum) return a.loaNum - b.loaNum;
      return a.name.localeCompare(b.name);
    });
    return members;
  };

  const crewMembers = getCrewMembers();
  const hasCrew = crewMembers.length > 0;

  // Prevent navigating into the future
  const canGoForward = weekOffset < 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center gap-3 h-14">
            <Button variant="ghost" size="sm" onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Modules
            </Button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsl(var(--module-sales)/0.2)]">
              <DollarSign className="w-4 h-4 text-[hsl(var(--module-sales))]" />
            </div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Sales</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-6 space-y-6">
        {/* 1. Week Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((o) => o - 1)} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Week Commencing</p>
            <p className="text-sm font-semibold text-foreground">{weekLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((o) => o + 1)} disabled={!canGoForward} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* 2. Day Selector & Entry */}
        <div className="glass-panel p-4">
          <div className="flex gap-1.5 mb-4 overflow-x-auto">
            {DAYS.map((day, i) => {
              const date = getDateForDay(i);
              const isSaved = savedDays.has(date);
              const isSelected = selectedDay === i;
              const isSunday = i === 6;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(i)}
                  className={`relative flex-1 min-w-[44px] py-2 px-1 rounded-lg text-xs font-medium transition-all
                    ${isSelected ? "bg-[hsl(var(--module-sales)/0.25)] text-[hsl(var(--module-sales))] border border-[hsl(var(--module-sales)/0.4)]" : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"}
                    ${isSunday ? "opacity-60" : ""}`}
                >
                  {day}
                  {isSunday && <span className="block text-[9px] opacity-60">opt</span>}
                  {isSaved && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {FIELD_KEYS.map((key, i) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground mb-1 block">{FIELD_LABELS[i]}</label>
                <Input
                  type="number"
                  min={0}
                  value={formData[key]}
                  onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder="0"
                  className="h-9 text-sm bg-secondary/50 border-border/50"
                />
              </div>
            ))}
          </div>

          {!allFieldsFilled && (
            <p className="text-[11px] text-[hsl(var(--module-sales))] mb-2">All gauges must be completed before saving.</p>
          )}

          <Button
            onClick={handleSave}
            disabled={saveDayMutation.isPending || !allFieldsFilled}
            className="w-full bg-[hsl(var(--module-sales))] hover:bg-[hsl(var(--module-sales)/0.85)] text-foreground font-medium disabled:opacity-40"
          >
            {saveDayMutation.isPending ? "Saving…" : existingEntry ? (
              <><Check className="w-4 h-4 mr-1" /> Update Day</>
            ) : (
              <><Save className="w-4 h-4 mr-1" /> Save Day</>
            )}
          </Button>
        </div>

        {/* 3. Weekly Performance Summary — 3 stat boxes */}
        <div className="grid grid-cols-3 gap-3">
          {/* Primary LOA */}
          <Card className="border-[hsl(var(--module-sales)/0.3)] bg-card">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] text-muted-foreground font-medium">LOA (Spoken → Sale)</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold font-mono text-[hsl(var(--module-sales))]">
                  {calcLOA(weekTotals.spoken, weekTotals.sales)}
                </span>
                {loaTrend === "better" && <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
                {loaTrend === "worse" && <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--module-sales))]" />}
                {loaTrend === "same" && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Lower is better</p>
            </CardContent>
          </Card>

          {/* Close LOA */}
          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] text-muted-foreground font-medium">LOA (Close → Sale)</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <span className="text-xl font-bold font-mono text-orange-400">
                {calcCloseLOA(weekTotals.closes, weekTotals.sales)}
              </span>
              <p className="text-[9px] text-muted-foreground mt-0.5">Lower is better</p>
            </CardContent>
          </Card>

          {/* Personal Best */}
          <Card className={`border-border/50 bg-card transition-shadow duration-700 ${pbGlow ? "shadow-[0_0_20px_hsl(217_91%_60%/0.4)] border-[hsl(217_91%_60%/0.5)]" : ""}`}>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Trophy className="w-3 h-3 text-[hsl(var(--module-leaderboards))]" />
                Personal Best
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <span className="text-xl font-bold font-mono text-[hsl(var(--module-leaderboards))]">
                {personalBest !== null ? `${personalBest}` : "–"}
              </span>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {personalBest !== null ? "Sales (best week)" : "No record yet"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 4. LOA Progression Graph */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">LOA Progression (8 weeks)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loaData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ background: "hsl(222 44% 10%)", border: "1px solid hsl(222 30% 16%)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(210 40% 96%)" }}
                    formatter={(v: any) => v !== null ? [`${v} : 1`, "LOA"] : ["–", "LOA"]}
                  />
                  <Line type="monotone" dataKey="loa" stroke="hsl(0 65% 48%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(0 65% 48%)" }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 5. Daily Week Breakdown */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Daily Breakdown – {isCurrentWeek ? "This Week" : weekLabel}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left pb-2 font-medium">Day</th>
                  {FIELD_LABELS.map((l) => (
                    <th key={l} className="text-right pb-2 font-medium">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, i) => {
                  const date = getDateForDay(i);
                  const entry = getEntryForDate(date);
                  return (
                    <tr key={day} className="border-b border-border/10">
                      <td className="py-1.5 text-muted-foreground font-medium">{day}</td>
                      {FIELD_KEYS.map((key) => (
                        <td key={key} className="py-1.5 text-right font-mono text-foreground">
                          {entry ? entry[key] : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Week Total Sales */}
        <Card className="border-[hsl(var(--module-sales)/0.3)] bg-card">
          <CardContent className="px-4 py-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Sales This Week</span>
            <span className="text-2xl font-bold font-mono text-[hsl(var(--module-sales))]">{weekTotals.sales}</span>
          </CardContent>
        </Card>

        {/* 6. Crew Leaderboard / Personal Summary */}
        {role && role !== "brand_ambassador" && (
          hasCrew ? (
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">
                  Crew Sales Leaderboard – {isCurrentWeek ? "This Week" : weekLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/30">
                      <th className="text-left pb-2 font-medium w-8">#</th>
                      <th className="text-left pb-2 font-medium">Name</th>
                      <th className="text-right pb-2 font-medium">Sales</th>
                      <th className="text-right pb-2 font-medium">Spoken</th>
                      <th className="text-right pb-2 font-medium">LOA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crewMembers.map((m, idx) => {
                      const isMe = m.userId === myUserId;
                      return (
                        <tr key={m.userId} className={`border-b border-border/10 ${isMe ? "bg-[hsl(var(--module-sales)/0.08)]" : ""}`}>
                          <td className="py-2 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 text-foreground">{m.name}{isMe && <span className="text-muted-foreground ml-1 text-[10px]">(you)</span>}</td>
                          <td className="py-2 text-right font-mono font-semibold text-foreground">{m.sales}</td>
                          <td className="py-2 text-right font-mono text-muted-foreground">{m.spoken}</td>
                          <td className="py-2 text-right font-mono text-[hsl(var(--module-sales))]">{m.loa}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-card">
              <CardContent className="px-4 py-6 text-center">
                <p className="text-lg font-bold font-mono text-foreground mb-1">
                  Your Sales This Week: {weekTotals.sales}
                </p>
                <p className="text-xs text-muted-foreground">No one on your crew yet.</p>
              </CardContent>
            </Card>
          )
        )}
      </main>
    </div>
  );
}
