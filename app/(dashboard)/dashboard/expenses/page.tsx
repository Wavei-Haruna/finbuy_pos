'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  query, where,
} from 'firebase/firestore';
import { Expense, ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '@/lib/types';
import {
  startOfDay, startOfWeek, startOfMonth, startOfYear, addDays,
  totalExpensesInPeriod, expensesByCategory,
} from './expense-utils';
import { ExpenseForm, CATEGORY_COLORS } from './ExpenseForm';
import {
  Banknote, Loader2, Trash2, X, Check, Repeat, Pencil, ShieldAlert,
  Wallet, PieChart, ChevronDown, AlertCircle, Receipt,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ───────────────────────── helpers ───────────────────────── */

type Period = 'week' | 'month' | 'year' | 'all';

const PAGE_SIZE = 50;
const LIME = 'hsl(var(--brand-lime))';
const LEAF = 'hsl(var(--brand-leaf))';
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

const fmt = (v: number) => `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
const dateOf = (d: Date) => d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });

const PERIOD_LABEL: Record<Period, string> = {
  week: 'This week', month: 'This month', year: 'This year', all: 'All time',
};
const PERIOD_SHORT: Record<Period, string> = { week: 'Week', month: 'Month', year: 'Year', all: 'All' };
const PREV_LABEL: Record<Period, string> = { week: 'last week', month: 'last month', year: 'last year', all: '' };

const FREQ_SUFFIX: Record<string, string> = { weekly: '/wk', monthly: '/mo', yearly: '/yr' };
const FREQ_LABEL:  Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

/* ───────────────────────── page ───────────────────────── */

export default function ExpensesPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();

  // Staff sign in via a business-code session and have no `user` object at
  // all (see sales page). Only a Firebase-authed admin/manager should see
  // this page, since salaries live here.
  const canView = !!user && (user.role === 'admin' || user.role === 'manager');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [listError, setListError] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [filterCat, setFilterCat] = useState<ExpenseCategory | 'all'>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeBusiness && canView) fetchExpenses();
    else setLoading(false);
  }, [activeBusiness, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExpenses = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'expenses'), where('businessId', '==', activeBusiness.id)));
      const data = snap.docs.map((d) => ({
        id: d.id, ...d.data(),
        startDate: d.data().startDate?.toDate() || new Date(),
        endDate:   d.data().endDate?.toDate() || null,
        createdAt: d.data().createdAt?.toDate() || new Date(),
      })) as Expense[];
      data.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      setExpenses(data);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error(e);
      setListError('Could not load your expenses. Check your connection and refresh.');
    } finally { setLoading(false); }
  };

  /* ── period maths ── */
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    const end = addDays(startOfDay(now), 1); // through end of today
    switch (period) {
      case 'week':  return { periodStart: startOfWeek(now),  periodEnd: end };
      case 'month': return { periodStart: startOfMonth(now), periodEnd: end };
      case 'year':  return { periodStart: startOfYear(now),  periodEnd: end };
      default:      return { periodStart: new Date(2000, 0, 1), periodEnd: end };
    }
  }, [period]);

  const periodTotal = useMemo(() => totalExpensesInPeriod(expenses, periodStart, periodEnd), [expenses, periodStart, periodEnd]);
  const categoryBreakdown = useMemo(() => expensesByCategory(expenses, periodStart, periodEnd), [expenses, periodStart, periodEnd]);
  const sortedCategories = useMemo(
    () => Object.entries(categoryBreakdown).filter(([, a]) => a > 0).sort(([, a], [, b]) => b - a),
    [categoryBreakdown],
  );
  const salariesTotal = categoryBreakdown.salaries ?? 0;

  // The full previous period, shown as a plain reference number (not a % change,
  // because the current period isn't finished yet).
  const prevTotal = useMemo(() => {
    if (period === 'all') return null;
    const now = new Date();
    const prevStart =
      period === 'week'  ? addDays(periodStart, -7) :
      period === 'month' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) :
                           new Date(now.getFullYear() - 1, 0, 1);
    return totalExpensesInPeriod(expenses, prevStart, periodStart);
  }, [expenses, period, periodStart]);

  // Fixed costs: recurring expenses that have not ended, as a monthly figure
  const { fixedPerMonth, recurringCount } = useMemo(() => {
    const now = new Date();
    const active = expenses.filter((e) => e.frequency !== 'one-time' && (!e.endDate || e.endDate >= now));
    const monthly = active.reduce((s, e) => {
      if (e.frequency === 'weekly') return s + (e.amount * 52) / 12;
      if (e.frequency === 'yearly') return s + e.amount / 12;
      return s + e.amount;
    }, 0);
    return { fixedPerMonth: monthly, recurringCount: active.length };
  }, [expenses]);

  const visibleExpenses = useMemo(
    () => (filterCat === 'all' ? expenses : expenses.filter((e) => e.category === filterCat)),
    [expenses, filterCat],
  );
  const shown     = visibleExpenses.slice(0, visible);
  const remaining = visibleExpenses.length - shown.length;

  const usedCategories = useMemo(() => {
    const counts = new Map<ExpenseCategory, number>();
    for (const e of expenses) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  /* ── actions ── */
  const startEditing = (exp: Expense) => {
    setEditingExpense(exp);
    setSubmitError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Resolves true only when saved, so the form keeps what was typed if it wasn't. */
  const handleSubmit = async (data: {
    category: ExpenseCategory; description: string; amount: number;
    frequency: Expense['frequency']; startDate: Date; endDate: Date | null;
  }): Promise<boolean> => {
    if (!activeBusiness) return false;
    setSubmitting(true);
    setSubmitError('');
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), { ...data });
        setExpenses((prev) => prev.map((e) => e.id === editingExpense.id ? { ...e, ...data } : e));
        setEditingExpense(null);
        setSuccessMsg('Expense updated');
      } else {
        const recordedBy = user?.name || 'Admin';
        const createdAt = new Date();
        const ref = await addDoc(collection(db, 'expenses'), {
          ...data,
          businessId: activeBusiness.id,
          recordedBy,
          createdAt,
        });
        setExpenses((prev) => [
          { id: ref.id, ...data, businessId: activeBusiness.id, recordedBy, createdAt } as Expense,
          ...prev,
        ]);
        setSuccessMsg('Expense added');
      }
      setTimeout(() => setSuccessMsg(''), 2500);
      return true;
    } catch (e: any) {
      console.error(e);
      setSubmitError(e?.message || 'Could not save the expense. Nothing was changed, please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    setDeletingId(expense.id);
    setListError('');
    try {
      await deleteDoc(doc(db, 'expenses', expense.id));
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      if (editingExpense?.id === expense.id) setEditingExpense(null);
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      setListError('Could not delete that expense. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  /* ── restricted ── */
  if (!canView) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
            style={{ background: tint(LIME, 18) }}>
            <ShieldAlert className="h-7 w-7" />
          </span>
          <p className="font-heading text-base font-semibold">Admins and managers only</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Expenses, including salaries, are private. Ask an admin if you need to see them.
          </p>
        </div>
      </div>
    );
  }

  const topCategory = sortedCategories[0];
  const breakdownTop = sortedCategories.slice(0, 5);
  const breakdownMore = sortedCategories.length - breakdownTop.length;

  const renderActions = (exp: Expense) => (
    confirmDeleteId === exp.id ? (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Delete expense?</span>
        <button onClick={() => handleDelete(exp)} disabled={deletingId === exp.id} aria-label="Confirm delete"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-50">
          {deletingId === exp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button onClick={() => setConfirmDeleteId(null)} disabled={deletingId === exp.id} aria-label="Cancel delete"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <button onClick={() => startEditing(exp)} aria-label={`Edit ${exp.description}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={() => setConfirmDeleteId(exp.id)} aria-label={`Delete ${exp.description}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )
  );

  /* ─────────────────────── render ─────────────────────── */
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] space-y-4 px-3 py-4 sm:px-4 lg:px-6">

        {/* Header line + period tabs */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5 px-1 text-sm">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: LEAF }} />
            <span className="truncate font-semibold">{activeBusiness?.name ?? 'No business selected'}</span>
            <span className="hidden text-muted-foreground sm:inline">· Everything your business spends</span>
          </div>

          <div role="tablist" aria-label="Period"
            className="grid grid-cols-4 rounded-full border border-border bg-muted/50 p-0.5 sm:inline-grid sm:w-auto">
            {(['week', 'month', 'year', 'all'] as Period[]).map((p) => (
              <button key={p} role="tab" aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={`h-9 rounded-full px-4 text-[13px] font-medium transition-all ${
                  period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <span className="sm:hidden">{PERIOD_SHORT[p]}</span>
                <span className="hidden sm:inline">{PERIOD_LABEL[p]}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid gap-4 lg:grid-cols-3">

          {/* Money out hero */}
          <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm sm:p-6 lg:col-span-2"
            style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)), hsl(var(--brand-forest)))' }}>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: LIME }} />

            <div className="relative flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Money out · {PERIOD_LABEL[period].toLowerCase()}
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint(LIME, 18) }}>
                <Wallet className="h-[18px] w-[18px]" style={{ color: LIME }} />
              </span>
            </div>

            <div className="relative mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="font-heading text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                <span className="mr-0.5 text-2xl text-white/60 sm:text-3xl">₵</span>
                {periodTotal.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
              </p>
              {prevTotal !== null && (
                <span className="mb-1.5 text-xs text-white/55">
                  {fmt(prevTotal)} {PREV_LABEL[period]}
                </span>
              )}
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              {[
                { label: 'Salaries & wages', value: fmt(salariesTotal) },
                { label: `Fixed costs · ${recurringCount} recurring`, value: `${fmt(fixedPerMonth)}/mo` },
                { label: 'Biggest cost', value: topCategory ? EXPENSE_CATEGORY_LABELS[topCategory[0] as ExpenseCategory] : '—' },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <p className="truncate text-[11px] text-white/55">{s.label}</p>
                  <p className="mt-0.5 truncate font-heading text-lg font-semibold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Where the money went */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Where it went</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                style={{ background: tint(LIME, 18) }}>
                <PieChart className="h-[18px] w-[18px]" />
              </span>
            </div>

            {breakdownTop.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nothing spent {period === 'all' ? 'yet' : PERIOD_LABEL[period].toLowerCase()}.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {breakdownTop.map(([cat, amt]) => {
                  const pct = periodTotal > 0 ? (amt / periodTotal) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[cat as ExpenseCategory] }} />
                          <span className="truncate">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory]}</span>
                        </span>
                        <span className="flex-shrink-0 text-[13px] font-semibold tabular-nums">
                          {fmt(amt)} <span className="font-normal text-muted-foreground">· {Math.round(pct)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat as ExpenseCategory] }} />
                      </div>
                    </div>
                  );
                })}
                {breakdownMore > 0 && (
                  <p className="text-xs text-muted-foreground">+ {breakdownMore} more categor{breakdownMore !== 1 ? 'ies' : 'y'}</p>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-5 lg:items-start">

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2">
            <section ref={formRef} className="scroll-mt-4 rounded-2xl border border-border bg-card shadow-sm">
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                  style={{ background: tint(LIME, 18) }}>
                  {editingExpense ? <Pencil className="h-[18px] w-[18px]" /> : <Banknote className="h-[18px] w-[18px]" />}
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-[15px] font-semibold leading-tight">
                    {editingExpense ? 'Edit expense' : 'New expense'}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {editingExpense ? 'Change what’s wrong, then update.' : 'Salaries, rent, bills and everything else.'}
                  </p>
                </div>
              </header>
              <div className="p-4">
                <ExpenseForm
                  editingExpense={editingExpense}
                  submitting={submitting}
                  successMessage={successMsg}
                  errorMessage={submitError}
                  onSubmit={handleSubmit}
                  onCancelEdit={() => { setEditingExpense(null); setSubmitError(''); }}
                />
              </div>
            </section>
          </motion.div>

          {/* List */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-3">
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <header className="space-y-3 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                      style={{ background: tint(LIME, 18) }}>
                      <Receipt className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-heading text-[15px] font-semibold leading-tight">All expenses</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Newest first</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                    {visibleExpenses.length} of {expenses.length}
                  </span>
                </div>

                {usedCategories.length > 1 && (
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {([['all', expenses.length], ...usedCategories] as [ExpenseCategory | 'all', number][]).map(([c, n]) => {
                      const active = filterCat === c;
                      const color  = c === 'all' ? undefined : CATEGORY_COLORS[c];
                      return (
                        <button key={c} onClick={() => { setFilterCat(c); setVisible(PAGE_SIZE); }}
                          className={`inline-flex h-9 flex-shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all ${
                            active
                              ? (color ? 'text-foreground' : 'border-primary bg-primary text-primary-foreground')
                              : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
                          style={active && color ? { background: tint(color, 14), borderColor: color } : undefined}>
                          {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
                          {c === 'all' ? 'All' : EXPENSE_CATEGORY_LABELS[c]}
                          <span className="text-[11px] tabular-nums opacity-60">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </header>

              <AnimatePresence>
                {listError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
                      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 flex-shrink-0" />{listError}</span>
                      <button onClick={() => setListError('')} aria-label="Dismiss" className="p-1 hover:opacity-70"><X className="h-4 w-4" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loading ? (
                <div className="divide-y divide-border" aria-busy="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : !activeBusiness ? (
                <EmptyState icon={Banknote} title="No business selected" body="Pick a business from the sidebar to see its expenses." />
              ) : expenses.length === 0 ? (
                <EmptyState icon={Banknote} title="No expenses recorded yet"
                  body="Add salaries, rent and other costs to see your real profit." />
              ) : shown.length === 0 ? (
                <EmptyState icon={Banknote} title="Nothing in this category" body="Try another category or show all."
                  action={{ label: 'Show all expenses', onClick: () => setFilterCat('all') }} />
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {shown.map((exp) => {
                      const recurring = exp.frequency !== 'one-time';
                      const isEnded = recurring && !!exp.endDate && exp.endDate < new Date();
                      const color = CATEGORY_COLORS[exp.category];
                      const isEditing = editingExpense?.id === exp.id;
                      return (
                        <div key={exp.id}
                          className={`px-4 py-3.5 transition-colors ${isEditing ? 'bg-[hsl(var(--brand-lime)/0.08)]' : 'hover:bg-muted/30'}`}>
                          <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                              style={{ background: tint(color, 14) }}>
                              <Banknote className="h-[18px] w-[18px]" style={{ color }} />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{exp.description}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  style={{ background: tint(color, 14) }}>
                                  {EXPENSE_CATEGORY_LABELS[exp.category]}
                                </span>
                                {recurring && (
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    isEnded ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                    <Repeat className="h-2.5 w-2.5" />{FREQ_LABEL[exp.frequency] ?? exp.frequency}{isEnded ? ' · ended' : ''}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-[11px] text-muted-foreground">
                                {recurring
                                  ? `Since ${dateOf(exp.startDate)}${exp.endDate ? ` → ${dateOf(exp.endDate)}` : ' · ongoing'}`
                                  : dateOf(exp.startDate)}
                                {' · by '}{exp.recordedBy}
                              </p>
                            </div>

                            <p className="flex-shrink-0 text-right font-heading text-base font-semibold tabular-nums text-red-500">
                              {fmt(exp.amount)}
                              {recurring && <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">{FREQ_SUFFIX[exp.frequency]}</span>}
                            </p>
                          </div>
                          <div className="mt-2 flex justify-end">{renderActions(exp)}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-border">
                    {remaining > 0 && (
                      <div className="border-b border-border px-4 py-3">
                        <button onClick={() => setVisible((v) => v + PAGE_SIZE)}
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--brand-leaf))] hover:text-foreground">
                          <ChevronDown className="h-4 w-4" />
                          Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} remaining
                        </button>
                      </div>
                    )}
                    <div className="bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                      Showing <span className="font-semibold text-foreground">{shown.length}</span> of{' '}
                      <span className="font-semibold text-foreground">{visibleExpenses.length}</span> expenses
                    </div>
                  </div>
                </>
              )}
            </section>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── empty state ───────────────────────── */

function EmptyState({ icon: Icon, title, body, action }: {
  icon: React.ElementType; title: string; body: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
        style={{ background: tint(LIME, 18) }}>
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-heading text-[15px] font-semibold">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      </div>
      {action && (
        <button onClick={action.onClick}
          className="mt-1 inline-flex h-10 items-center rounded-xl border border-border bg-background px-4 text-[13px] font-medium transition-colors hover:bg-accent">
          {action.label}
        </button>
      )}
    </div>
  );
}