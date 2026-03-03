import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Central calendar-week utility.
 * Weeks are always Monday 00:00 → Sunday 23:59:59.999.
 *
 * @param weekOffset  0 = current week, -1 = previous week, etc.
 */
export function getCalendarWeekBounds(weekOffset: number = 0) {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  if (weekOffset !== 0) {
    monday.setDate(monday.getDate() + weekOffset * 7);
  }
  monday.setHours(0, 0, 0, 0);
  const sunday = endOfWeek(monday, { weekStartsOn: 1 });
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/** Formatted strings (yyyy-MM-dd) for DB queries */
export function getCalendarWeekStrings(weekOffset: number = 0) {
  const { start, end } = getCalendarWeekBounds(weekOffset);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    startDate: start,
    endDate: end,
  };
}

/**
 * Get the Monday-Sunday bounds for a range of N whole calendar weeks
 * ending at the previous week (excludes current week).
 */
export function getLastNWeeksBounds(n: number) {
  // Start = Monday (n) weeks ago
  const now = new Date();
  const currentMonday = startOfWeek(now, { weekStartsOn: 1 });
  const rangeStart = subWeeks(currentMonday, n);
  rangeStart.setHours(0, 0, 0, 0);
  // End = Sunday of previous week
  const prevSunday = new Date(currentMonday);
  prevSunday.setDate(currentMonday.getDate() - 1);
  prevSunday.setHours(23, 59, 59, 999);
  return { start: rangeStart, end: prevSunday };
}

/**
 * Given any date, return the Monday of that date's calendar week.
 */
export function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}
