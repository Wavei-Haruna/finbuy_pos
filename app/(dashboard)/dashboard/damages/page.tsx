'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where, doc,
  runTransaction, increment,
} from 'firebase/firestore';
import { Product, DamageRecord } from '@/lib/types';
import { DamageForm } from './DamageForm';
import {
  PackageX, Loader2, Trash2, X, Check, ShieldAlert, Wallet, PieChart,
  Package, ChevronDown, AlertCircle, Receipt,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ───────────────────────── helpers ───────────────────────── */

type Period = 'week' | 'month' | 'year' | 'all';

const PAGE_SIZE = 50;
const LIME   = 'hsl(var(--brand-lime))';
const LEAF   = 'hsl(var(--brand-leaf))';
const ORANGE = '#f97316'; // damages colour, same as the "damages" category on the Expenses page
const tint   = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

const fmt = (v: number) => `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
const dateOf = (d: Date) => d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
const timeOf = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const PERIOD_LABEL: Record<Period, string> = { week: 'This week', month: 'This month', year: 'This year', all: 'All time' };
const PERIOD_SHORT: Record<Period, string> = { week: 'Week', month: 'Month', year: 'Year', all: 'All' };
const PREV_LABEL:   Record<Period, string> = { week: 'last week', month: 'last month', year: 'last year', all: '' };

const startOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek  = (d: Date) => { const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; }; // Monday
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear  = (d: Date) => new Date(d.getFullYear(), 0, 1);
const addDays      = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const sumLoss = (list: DamageRecord[], from: Date, to: Date) =>
  list.filter((d) => d.reportedAt >= from && d.reportedAt < to).reduce((s, d) => s + d.totalCost, 0);

/* ───────────────────────── page ───────────────────────── */

export default function DamagesPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();

  // Same restriction as Expenses: this affects stock and shows cost data.
  const canView = !!user && (user.role === 'admin' || user.role === 'manager');

  const [products, setProducts] = useState<Product[]>([]);
  const [damages, setDamages]   = useState<DamageRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [submitError, setSubmitError] = useState('');
  const [listError, setListError]     = useState('');
  const [period, setPeriod]       = useState<Period>('month');
  const [filterReason, setFilterReason] = useState<string>('all');
  const [visible, setVisible]     = useState(PAGE_SIZE);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBusiness && canView) fetchAll();
    else setLoading(false);
  }, [activeBusiness, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const [productsSnap, damagesSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))),
        getDocs(query(collection(db, 'damages'), where('businessId', '==', activeBusiness.id))),
      ]);

      const productsData = productsSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        dateAdded: d.data().dateAdded?.toDate() || new Date(),
        lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
      })) as Product[];

      const damagesData = damagesSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        reportedAt: d.data().reportedAt?.toDate() || new Date(),
      })) as DamageRecord[];
      damagesData.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());

      setProducts(productsData);
      setDamages(damagesData);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error(e);
      setListError('Could not load your damages. Check your connection and refresh.');
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

  const periodList = useMemo(
    () => damages.filter((d) => d.reportedAt >= periodStart && d.reportedAt < periodEnd),
    [damages, periodStart, periodEnd],
  );
  const periodLoss  = useMemo(() => periodList.reduce((s, d) => s + d.totalCost, 0), [periodList]);
  const periodUnits = useMemo(() => periodList.reduce((s, d) => s + d.quantity, 0), [periodList]);

  // The full previous period as a plain reference number (not a % change,
  // because the current period isn't finished yet).
  const prevLoss = useMemo(() => {
    if (period === 'all') return null;
    const now = new Date();
    const prevStart =
      period === 'week'  ? addDays(periodStart, -7) :
      period === 'month' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) :
                           new Date(now.getFullYear() - 1, 0, 1);
    return sumLoss(damages, prevStart, periodStart);
  }, [damages, period, periodStart]);

  const byReason = useMemo(() => {
    const map = new Map<string, { loss: number; units: number }>();
    for (const d of periodList) {
      const cur = map.get(d.reason) ?? { loss: 0, units: 0 };
      map.set(d.reason, { loss: cur.loss + d.totalCost, units: cur.units + d.quantity });
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => (b.loss - a.loss) || (b.units - a.units));
  }, [periodList]);
  const reasonTop  = byReason.slice(0, 5);
  const reasonMore = byReason.length - reasonTop.length;
  const maxUnits   = Math.max(1, ...byReason.map(([, v]) => v.units));

  /* ── list ── */
  const usedReasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of damages) counts.set(d.reason, (counts.get(d.reason) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [damages]);

  const filtered  = useMemo(
    () => (filterReason === 'all' ? damages : damages.filter((d) => d.reason === filterReason)),
    [damages, filterReason],
  );
  const shown     = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;

  const imageFor = (productId: string) => products.find((p) => p.id === productId)?.imageUrl;

  /* ── actions ── */
  /** Resolves true only when saved, so the form keeps what was typed if it wasn't. */
  const handleSubmit = async (data: { productId: string; quantity: number; reason: string; notes: string }): Promise<boolean> => {
    if (!activeBusiness) return false;
    setSubmitting(true);
    setSubmitError('');
    try {
      const productRef = doc(db, 'products', data.productId);
      const damageRef  = doc(collection(db, 'damages'));
      const expenseRef = doc(collection(db, 'expenses'));

      const damageDoc = await runTransaction(db, async (tx) => {
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists()) throw new Error('This product no longer exists.');
        const product = productSnap.data() as Product;

        if (data.quantity > product.quantity) {
          throw new Error(`Only ${product.quantity} in stock. Someone may have sold or damaged units since you opened this form.`);
        }

        const unitCost  = product.costPrice || 0;
        const totalCost = unitCost * data.quantity;
        const now = new Date();

        // 1. Decrement stock, the same way sales do.
        tx.update(productRef, { quantity: increment(-data.quantity), lastUpdated: now });

        // 2. Damage record. Snapshots the product name/sku so it still reads
        //    correctly even if the product is later renamed or deleted.
        const damagePayload = {
          businessId:  activeBusiness.id,
          productId:   data.productId,
          productName: product.name,
          productSku:  product.sku,
          quantity:    data.quantity,
          unitCost,
          totalCost,
          reason:      data.reason,
          expenseId:   expenseRef.id,
          reportedBy:  user?.name || 'Admin',
          reportedAt:  now,
          ...(data.notes ? { notes: data.notes } : {}),
        };
        tx.set(damageRef, damagePayload);

        // 3. Linked expense. Hits net profit through the normal Expenses flow.
        tx.set(expenseRef, {
          businessId:  activeBusiness.id,
          category:    'damages',
          description: `Damage: ${product.name} x${data.quantity} (${data.reason})`,
          amount:      totalCost,
          frequency:   'one-time',
          startDate:   now,
          endDate:     null,
          recordedBy:  user?.name || 'Admin',
          createdAt:   now,
          linkedDamageId: damageRef.id,
        });

        return { id: damageRef.id, ...damagePayload };
      });

      setDamages((prev) => [damageDoc as DamageRecord, ...prev]);
      setProducts((prev) => prev.map((p) => p.id === data.productId ? { ...p, quantity: p.quantity - data.quantity } : p));
      setSuccessMsg('Damage recorded. Stock and expenses are updated.');
      setTimeout(() => setSuccessMsg(''), 3000);
      return true;
    } catch (e: any) {
      console.error(e);
      setSubmitError(e?.message || 'Could not record the damage. Nothing was changed, please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Deleting a damage reverses both sides: restores stock and removes the linked
  // expense. There's no "edit". A damage is a physical fact, so if the quantity
  // or product was wrong, delete it and record a fresh one.
  const handleDelete = async (dmg: DamageRecord) => {
    setDeletingId(dmg.id);
    setListError('');
    try {
      const productRef = doc(db, 'products', dmg.productId);
      const damageRef  = doc(db, 'damages', dmg.id);
      const expenseRef = dmg.expenseId ? doc(db, 'expenses', dmg.expenseId) : null; // older records may not have one

      await runTransaction(db, async (tx) => {
        const productSnap = await tx.get(productRef);
        if (productSnap.exists()) {
          tx.update(productRef, { quantity: increment(dmg.quantity), lastUpdated: new Date() });
        }
        tx.delete(damageRef);
        if (expenseRef) tx.delete(expenseRef);
      });

      setDamages((prev) => prev.filter((d) => d.id !== dmg.id));
      setProducts((prev) => prev.map((p) => p.id === dmg.productId ? { ...p, quantity: p.quantity + dmg.quantity } : p));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      setListError('Could not delete that damage. Nothing was changed. Try refreshing.');
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
            Damages change your stock and show cost data, so only admins and managers can see them.
          </p>
        </div>
      </div>
    );
  }

  const topReason = byReason[0]?.[0];

  const renderDelete = (dmg: DamageRecord) => (
    confirmDeleteId === dmg.id ? (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Delete this damage?</span>
          <button onClick={() => handleDelete(dmg)} disabled={deletingId === dmg.id} aria-label="Confirm delete"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-50">
            {deletingId === dmg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button onClick={() => setConfirmDeleteId(null)} disabled={deletingId === dmg.id} aria-label="Cancel delete"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Puts {dmg.quantity} unit{dmg.quantity !== 1 ? 's' : ''} back in stock and removes the linked expense.
        </p>
      </div>
    ) : (
      <button onClick={() => setConfirmDeleteId(dmg.id)} aria-label={`Delete damage for ${dmg.productName}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
        <Trash2 className="h-4 w-4" />
      </button>
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
            <span className="hidden text-muted-foreground sm:inline">· Broken, expired and lost stock</span>
          </div>

          <div role="tablist" aria-label="Period"
            className="grid grid-cols-4 rounded-full border border-border bg-muted/50 p-0.5 sm:inline-grid sm:w-auto">
            {(['week', 'month', 'year', 'all'] as Period[]).map((p) => (
              <button key={p} role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}
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

          <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm sm:p-6 lg:col-span-2"
            style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)), hsl(var(--brand-forest)))' }}>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: LIME }} />

            <div className="relative flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Stock lost · {PERIOD_LABEL[period].toLowerCase()}
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint(LIME, 18) }}>
                <Wallet className="h-[18px] w-[18px]" style={{ color: LIME }} />
              </span>
            </div>

            <div className="relative mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="font-heading text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                <span className="mr-0.5 text-2xl text-white/60 sm:text-3xl">₵</span>
                {periodLoss.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
              </p>
              {prevLoss !== null && (
                <span className="mb-1.5 text-xs text-white/55">{fmt(prevLoss)} {PREV_LABEL[period]}</span>
              )}
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              {[
                { label: 'Units damaged', value: periodUnits.toLocaleString() },
                { label: 'Entries',       value: periodList.length.toLocaleString() },
                { label: 'Top reason',    value: topReason ?? '—' },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <p className="truncate text-[11px] text-white/55">{s.label}</p>
                  <p className="mt-0.5 truncate font-heading text-lg font-semibold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* By reason */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">By reason</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                style={{ background: tint(LIME, 18) }}>
                <PieChart className="h-[18px] w-[18px]" />
              </span>
            </div>

            {reasonTop.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No damages {period === 'all' ? 'recorded yet' : PERIOD_LABEL[period].toLowerCase()}.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {reasonTop.map(([reason, v]) => (
                  <div key={reason}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{reason}</span>
                      <span className="flex-shrink-0 text-[13px] font-semibold tabular-nums">
                        {fmt(v.loss)} <span className="font-normal text-muted-foreground">· {v.units} unit{v.units !== 1 ? 's' : ''}</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(v.units / maxUnits) * 100}%`, backgroundColor: ORANGE }} />
                    </div>
                  </div>
                ))}
                {reasonMore > 0 && <p className="text-xs text-muted-foreground">+ {reasonMore} more reason{reasonMore !== 1 ? 's' : ''}</p>}
              </div>
            )}
          </div>
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-5 lg:items-start">

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2">
            <section className="rounded-2xl border border-border bg-card shadow-sm">
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                  style={{ background: tint(LIME, 18) }}>
                  <PackageX className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-[15px] font-semibold leading-tight">Report damage</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Updates your stock and expenses together.</p>
                </div>
              </header>
              <div className="p-4">
                <DamageForm
                  products={products}
                  submitting={submitting}
                  successMessage={successMsg}
                  errorMessage={submitError}
                  onSubmit={handleSubmit}
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
                      <h2 className="font-heading text-[15px] font-semibold leading-tight">All damages</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Newest first</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                    {filtered.length} of {damages.length}
                  </span>
                </div>

                {usedReasons.length > 1 && (
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {([['all', damages.length], ...usedReasons] as [string, number][]).map(([r, n]) => {
                      const active = filterReason === r;
                      return (
                        <button key={r} onClick={() => { setFilterReason(r); setVisible(PAGE_SIZE); }}
                          className={`inline-flex h-9 flex-shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all ${
                            active
                              ? (r === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'text-foreground')
                              : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
                          style={active && r !== 'all' ? { background: tint(ORANGE, 14), borderColor: ORANGE } : undefined}>
                          {r === 'all' ? 'All' : r}
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
                <EmptyState icon={PackageX} title="No business selected" body="Pick a business from the sidebar to see its damages." />
              ) : damages.length === 0 ? (
                <EmptyState icon={PackageX} title="No damages recorded yet" body="Broken, expired or lost stock will show up here." />
              ) : shown.length === 0 ? (
                <EmptyState icon={PackageX} title="Nothing for this reason" body="Try another reason or show everything."
                  action={{ label: 'Show all damages', onClick: () => setFilterReason('all') }} />
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {shown.map((dmg) => (
                      <div key={dmg.id} className="px-4 py-3.5 transition-colors hover:bg-muted/30">
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                            {imageFor(dmg.productId)
                              ? <img src={imageFor(dmg.productId)} alt="" className="h-full w-full object-cover" />
                              : <Package className="h-4 w-4 text-muted-foreground" />}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{dmg.productName}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {dmg.quantity} unit{dmg.quantity !== 1 ? 's' : ''}
                              </span>
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: tint(ORANGE, 14), color: '#ea580c' }}>
                                {dmg.reason}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                              {dateOf(dmg.reportedAt)} · {timeOf(dmg.reportedAt)} · by {dmg.reportedBy}
                            </p>
                            {dmg.notes && <p className="mt-1 text-[11px] italic text-muted-foreground">{dmg.notes}</p>}
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <p className="font-heading text-base font-semibold tabular-nums" style={{ color: '#ea580c' }}>{fmt(dmg.totalCost)}</p>
                            {dmg.unitCost > 0 && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{fmt(dmg.unitCost)} each</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end">{renderDelete(dmg)}</div>
                      </div>
                    ))}
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
                      <span className="font-semibold text-foreground">{filtered.length}</span> damages
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