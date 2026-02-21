import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Minus, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  const {
    currentWeekEntries, saveDayMutation, getDateForDay, getEntryForDate,
    getWeekTotals, calcLOA, calcCloseLOA, getWeeklyLOAData, getPrevWeekTotals,
    teamEntries, profiles, DAYS,
  } = useSalesData();

  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // Monday=0
  });

  const [formData, setFormData] = useState<Record<FieldKey, number>>({
    doors: 0, spoken: 0, presentations: 0, closes: 0, tablets: 0, sales: 0,
  });

  const currentDate = getDateForDay(selectedDay);
  const existingEntry = getEntryForDate(currentDate);

  useEffect(() => {
    if (existingEntry) {
      setFormData({
        doors: existingEntry.doors,
        spoken: existingEntry.spoken,
        presentations: existingEntry.presentations,
        closes: existingEntry.closes,
        tablets: existingEntry.tablets,
        sales: existingEntry.sales,
      });
    } else {
      setFormData({ doors: 0, spoken: 0, presentations: 0, closes: 0, tablets: 0, sales: 0 });
    }
  }, [selectedDay, existingEntry?.id]);

  const handleSave = () => {
    saveDayMutation.mutate({ date: currentDate, data: formData }, {
      onSuccess: () => toast.success("Day saved"),
      onError: () => toast.error("Failed to save"),
    });
  };

  const savedDays = new Set(currentWeekEntries.map((e) => e.entry_date));
  const weekTotals = getWeekTotals(currentWeekEntries);
  const prevTotals = getPrevWeekTotals();
  const loaData = getWeeklyLOAData();
  const daysLogged = currentWeekEntries.length;

  // LOA comparison
  const currLOANum = weekTotals.sales > 0 ? Math.round(weekTotals.spoken / weekTotals.sales) : null;
  const prevLOANum = prevTotals.sales > 0 ? Math.round(prevTotals.spoken / prevTotals.sales) : null;
  let loaTrend: "better" | "worse" | "same" = "same";
  if (currLOANum !== null && prevLOANum !== null) {
    if (currLOANum < prevLOANum) loaTrend = "better";
    else if (currLOANum > prevLOANum) loaTrend = "worse";
  }

  // Funnel percentages
  const pct = (num: number, den: number) => (den > 0 ? ((num / den) * 100).toFixed(0) + "%" : "–");

  // Team data for leaders/managers
  const role = userRole?.role;
  const myProfileId = profile?.id;

  const getTeamMembers = () => {
    if (!role || role === "brand_ambassador") return [];
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    let relevantUserIds: string[];
    if (role === "manager" && userRole?.super_admin) {
      relevantUserIds = profiles.map((p) => p.user_id);
    } else {
      // Leader: direct reports
      relevantUserIds = profiles.filter((p) => p.leader_id === myProfileId).map((p) => p.user_id);
    }

    return relevantUserIds.map((uid) => {
      const p = profileMap.get(uid);
      const entries = teamEntries.filter((e) => e.user_id === uid);
      const totals = getWeekTotals(entries);
      return {
        name: p?.full_name || "Unknown",
        sales: totals.sales,
        spoken: totals.spoken,
        loa: calcLOA(totals.spoken, totals.sales),
        closeLoa: calcCloseLOA(totals.closes, totals.sales),
      };
    });
  };

  const teamMembers = getTeamMembers();

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
        {/* 1. Day Selector */}
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

          {/* Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {FIELD_KEYS.map((key, i) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground mb-1 block">{FIELD_LABELS[i]}</label>
                <Input
                  type="number"
                  min={0}
                  value={formData[key]}
                  onChange={(e) => setFormData((p) => ({ ...p, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="h-9 text-sm bg-secondary/50 border-border/50"
                />
              </div>
            ))}
          </div>

          <Button
            onClick={handleSave}
            disabled={saveDayMutation.isPending}
            className="w-full bg-[hsl(var(--module-sales))] hover:bg-[hsl(var(--module-sales)/0.85)] text-foreground font-medium"
          >
            {saveDayMutation.isPending ? "Saving…" : existingEntry ? (
              <><Check className="w-4 h-4 mr-1" /> Update Day</>
            ) : (
              <><Save className="w-4 h-4 mr-1" /> Save Day</>
            )}
          </Button>
        </div>

        {/* 2. Weekly Performance Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-[hsl(var(--module-sales)/0.3)] bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">LOA (Spoken → Sale)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono text-[hsl(var(--module-sales))]">
                  {calcLOA(weekTotals.spoken, weekTotals.sales)}
                </span>
                {loaTrend === "better" && <TrendingDown className="w-4 h-4 text-emerald-500" />}
                {loaTrend === "worse" && <TrendingUp className="w-4 h-4 text-[hsl(var(--module-sales))]" />}
                {loaTrend === "same" && <Minus className="w-4 h-4 text-muted-foreground" />}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Lower is better</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">Close LOA (Closes → Sale)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <span className="text-2xl font-bold font-mono text-orange-400">
                {calcCloseLOA(weekTotals.closes, weekTotals.sales)}
              </span>
              <p className="text-[10px] text-muted-foreground mt-1">Lower is better</p>
            </CardContent>
          </Card>
        </div>

        {/* 3. LOA Progression Graph */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">LOA Progression (8 weeks)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loaData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} width={30} reversed />
                  <Tooltip
                    contentStyle={{ background: "hsl(222 44% 10%)", border: "1px solid hsl(222 30% 16%)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(210 40% 96%)" }}
                    formatter={(v: any) => v !== null ? [`${v} : 1`, "LOA"] : ["–", "LOA"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="loa"
                    stroke="hsl(0 65% 48%)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(0 65% 48%)" }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. Funnel Snapshot */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Weekly Funnel</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1">
              {FIELD_KEYS.map((key, i) => {
                const val = weekTotals[key];
                const prevKey = i > 0 ? FIELD_KEYS[i - 1] : null;
                const prevVal = prevKey ? weekTotals[prevKey] : null;
                const convPct = prevVal !== null ? pct(val, prevVal) : null;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 truncate">{FIELD_LABELS[i]}</span>
                    <div className="flex-1 h-6 bg-secondary/40 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded bg-[hsl(var(--module-sales)/0.35)]"
                        style={{ width: `${weekTotals.doors > 0 ? (val / weekTotals.doors) * 100 : 0}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-medium text-foreground">
                        {val}
                      </span>
                    </div>
                    {convPct && (
                      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{convPct}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 5. Consistency Tracker */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Consistency</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Days Logged This Week</span>
              <span className="text-sm font-mono font-bold text-foreground">{daysLogged} / 6</span>
            </div>
            <Progress value={(daysLogged / 6) * 100} className="h-2 bg-secondary/50 [&>div]:bg-[hsl(var(--module-sales))]" />
          </CardContent>
        </Card>

        {/* 6. Team Snapshot (leaders/managers only) */}
        {role && role !== "brand_ambassador" && teamMembers.length > 0 && (
          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                {role === "manager" ? "Office" : "Team"} Weekly Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-right pb-2 font-medium">Sales</th>
                    <th className="text-right pb-2 font-medium">Spoken</th>
                    <th className="text-right pb-2 font-medium">LOA</th>
                    <th className="text-right pb-2 font-medium">Close LOA</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.sort((a, b) => b.sales - a.sales).map((m) => (
                    <tr key={m.name} className="border-b border-border/10">
                      <td className="py-2 text-foreground">{m.name}</td>
                      <td className="py-2 text-right font-mono text-foreground">{m.sales}</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">{m.spoken}</td>
                      <td className="py-2 text-right font-mono text-[hsl(var(--module-sales))]">{m.loa}</td>
                      <td className="py-2 text-right font-mono text-orange-400">{m.closeLoa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
