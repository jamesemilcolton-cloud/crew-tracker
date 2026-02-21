import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, endOfWeek, subWeeks, format, addDays } from "date-fns";

export interface SalesEntry {
  id: string;
  user_id: string;
  entry_date: string;
  doors: number;
  spoken: number;
  presentations: number;
  closes: number;
  tablets: number;
  sales: number;
}

interface DayData {
  doors: number;
  spoken: number;
  presentations: number;
  closes: number;
  tablets: number;
  sales: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

export function useSalesData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Current week entries for the user
  const currentWeekQuery = useQuery({
    queryKey: ["sales-entries", "current-week", user?.id],
    queryFn: async () => {
      const ws = format(getWeekStart(), "yyyy-MM-dd");
      const we = format(getWeekEnd(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("sales_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("entry_date", ws)
        .lte("entry_date", we);
      if (error) throw error;
      return data as SalesEntry[];
    },
    enabled: !!user,
  });

  // All historical entries for LOA progression + personal best
  const historicalQuery = useQuery({
    queryKey: ["sales-entries", "all-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select("*")
        .eq("user_id", user!.id)
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return data as SalesEntry[];
    },
    enabled: !!user,
  });

  // All entries for team view (leaders/managers)
  const teamQuery = useQuery({
    queryKey: ["sales-entries", "team"],
    queryFn: async () => {
      const ws = format(getWeekStart(), "yyyy-MM-dd");
      const we = format(getWeekEnd(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("sales_entries")
        .select("*")
        .gte("entry_date", ws)
        .lte("entry_date", we);
      if (error) throw error;
      return data as SalesEntry[];
    },
    enabled: !!user,
  });

  // Profiles for team view
  const profilesQuery = useQuery({
    queryKey: ["profiles-for-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, user_id, full_name, leader_id");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveDayMutation = useMutation({
    mutationFn: async ({ date, data }: { date: string; data: DayData }) => {
      const { data: existing } = await supabase
        .from("sales_entries")
        .select("id")
        .eq("user_id", user!.id)
        .eq("entry_date", date)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("sales_entries")
          .update({ ...data })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sales_entries")
          .insert({ user_id: user!.id, entry_date: date, ...data });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-entries"] });
    },
  });

  // Helpers
  function getDateForDay(dayIndex: number): string {
    return format(addDays(getWeekStart(), dayIndex), "yyyy-MM-dd");
  }

  function getEntryForDate(date: string): SalesEntry | undefined {
    return currentWeekQuery.data?.find((e) => e.entry_date === date);
  }

  function getWeekTotals(entries: SalesEntry[] = []): DayData {
    return entries.reduce(
      (acc, e) => ({
        doors: acc.doors + e.doors,
        spoken: acc.spoken + e.spoken,
        presentations: acc.presentations + e.presentations,
        closes: acc.closes + e.closes,
        tablets: acc.tablets + e.tablets,
        sales: acc.sales + e.sales,
      }),
      { doors: 0, spoken: 0, presentations: 0, closes: 0, tablets: 0, sales: 0 }
    );
  }

  function calcLOA(spoken: number, sales: number): string {
    if (sales === 0) return "–";
    return `${Math.round(spoken / sales)} : 1`;
  }

  function calcCloseLOA(closes: number, sales: number): string {
    if (sales === 0) return "–";
    return `${Math.round(closes / sales)} : 1`;
  }

  function getWeeklyLOAData() {
    const allEntries = historicalQuery.data || [];
    const weeks: { label: string; loa: number | null }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = getWeekStart(subWeeks(new Date(), i));
      const we = getWeekEnd(subWeeks(new Date(), i));
      const wsStr = format(ws, "yyyy-MM-dd");
      const weStr = format(we, "yyyy-MM-dd");
      const weekEntries = allEntries.filter(
        (e) => e.entry_date >= wsStr && e.entry_date <= weStr
      );
      const totals = getWeekTotals(weekEntries);
      weeks.push({
        label: format(ws, "dd/MM"),
        loa: totals.sales > 0 ? Math.round(totals.spoken / totals.sales) : null,
      });
    }
    return weeks;
  }

  // Previous week totals for comparison
  function getPrevWeekTotals(): DayData {
    const ws = format(getWeekStart(subWeeks(new Date(), 1)), "yyyy-MM-dd");
    const we = format(getWeekEnd(subWeeks(new Date(), 1)), "yyyy-MM-dd");
    const entries = (historicalQuery.data || []).filter(
      (e) => e.entry_date >= ws && e.entry_date <= we
    );
    return getWeekTotals(entries);
  }

  // Personal Best: highest weekly sales across all history
  function getPersonalBestSales(): number | null {
    const allEntries = historicalQuery.data || [];
    if (allEntries.length === 0) return null;

    // Find earliest and latest dates to determine week range
    const dates = allEntries.map((e) => e.entry_date).sort();
    const earliest = new Date(dates[0]);
    const latest = new Date(dates[dates.length - 1]);

    let best = 0;
    let weekStart = getWeekStart(earliest);

    while (weekStart <= latest) {
      const wsStr = format(weekStart, "yyyy-MM-dd");
      const weStr = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEntries = allEntries.filter(
        (e) => e.entry_date >= wsStr && e.entry_date <= weStr
      );
      const totalSales = weekEntries.reduce((sum, e) => sum + e.sales, 0);
      if (totalSales > best) best = totalSales;
      weekStart = addDays(weekStart, 7);
    }

    return best > 0 ? best : null;
  }

  return {
    currentWeekEntries: currentWeekQuery.data || [],
    historicalEntries: historicalQuery.data || [],
    teamEntries: teamQuery.data || [],
    profiles: profilesQuery.data || [],
    isLoading: currentWeekQuery.isLoading,
    saveDayMutation,
    getDateForDay,
    getEntryForDate,
    getWeekTotals,
    calcLOA,
    calcCloseLOA,
    getWeeklyLOAData,
    getPrevWeekTotals,
    getPersonalBestSales,
    DAYS,
  };
}
