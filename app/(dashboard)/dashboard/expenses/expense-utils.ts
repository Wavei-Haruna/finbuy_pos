
// ── DATE HELPERS ─────────────────────────────────────────────────────────────

import { Expense, ExpenseCategory } from "@/lib/types";

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function startOfDay(d = new Date()): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
export function startOfWeek(d = new Date()): Date {
  // Monday-start week
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x;
}
export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function startOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

// ── ACCRUAL MATH ─────────────────────────────────────────────────────────────
// A one-time expense counts in full on the day it happened. A recurring
// expense (weekly/monthly/yearly) is prorated to a daily rate and spread
// across however much of the period has actually elapsed — so "this month"
// numbers are accurate on the 3rd of the month, not just on the 30th.

export function expenseAmountInPeriod(expense: Expense, periodStart: Date, periodEnd: Date): number {
  const start = expense.startDate;

  if (expense.frequency === 'one-time') {
    return start >= periodStart && start < periodEnd ? expense.amount : 0;
  }

  const end = expense.endDate ?? periodEnd;
  const effectiveStart = start > periodStart ? start : periodStart;
  const effectiveEnd = end < periodEnd ? end : periodEnd;
  if (effectiveEnd <= effectiveStart) return 0;

  const dailyRate =
    expense.frequency === 'weekly'  ? expense.amount / 7 :
    expense.frequency === 'monthly' ? expense.amount / daysInMonth(effectiveStart) :
    /* yearly */                      expense.amount / 365;

  return dailyRate * daysBetween(effectiveStart, effectiveEnd);
}

export function totalExpensesInPeriod(expenses: Expense[], periodStart: Date, periodEnd: Date): number {
  return expenses.reduce((sum, e) => sum + expenseAmountInPeriod(e, periodStart, periodEnd), 0);
}

export function expensesByCategory(
  expenses: Expense[],
  periodStart: Date,
  periodEnd: Date
): Partial<Record<ExpenseCategory, number>> {
  const map: Partial<Record<ExpenseCategory, number>> = {};
  expenses.forEach((e) => {
    const amt = expenseAmountInPeriod(e, periodStart, periodEnd);
    if (amt > 0) map[e.category] = (map[e.category] ?? 0) + amt;
  });
  return map;
}

// Convenience: today's accrued share of all expenses (recurring prorated to 1 day).
export function expensesToday(expenses: Expense[]): number {
  const today = startOfDay();
  return totalExpensesInPeriod(expenses, today, addDays(today, 1));
}

export function expensesThisMonth(expenses: Expense[]): number {
  const start = startOfMonth();
  return totalExpensesInPeriod(expenses, start, addDays(new Date(), 1));
}
