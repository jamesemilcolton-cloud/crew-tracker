import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Minus, Save, Check, Trophy, ChevronLeft, ChevronRight, Lock, AlertTriangle, PoundSterling } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSalesData, SalesEntry } from "@/hooks/useSalesData";
import { useSalesTransactions } from "@/hooks/useSalesTransactions";
import { SaleTransactionModal } from "@/components/sales/SaleTransactionModal";
import { AgeBand } from "@/lib/commission";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { getCalendarWeekBounds } from "@/lib/utils";

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
    getPersonalBestDay, DAYS, isCurrentWeek, weekLabel,
  } = useSalesData(weekOffset);

  // Compute week bounds for transactions
  const weekBounds = useMemo(() => {
    const { start, end } = getCalendarWeekBounds(weekOffset);
    return { wsStr: format(start, "yyyy-MM-dd"), weStr: format(end, "yyyy-MM-dd") };
  }, [weekOffset]);

  const {
    ownTransactions, getTransactionsForDate, getWeekFinancials,
    insertTransaction, deleteTransactionsForDate,
  } = useSalesTransactions(weekBounds.wsStr, weekBounds.weStr);

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

  const allFieldsFilled = FIELD_KEYS.every((k) => formData[k] !== "");
  const numericData = useMemo(() => {
    const out: Record<FieldKey, number> = {} as any;
    for (const k of FIELD_KEYS) {
      out[k] = formData[k] === "" ? 0 : Math.max(0, parseInt(formData[k]) || 0);
    }
    return out;
  }, [formData]);

  // Week locking logic
  const isWeekLocked = useMemo(() => {
    if (weekOffset >= 0) return false;
    return true;
  }, [weekOffset]);

  const isManagerRole = userRole?.role === "manager" && userRole?.super_admin;
  const [managerUnlocked, setManagerUnlocked] = useState(false);
  useEffect(() => { setManagerUnlocked(false); }, [weekOffset]);
  const effectivelyLocked = isWeekLocked && !managerUnlocked;

  // Extreme data confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ date: string; data: Record<FieldKey, number> } | null>(null);

  const EXTREME_THRESHOLDS: Partial<Record<FieldKey, number>> = {
    doors: 250, spoken: 150, sales: 15,
  };

  const hasExtremeValues = (data: Record<FieldKey, number>) => {
    return Object.entries(EXTREME_THRESHOLDS).some(([key, threshold]) => data[key as FieldKey] > threshold!);
  };

  // Sale transaction modal state
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [salesToLog, setSalesToLog] = useState(0);  // total needed this batch
  const [salesLoggedCount, setSalesLoggedCount] = useState(0);  // how many done so far in this batch
  const [saleDate, setSaleDate] = useState("");

  const doSave = (date: string, data: Record<FieldKey, number>) => {
    const newSalesCount = data.sales;

    saveDayMutation.mutate({ date, data }, {
      onSuccess: () => {
        toast.success("Day saved");

        // If no sales, skip all transaction logic
        if (newSalesCount === 0) {
          // Still need to clean up any existing transactions if user reduced to 0
          const existingTxCount = getTransactionsForDate(date).length;
          if (existingTxCount > 0) {
            deleteTransactionsForDate.mutate({ date, count: existingTxCount }, {
              onSuccess: () => toast.info(`Removed ${existingTxCount} excess transaction(s)`),
            });
          }
          return;
        }

        // Check if sales transactions need to be logged or adjusted
        const existingTxCount = getTransactionsForDate(date).length;

        if (newSalesCount > existingTxCount) {
          // Need to log more sale transactions
          const needed = newSalesCount - existingTxCount;
          setSaleDate(date);
          setSalesToLog(needed);
          setSalesLoggedCount(0);
          setSaleModalOpen(true);
        } else if (newSalesCount < existingTxCount) {
          // Need to remove excess transactions
          const excess = existingTxCount - newSalesCount;
          deleteTransactionsForDate.mutate({ date, count: excess }, {
            onSuccess: () => toast.info(`Removed ${excess} excess transaction(s)`),
          });
        }
      },
      onError: () => toast.error("Failed to save"),
    });
  };

  const handleSave = () => {
    if (!allFieldsFilled || effectivelyLocked) return;
    if (hasExtremeValues(numericData)) {
      setPendingSave({ date: currentDate, data: numericData });
      setConfirmOpen(true);
      return;
    }
    doSave(currentDate, numericData);
  };

  const handleConfirmExtreme = () => {
    if (pendingSave) doSave(pendingSave.date, pendingSave.data);
    setConfirmOpen(false);
    setPendingSave(null);
  };

  const handleSaleConfirm = (data: {
    ageBand: AgeBand;
    askAmount: number;
    isaUpfront: number;
    ownerUpfront: number;
    totalWire: number;
    qualityPending: number;
  }) => {
    insertTransaction.mutate({
      date: saleDate,
      ageBand: data.ageBand,
      askAmount: data.askAmount,
      isaUpfront: data.isaUpfront,
      ownerUpfront: data.ownerUpfront,
      totalWire: data.totalWire,
      qualityPending: data.qualityPending,
    }, {
      onSuccess: () => {
        setSalesLoggedCount((prev) => {
          const next = prev + 1;
          if (next >= salesToLog) {
            setSaleModalOpen(false);
            setSalesToLog(0);
            toast.success("All sale transactions recorded");
          }
          return next;
        });
      },
      onError: () => toast.error("Failed to save transaction"),
    });
  };

  const handleSaleCancel = () => {
    setSaleModalOpen(false);
    setSalesToLog(0);
    setSalesLoggedCount(0);
  };

  const savedDays = new Set(currentWeekEntries.map((e) => e.entry_date));
  const weekTotals = getWeekTotals(currentWeekEntries);
  const prevTotals = getPrevWeekTotals();
  const loaData = getWeeklyLOAData();
  const personalBestDay = getPersonalBestDay();
  const weekFinancials = getWeekFinancials();

  useEffect(() => {
    if (personalBestDay !== null && weekTotals.sales > 0 && weekTotals.sales >= personalBestDay.sales) {
      setPbGlow(true);
      const t = setTimeout(() => setPbGlow(false), 2000);
      return () => clearTimeout(t);
    }
  }, [weekTotals.sales, personalBestDay]);

  const currLOANum = weekTotals.sales > 0 ? Math.round(weekTotals.spoken / weekTotals.sales) : null;
  const prevLOANum = prevTotals.sales > 0 ? Math.round(prevTotals.spoken / prevTotals.sales) : null;
  let loaTrend: "better" | "worse" | "same" = "same";
  if (currLOANum !== null && prevLOANum !== null) {
    if (currLOANum < prevLOANum) loaTrend = "better";
    else if (currLOANum > prevLOANum) loaTrend = "worse";
  }

  const canGoForward = weekOffset < 0;

  // Track modal progress: which sale number we're on
  const currentSaleNumber = salesLoggedCount + 1;
  const totalSalesForModal = salesToLog;

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

      {/* Extreme Data Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[hsl(var(--module-sales))]" />
              Confirm Entry
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            One or more values exceed typical thresholds. Are you sure this data is correct?
          </p>
          {pendingSave && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              {FIELD_KEYS.map((key, i) => {
                const isExtreme = EXTREME_THRESHOLDS[key] && pendingSave.data[key] > EXTREME_THRESHOLDS[key]!;
                return (
                  <div key={key} className={`rounded p-2 text-center ${isExtreme ? "bg-destructive/10 border border-destructive/30" : "bg-muted/30"}`}>
                    <div className="text-muted-foreground">{FIELD_LABELS[i]}</div>
                    <div className={`font-mono font-bold ${isExtreme ? "text-destructive" : "text-foreground"}`}>{pendingSave.data[key]}</div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleConfirmExtreme} className="bg-[hsl(var(--module-sales))] hover:bg-[hsl(var(--module-sales)/0.85)]">Yes, Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Transaction Modal */}
      <SaleTransactionModal
        open={saleModalOpen}
        onConfirm={handleSaleConfirm}
        onCancel={handleSaleCancel}
        saleNumber={currentSaleNumber}
        totalSales={totalSalesForModal}
        saleDate={currentDate}
      />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-5 space-y-5">
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

        {/* Locked week indicator */}
        {isWeekLocked && (
          <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">This week is locked</span>
            </div>
            {isManagerRole && !managerUnlocked && (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setManagerUnlocked(true)}>
                Unlock as Manager
              </Button>
            )}
            {managerUnlocked && (
              <span className="text-xs text-primary font-medium">Unlocked by Manager</span>
            )}
          </div>
        )}

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
            disabled={saveDayMutation.isPending || !allFieldsFilled || effectivelyLocked}
            className="w-full bg-[hsl(var(--module-sales))] hover:bg-[hsl(var(--module-sales)/0.85)] text-foreground font-medium disabled:opacity-40"
          >
            {saveDayMutation.isPending ? "Saving…" : existingEntry ? (
              <><Check className="w-4 h-4 mr-1" /> Update Day</>
            ) : (
              <><Save className="w-4 h-4 mr-1" /> Save Day</>
            )}
          </Button>
        </div>

        {/* 3. Weekly Performance Summary — stats */}
        <div className="grid grid-cols-3 gap-3">
          {/* Primary LOA */}
          <Card className="border-[hsl(var(--module-sales)/0.3)] bg-card">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] text-muted-foreground font-medium">LOA (Spoken – Sale)</CardTitle>
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
              <CardTitle className="text-[10px] text-muted-foreground font-medium">LOA (Close – Sale)</CardTitle>
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

        {/* Financial Summary — This Week */}
        <Card className="border-[hsl(var(--module-sales)/0.3)] bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <PoundSterling className="w-3.5 h-3.5 text-[hsl(var(--module-sales))]" />
              Commission — This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Rep Profit</div>
                <div className="text-lg font-bold text-foreground">£{weekFinancials.repProfit.toFixed(2)}</div>
              </div>
              <div className="bg-muted/20 rounded-lg p-3 text-center opacity-60">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Quality (30%)</div>
                <div className="text-lg font-bold text-muted-foreground">£{weekFinancials.qualityPending.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-2 text-center">
              <span className="text-[10px] text-muted-foreground">{weekFinancials.count} sale transaction(s) recorded</span>
            </div>
          </CardContent>
        </Card>

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
              <tfoot>
                {(() => {
                  const daysWithEntries = DAYS.map((_, i) => getEntryForDate(getDateForDay(i))).filter(Boolean) as SalesEntry[];
                  const count = daysWithEntries.length;
                  if (count === 0) return null;
                  return (
                    <tr className="border-t border-[hsl(var(--module-sales)/0.3)]">
                      <td className="py-2 text-[hsl(var(--module-sales))] font-semibold text-[11px]">Avg ({count}d)</td>
                      {FIELD_KEYS.map((key) => {
                        const avg = daysWithEntries.reduce((s, e) => s + e[key], 0) / count;
                        return (
                          <td key={key} className="py-2 text-right font-mono font-semibold text-[hsl(var(--module-sales))]">
                            {avg % 1 === 0 ? avg : avg.toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })()}
              </tfoot>
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

      </main>
    </div>
  );
}
