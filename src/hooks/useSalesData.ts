import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { subWeeks, format, addDays, addWeeks } from "date-fns";
import { getCalendarWeekBounds, getMondayOfWeek } from "@/lib/utils";

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

function getWeekStartForOffset(offset: number): Date {
  return getCalendarWeekBounds(offset).start;
}

function getWeekEndForOffset(offset: number): Date {
  return getCalendarWeekBounds(offset).end;
}

export function useSalesData(weekOffset: number = 0) {
  const { user } = useAuth();
  const { profiles: sharedProfiles } = useProfiles();
  const queryClient = useQueryClient();

  const selectedWeekStart = getWeekStartForOffset(weekOffset);
  const selectedWeekEnd = getWeekEndForOffset(weekOffset);
  const wsStr = format(selectedWeekStart, "yyyy-MM-dd");
  const weStr = format(selectedWeekEnd, "yyyy-MM-dd");

  // Selected week entries for the user
  const currentWeekQuery = useQuery({
    queryKey: ["sales-entries", "week", wsStr, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("entry_date", wsStr)
        .lte("entry_date", weStr);
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

  // Team entries for the selected week
  const teamQuery = useQuery({
    queryKey: ["sales-entries", "team", wsStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select("*")
        .gte("entry_date", wsStr)
        .lte("entry_date", weStr);
      if (error) throw error;
      return data as SalesEntry[];
    },
    enabled: !!user,
  });

  // Profiles from shared context - no separate query needed

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
    return format(addDays(selectedWeekStart, dayIndex), "yyyy-MM-dd");
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
      const { start: ws, end: we } = getCalendarWeekBounds(-i);
      const wsS = format(ws, "yyyy-MM-dd");
      const weS = format(we, "yyyy-MM-dd");
      const weekEntries = allEntries.filter(
        (e) => e.entry_date >= wsS && e.entry_date <= weS
      );
      const totals = getWeekTotals(weekEntries);
      weeks.push({
        label: format(ws, "dd/MM"),
        loa: totals.sales > 0 ? Math.round(totals.spoken / totals.sales) : null,
      });
    }
    return weeks;
  }

  // Previous week totals relative to selected week
  function getPrevWeekTotals(): DayData {
    const prevStart = subWeeks(selectedWeekStart, 1);
    const prevEnd = new Date(prevStart); prevEnd.setDate(prevStart.getDate() + 6); prevEnd.setHours(23,59,59,999);
    const ws = format(prevStart, "yyyy-MM-dd");
    const we = format(prevEnd, "yyyy-MM-dd");
    const entries = (historicalQuery.data || []).filter(
      (e) => e.entry_date >= ws && e.entry_date <= we
    );
    return getWeekTotals(entries);
  }

  // Personal Best: highest daily sales across all history, with that day's gauges
  function getPersonalBestDay(): { sales: number; doors: number; spoken: number; presentations: number; closes: number; tablets: number; date: string } | null {
    const allEntries = historicalQuery.data || [];
    if (allEntries.length === 0) return null;

    let best: typeof allEntries[0] | null = null;
    for (const e of allEntries) {
      if (!best || e.sales > best.sales) best = e;
    }

    if (!best || best.sales === 0) return null;
    return {
      sales: best.sales,
      doors: best.doors,
      spoken: best.spoken,
      presentations: best.presentations,
      closes: best.closes,
      tablets: best.tablets,
      date: best.entry_date,
    };
  }

  // Check if selected week is the current week
  const isCurrentWeek = weekOffset === 0;

  // Week label for header
  const weekLabel = format(selectedWeekStart, "EEEE d MMMM yyyy");

  return {
    currentWeekEntries: currentWeekQuery.data || [],
    historicalEntries: historicalQuery.data || [],
    teamEntries: teamQuery.data || [],
    profiles: sharedProfiles,
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
    isCurrentWeek,
    weekLabel,
    DAYS,
  };
}
