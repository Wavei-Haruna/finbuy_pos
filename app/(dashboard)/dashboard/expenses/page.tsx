'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { ExpenseForm } from './ExpenseForm';
import {
  Banknote, Loader2, Receipt, Trash2, X, Check, Repeat, Pencil, ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Period = 'week' | 'month' | 'year' | 'all';

const fmt = (v: number) => `₵${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  salaries:    '#ef4444',
 damages:     '#f97316',
  rent:        '#f59e0b',
  utilities:   '#06b6d4',
  supplies:    '#3b82f6',
  marketing:   '#a855f7',
  transport:   '#22c55e',
  maintenance: '#eab308',
  other:       '#6b7280',
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();

  // Staff sign in via a business-code session and have no `user` object at
  // all (see sales page) — only a Firebase-authed admin/manager should see
  // this page, since salaries live here.
  const canView = !!user && (user.role === 'admin' || user.role === 'manager');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBusiness && canView) fetchExpenses();
    else setLoading(false);
  }, [activeBusiness, canView]);

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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

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
  const sortedCategories = Object.entries(categoryBreakdown).sort(([, a], [, b]) => b - a);

  const recurringCount = expenses.filter((e) => e.frequency !== 'one-time' && !e.endDate).length;
  const salariesTotal = categoryBreakdown.salaries ?? 0;

  const handleSubmit = async (data: {
    category: ExpenseCategory; description: string; amount: number;
    frequency: Expense['frequency']; startDate: Date; endDate: Date | null;
  }) => {
    if (!activeBusiness) return;
    setSubmitting(true);
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), { ...data });
        setExpenses((prev) => prev.map((e) => e.id === editingExpense.id ? { ...e, ...data } : e));
        setEditingExpense(null);
        setSuccessMsg('Expense updated!');
      } else {
        const ref = await addDoc(collection(db, 'expenses'), {
          ...data,
          businessId: activeBusiness.id,
          recordedBy: user?.name || 'Admin',
          createdAt: new Date(),
        });
        setExpenses((prev) => [{ id: ref.id, ...data, businessId: activeBusiness.id, recordedBy: user?.name || 'Admin', createdAt: new Date() }, ...prev]);
        setSuccessMsg('Expense added!');
      }
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (e) {
      console.error(e);
      alert('Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    setDeletingId(expense.id);
    try {
      await deleteDoc(doc(db, 'expenses', expense.id));
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  if (!canView) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500">Restricted</p>
          <p className="text-xs text-gray-400 mt-1">Expenses (including salaries) are only visible to admins and managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-red-500 via-red-400 to-transparent" />

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-red-500 uppercase tracking-[0.15em] mb-1">
              Expenses · <span className="text-gray-400 font-normal">{activeBusiness?.name ?? '—'}</span>
            </p>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              Expenses<span className="text-gray-300 dark:text-gray-600">.</span>
            </h1>
          </div>

          {/* Period tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 self-start">
            {(['week', 'month', 'year', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                  period === p ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                {p === 'all' ? 'All Time' : `This ${p}`}
              </button>
            ))}
          </div>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex flex-wrap gap-3">
          {[
            { label: `Total (${period === 'all' ? 'all time' : `this ${period}`})`, value: fmt(periodTotal), icon: Banknote, color: 'text-red-500',    bg: 'bg-red-500/8 border-red-500/15' },
            { label: 'Salaries & Wages',    value: fmt(salariesTotal),               icon: Receipt,  color: 'text-orange-500', bg: 'bg-orange-500/8 border-orange-500/15' },
            { label: 'Active Recurring',    value: recurringCount,                    icon: Repeat,   color: 'text-purple-500', bg: 'bg-purple-500/8 border-purple-500/15' },
            { label: 'Total Entries',       value: expenses.length,                   icon: Banknote, color: 'text-gray-500',   bg: 'bg-gray-500/8 border-gray-500/15' },
          ].map((s) => (
            <div key={s.label} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${s.bg} bg-white dark:bg-gray-900`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">{s.label}</p>
                <p className="text-sm font-black text-gray-900 dark:text-white leading-none">{s.value}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-5">

          {/* Form — left */}
          <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sticky top-4">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-500 rounded-full" />
                <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                  {editingExpense ? 'Edit Expense' : 'New Expense'}
                </h2>
              </div>
              <div className="p-4">
                <ExpenseForm
                  editingExpense={editingExpense}
                  submitting={submitting}
                  successMessage={successMsg}
                  onSubmit={handleSubmit}
                  onCancelEdit={() => setEditingExpense(null)}
                />
              </div>
            </div>

            {/* Category breakdown */}
            {sortedCategories.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Breakdown by Category</h3>
                <div className="space-y-2.5">
                  {sortedCategories.map(([cat, amt]) => {
                    const pct = periodTotal > 0 ? (amt / periodTotal) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory]}
                          </span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{fmt(amt)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat as ExpenseCategory] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Expense list — right */}
          <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-5 bg-yellow-400 rounded-full" />
                  <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">All Expenses</h2>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {expenses.length} total
                </span>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
                  <p className="text-sm text-gray-400">Loading…</p>
                </div>
              ) : !activeBusiness ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Banknote className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-semibold text-gray-400">No business selected</p>
                </div>
              ) : expenses.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
                  <Banknote className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-semibold text-gray-400">No expenses recorded yet</p>
                  <p className="text-xs text-gray-400">Add staff salaries, rent, or other costs to get accurate profit numbers</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-900 max-h-[720px] overflow-y-auto">
                  {expenses.map((exp, i) => {
                    const isEnded = exp.frequency !== 'one-time' && exp.endDate && exp.endDate < new Date();
                    return (
                      <motion.div
                        key={exp.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${CATEGORY_COLORS[exp.category]}18` }}
                        >
                          <Banknote className="w-4 h-4" style={{ color: CATEGORY_COLORS[exp.category] }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{exp.description}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                              {EXPENSE_CATEGORY_LABELS[exp.category]}
                            </span>
                            {exp.frequency !== 'one-time' && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                isEnded ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              }`}>
                                <Repeat className="w-2.5 h-2.5" /> {exp.frequency}{isEnded ? ' · ended' : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {exp.frequency === 'one-time'
                              ? exp.startDate.toLocaleDateString()
                              : `Since ${exp.startDate.toLocaleDateString()}${exp.endDate ? ` → ${exp.endDate.toLocaleDateString()}` : ' · ongoing'}`}
                            {' · '}by {exp.recordedBy}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <p className="font-black text-red-500 text-sm">{fmt(exp.amount)}</p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingExpense(exp)}
                              className="w-6 h-6 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-500/10 flex items-center justify-center transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteId === exp.id ? (
                              <>
                                <button
                                  onClick={() => handleDelete(exp)}
                                  disabled={deletingId === exp.id}
                                  className="w-6 h-6 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center disabled:opacity-50"
                                >
                                  {deletingId === exp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(exp.id)}
                                className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}