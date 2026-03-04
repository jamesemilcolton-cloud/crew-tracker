import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { getCalendarWeekBounds } from "@/lib/utils";
import { getAdjustedRepProfit } from "@/lib/commission";
import { Activity, Users, Calendar, TrendingUp } from "lucide-react";

interface RepGauges {
  name: string;
  user_id: string;
  doors: number;
  spoken: number;
  presentations: number;
  closes: number;
  tablets: number;
  sales: number;
  rep_profit: number;
  total_wire: number;
}

interface OfficeMeans {
  doors: number;
  spoken: number;
  presentations: number;
  closes: number;
  tablets: number;
  sales: number;
  avg_rep_profit: number;
  avg_total_wire: number;
  rep_count: number;
}

const GAUGE_KEYS = ["doors", "spoken", "presentations", "closes", "tablets", "sales"] as const;
const GAUGE_LABELS: Record<string, string> = {
  doors: "Doors", spoken: "Spoken", presentations: "Presentations",
  closes: "Closes", tablets: "Tablets", sales: "Sales",
};

export function OfficePerformanceOverview() {
  const [todayReps, setTodayReps] = useState<RepGauges[]>([]);
  const [todayMeans, setTodayMeans] = useState<OfficeMeans | null>(null);
  const [yesterdayMeans, setYesterdayMeans] = useState<OfficeMeans | null>(null);
  const [weekMeans, setWeekMeans] = useState<OfficeMeans | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const { start: weekStart } = getCalendarWeekBounds(0);
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    // Exclude managers
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role, super_admin");
    const managerIds = new Set((allRoles ?? []).filter(r => r.role === "manager" && r.super_admin).map(r => r.user_id));

    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach(p => nameMap.set(p.user_id, p.full_name));

    // Fetch all data in parallel
    const [todayEntriesRes, todayTxRes, yesterdayEntriesRes, yesterdayTxRes, weekEntriesRes, weekTxRes] = await Promise.all([
      supabase.from("sales_entries").select("*").eq("entry_date", today),
      supabase.from("sales_transactions").select("user_id, isa_upfront, total_wire, date, week_start, age_band, ask_amount, owner_upfront, quality_pending, id, created_at").eq("date", today),
      supabase.from("sales_entries").select("*").eq("entry_date", yesterday),
      supabase.from("sales_transactions").select("user_id, isa_upfront, total_wire, date, week_start, age_band, ask_amount, owner_upfront, quality_pending, id, created_at").eq("date", yesterday),
      supabase.from("sales_entries").select("*").gte("entry_date", weekStartStr).lte("entry_date", today),
      supabase.from("sales_transactions").select("user_id, isa_upfront, total_wire, date, week_start, age_band, ask_amount, owner_upfront, quality_pending, id, created_at").gte("date", weekStartStr).lte("date", today),
    ]);

    const filterManager = (entries: any[]) => (entries ?? []).filter(e => !managerIds.has(e.user_id));

    const todayEntries = filterManager(todayEntriesRes.data);
    const todayTx = filterManager(todayTxRes.data);
    const yesterdayEntries = filterManager(yesterdayEntriesRes.data);
    const yesterdayTx = filterManager(yesterdayTxRes.data);
    const weekEntries = filterManager(weekEntriesRes.data);
    const weekTx = filterManager(weekTxRes.data);

    // Today individual reps
    const todayRepMap = new Map<string, RepGauges>();
    todayEntries.forEach(e => {
      todayRepMap.set(e.user_id, {
        name: nameMap.get(e.user_id) ?? "Unknown",
        user_id: e.user_id,
        doors: e.doors, spoken: e.spoken, presentations: e.presentations,
        closes: e.closes, tablets: e.tablets, sales: e.sales,
        rep_profit: 0, total_wire: 0,
      });
    });
    todayTx.forEach(t => {
      const rep = todayRepMap.get(t.user_id);
      if (rep) {
        rep.rep_profit += getAdjustedRepProfit(t);
        rep.total_wire += Number(t.total_wire);
      } else {
        // Rep has transactions but no gauge entry today
        todayRepMap.set(t.user_id, {
          name: nameMap.get(t.user_id) ?? "Unknown",
          user_id: t.user_id,
          doors: 0, spoken: 0, presentations: 0, closes: 0, tablets: 0, sales: 0,
          rep_profit: getAdjustedRepProfit(t),
          total_wire: Number(t.total_wire),
        });
      }
    });
    const reps = [...todayRepMap.values()].sort((a, b) => b.sales - a.sales);
    setTodayReps(reps);
    setTodayMeans(calcMeans(todayEntries, todayTx));
    setYesterdayMeans(calcMeans(yesterdayEntries, yesterdayTx));
    setWeekMeans(calcMeans(weekEntries, weekTx));
    setLoading(false);
  }

  function calcMeans(entries: any[], transactions: any[]): OfficeMeans | null {
    if (entries.length === 0) return null;
    const repCount = entries.length;
    const totals = { doors: 0, spoken: 0, presentations: 0, closes: 0, tablets: 0, sales: 0 };
    entries.forEach(e => {
      GAUGE_KEYS.forEach(k => { totals[k] += e[k] || 0; });
    });

    // Financial per rep
    const repFinancials = new Map<string, { repProfit: number; totalWire: number }>();
    transactions.forEach(t => {
      const existing = repFinancials.get(t.user_id) ?? { repProfit: 0, totalWire: 0 };
      existing.repProfit += getAdjustedRepProfit(t);
      existing.totalWire += Number(t.total_wire);
      repFinancials.set(t.user_id, existing);
    });
    const totalRepProfit = [...repFinancials.values()].reduce((s, f) => s + f.repProfit, 0);
    const totalWire = [...repFinancials.values()].reduce((s, f) => s + f.totalWire, 0);
    const financialRepCount = repFinancials.size || 1;

    return {
      doors: Math.round(totals.doors / repCount),
      spoken: Math.round(totals.spoken / repCount),
      presentations: Math.round(totals.presentations / repCount),
      closes: Math.round(totals.closes / repCount),
      tablets: Math.round(totals.tablets / repCount),
      sales: Math.round((totals.sales / repCount) * 10) / 10,
      avg_rep_profit: totalRepProfit / financialRepCount,
      avg_total_wire: totalWire / financialRepCount,
      rep_count: repCount,
    };
  }

  const MeansGrid = ({ means, label }: { means: OfficeMeans | null; label: string }) => {
    if (!means) return <p className="text-xs text-muted-foreground">No data for {label.toLowerCase()}.</p>;
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{means.rep_count} rep{means.rep_count !== 1 ? "s" : ""} logged</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {GAUGE_KEYS.map(k => (
            <div key={k} className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/20">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{GAUGE_LABELS[k]}</p>
              <p className="text-lg font-bold text-foreground">{means[k]}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Rep Profit</p>
            <p className="text-base font-bold text-foreground">£{means.avg_rep_profit.toFixed(2)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Total Wire</p>
            <p className="text-base font-bold text-foreground">£{means.avg_total_wire.toFixed(2)}</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="glass-panel">
        <CardContent className="py-6">
          <p className="text-xs text-muted-foreground text-center">Loading office performance...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* TODAY - Office Averages */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Today — Office Averages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MeansGrid means={todayMeans} label="today" />
        </CardContent>
      </Card>

      {/* TODAY - Individual Rep Performance */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Today — Individual Rep Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayReps.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reps have logged gauges today.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep</TableHead>
                    {GAUGE_KEYS.map(k => <TableHead key={k} className="text-center">{GAUGE_LABELS[k]}</TableHead>)}
                    <TableHead className="text-right">Rep Profit</TableHead>
                    <TableHead className="text-right">Total Wire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayReps.map(rep => (
                    <TableRow key={rep.user_id}>
                      <TableCell className="font-medium text-sm">{rep.name}</TableCell>
                      {GAUGE_KEYS.map(k => <TableCell key={k} className="text-center">{rep[k]}</TableCell>)}
                      <TableCell className="text-right font-medium">£{rep.rep_profit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">£{rep.total_wire.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* YESTERDAY - Office Averages */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Yesterday — Office Averages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MeansGrid means={yesterdayMeans} label="yesterday" />
        </CardContent>
      </Card>

      {/* WEEK SO FAR */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Week So Far — Office Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weekMeans ? (
            <div className="space-y-3">
              <MeansGrid means={weekMeans} label="this week" />
              {/* Also show total wire for the office */}
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Office Wire (Week)</p>
                <p className="text-xl font-bold text-primary">
                  £{(weekMeans.avg_total_wire * weekMeans.rep_count).toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No data for this week yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
