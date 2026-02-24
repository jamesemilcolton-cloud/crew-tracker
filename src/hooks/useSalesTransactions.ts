import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek } from "date-fns";
import { getAdjustedRepProfit } from "@/lib/commission";

export interface SalesTransaction {
  id: string;
  user_id: string;
  date: string;
  week_start: string;
  age_band: string;
  ask_amount: number;
  isa_upfront: number;
  owner_upfront: number;
  total_wire: number;
  quality_pending: number;
  created_at: string;
}

export function useSalesTransactions(weekStart: string, weekEnd: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Own transactions for the selected week
  const ownQuery = useQuery({
    queryKey: ["sales-transactions", "own", weekStart, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_transactions")
        .select("id, user_id, date, week_start, age_band, ask_amount, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
        .eq("user_id", user!.id)
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SalesTransaction[];
    },
    enabled: !!user,
  });

  // All transactions for the selected week (for leaderboards/crew)
  const allWeekQuery = useQuery({
    queryKey: ["sales-transactions", "all", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_transactions")
        .select("id, user_id, date, week_start, age_band, ask_amount, isa_upfront, owner_upfront, total_wire, quality_pending, created_at")
        .gte("date", weekStart)
        .lte("date", weekEnd);
      if (error) throw error;
      return (data ?? []) as SalesTransaction[];
    },
    enabled: !!user,
  });

  const insertTransaction = useMutation({
    mutationFn: async (tx: {
      date: string;
      ageBand: string;
      askAmount: number;
      isaUpfront: number;
      ownerUpfront: number;
      totalWire: number;
      qualityPending: number;
    }) => {
      const ws = format(startOfWeek(new Date(tx.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const { error } = await supabase.from("sales_transactions").insert({
        user_id: user!.id,
        date: tx.date,
        week_start: ws,
        age_band: tx.ageBand,
        ask_amount: tx.askAmount,
        isa_upfront: tx.isaUpfront,
        owner_upfront: tx.ownerUpfront,
        total_wire: tx.totalWire,
        quality_pending: tx.qualityPending,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
    },
  });

  const deleteTransactionsForDate = useMutation({
    mutationFn: async ({ date, count }: { date: string; count: number }) => {
      // Delete the newest `count` transactions for this date
      const { data: txs, error: fetchErr } = await supabase
        .from("sales_transactions")
        .select("id")
        .eq("user_id", user!.id)
        .eq("date", date)
        .order("created_at", { ascending: false })
        .limit(count);
      if (fetchErr) throw fetchErr;
      if (txs && txs.length > 0) {
        const ids = txs.map((t) => t.id);
        const { error } = await supabase
          .from("sales_transactions")
          .delete()
          .in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
    },
  });

  // Get transactions for a specific date
  function getTransactionsForDate(date: string): SalesTransaction[] {
    return (ownQuery.data || []).filter((t) => t.date === date);
  }

  // Sum totals for the week
  function getWeekFinancials(transactions: SalesTransaction[] = ownQuery.data || []) {
    return transactions.reduce(
      (acc, t) => ({
        repProfit: acc.repProfit + getAdjustedRepProfit(t),
        isaUpfront: acc.isaUpfront + Number(t.isa_upfront),
        totalWire: acc.totalWire + Number(t.total_wire),
        qualityPending: acc.qualityPending + Number(t.quality_pending),
        count: acc.count + 1,
      }),
      { repProfit: 0, isaUpfront: 0, totalWire: 0, qualityPending: 0, count: 0 }
    );
  }

  return {
    ownTransactions: ownQuery.data || [],
    allWeekTransactions: allWeekQuery.data || [],
    isLoading: ownQuery.isLoading,
    insertTransaction,
    deleteTransactionsForDate,
    getTransactionsForDate,
    getWeekFinancials,
  };
}
