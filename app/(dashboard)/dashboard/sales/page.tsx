'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, doc, writeBatch, increment,
  query, where, orderBy,
} from 'firebase/firestore';
import { Product, SalesRecord } from '@/lib/types';
import { ReceiptModal } from './components/ReceiptModal';
import { SaleForm, type CartItem } from './components/salesForm';
import {
  ShoppingBag, Loader2, TrendingUp, TrendingDown, Receipt, Package,
  ChevronDown, Trash2, X, Check, Wallet, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SaleWithProduct extends SalesRecord {
  productName: string;
}

/* ───────────────────────── helpers ───────────────────────── */

const PAGE_SIZE = 50;
const LIME = 'hsl(var(--brand-lime))';
const LEAF = 'hsl(var(--brand-leaf))';
const AMBER = '#f59e0b';
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const MONEY = 'text-[hsl(var(--brand-emerald))] dark:text-[hsl(var(--brand-lime))]';

const genReceiptNo = () => `RCP-${Date.now().toString(36).toUpperCase()}`;
const fmt = (n: number) => `₵${n.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;

// How many stock units a sale consumed. Falls back to a recompute for older
// sales recorded before `unitsConsumed` existed.
const unitsConsumedFor = (s: SaleWithProduct) =>
  (s as any).unitsConsumed ?? (s.saleType === 'box' ? s.quantity * ((s as any).boxQty ?? 1) : s.quantity);

// One receipt can hold several sale lines, so "sales" are counted per receipt
const receiptKey     = (s: SaleWithProduct) => (s as any).receiptNo ?? s.id;
const countReceipts  = (list: SaleWithProduct[]) => new Set(list.map(receiptKey)).size;
const sumTotal       = (list: SaleWithProduct[]) => list.reduce((a, r) => a + r.totalAmount, 0);

const qtyLabel = (s: SaleWithProduct) =>
  s.saleType === 'box' ? `${s.quantity} box${s.quantity !== 1 ? 'es' : ''}` : `${s.quantity} pc${s.quantity !== 1 ? 's' : ''}`;

const timeOf = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Thumb({ src, alt, size }: { src?: string; alt: string; size: string }) {
  return (
    <span className={`flex ${size} flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted`}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
    </span>
  );
}

function QtyBadge({ sale }: { sale: SaleWithProduct }) {
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={sale.saleType === 'box' ? { background: tint(AMBER, 16), color: '#d97706' } : { background: tint(LIME, 20) }}>
      {qtyLabel(sale)}
    </span>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function SalesPage() {
  const { user }           = useAuth();
  const { activeBusiness } = useBusiness();

  // Only an authenticated admin (Firebase auth user) can delete sales.
  // Staff sign in via a business session and have no `user` here.
  const isAdmin = !!user;

  const [products,     setProducts]     = useState<Product[]>([]);
  const [allSales,     setAllSales]     = useState<SaleWithProduct[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [successMsg,   setSuccessMsg]   = useState('');
  const [submitError,  setSubmitError]  = useState('');
  const [listError,    setListError]    = useState('');
  const [range,        setRange]        = useState<'today' | 'all'>('today');
  const [visible,      setVisible]      = useState(PAGE_SIZE);

  // Receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [sendingSMS,  setSendingSMS]  = useState(false);
  const [smsSent,     setSmsSent]     = useState(false);

  // Delete sale
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  useEffect(() => { if (activeBusiness) fetchData(); }, [activeBusiness]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      // Products scoped to business
      const prodSnap = await getDocs(
        query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))
      );
      const prods = prodSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        dateAdded:   d.data().dateAdded?.toDate()   || new Date(),
        lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
      })) as Product[];
      setProducts(prods);

      // One query, newest first. Powers both the stats and the list.
      const salesSnap = await getDocs(
        query(
          collection(db, 'sales'),
          where('businessId', '==', activeBusiness.id),
          orderBy('recordedAt', 'desc')
        )
      );
      const mapped = salesSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        productName: prods.find((p) => p.id === d.data().productId)?.name || 'Unknown product',
        recordedAt:  d.data().recordedAt?.toDate() || new Date(),
      })) as SaleWithProduct[];

      setAllSales(mapped);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error(e);
      setListError('Could not load your sales. Check your connection and refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async (data: any) => {
    setSendingSMS(true);
    try {
      await fetch('/api/send-sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName:    data.customerName,
          customerPhone:   data.customerPhone,
          adminPhone:      user?.phone || '',
          sendCustomerSMS: data.sendCustomerSMS ?? true,
          items:           data.items.map((i: CartItem) => ({
            name:       i.productName,
            quantity:   i.quantity,
            saleType:   i.saleType ?? 'piece',
            boxQty:     i.boxQty,
            unitPrice:  i.unitPrice,
            totalPrice: i.totalPrice,
          })),
          totalAmount:  data.items.reduce((s: number, i: CartItem) => s + i.totalPrice, 0),
          businessName: data.businessName,
          businessCode: data.businessCode,
          receiptNo:    data.receiptNo,
          recordedBy:   data.recordedBy,
          date:         data.date,
          notes:        data.notes,
        }),
      });
      setSmsSent(true);
    } catch (e) { console.error(e); }
    finally { setSendingSMS(false); }
  };

  /** Resolves true only when the sale was saved, so the form keeps the cart if it wasn't. */
  const handleSubmit = async (
    cart: CartItem[],
    customer: { name: string; phone: string; notes: string },
    sendSMS: boolean
  ): Promise<boolean> => {
    if (!activeBusiness || cart.length === 0) return false;
    setSubmitting(true);
    setSubmitError('');
    try {
      const receiptNo = genReceiptNo();
      const batch = writeBatch(db);

      for (const item of cart) {
        const saleRef = doc(collection(db, 'sales'));
        // For box sales, total units consumed = quantity × boxQty
        const unitsConsumed = item.saleType === 'box' ? item.quantity * (item.boxQty ?? 1) : item.quantity;
        batch.set(saleRef, {
          productId:     item.productId,
          businessId:    activeBusiness.id,
          quantity:      item.quantity,
          saleType:      item.saleType ?? 'piece',
          boxQty:        item.boxQty ?? null,
          unitsConsumed,
          price:         item.unitPrice,
          totalAmount:   item.totalPrice,
          customerName:  customer.name,
          customerPhone: customer.phone || '',
          recordedBy:    user?.name || 'Staff',
          recordedAt:    new Date(),
          notes:         customer.notes,
          receiptNo,
        });

        // Atomic decrement: safe even if the same product appears twice in one
        // cart (a piece sale AND a box sale) or another sale lands at the same time.
        batch.update(doc(db, 'products', item.productId), {
          quantity:    increment(-unitsConsumed),
          lastUpdated: new Date(),
        });
      }

      await batch.commit();

      const receipt = {
        items:         cart,
        customerName:  customer.name,
        customerPhone: customer.phone || '',
        notes:         customer.notes,
        businessName:  activeBusiness.name,
        businessCode:  activeBusiness.businessId,
        businessLogo:  (activeBusiness as any).logoUrl || undefined,
        recordedBy:    user?.name || 'Staff',
        receiptNo,
        date:          new Date(),
      };

      setReceiptData(receipt);
      setSmsSent(false);

      // Always notify admin; customer SMS only if the toggle is on
      handleSendSMS({ ...receipt, sendCustomerSMS: sendSMS });

      setReceiptOpen(true);
      setSuccessMsg('Sale recorded');
      setTimeout(() => setSuccessMsg(''), 3000);
      setRange('today');
      fetchData();
      return true;
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || 'Could not record the sale. Nothing was saved, please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSale = async (sale: SaleWithProduct) => {
    if (!isAdmin) return;
    setDeletingId(sale.id);
    setListError('');
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'sales', sale.id));

      // Put back the stock this sale consumed, if the product still exists
      const prod = products.find((p) => p.id === sale.productId);
      if (prod) {
        batch.update(doc(db, 'products', sale.productId), {
          quantity:    increment(unitsConsumedFor(sale)),
          lastUpdated: new Date(),
        });
      }
      await batch.commit();

      setAllSales((prev) => prev.filter((s) => s.id !== sale.id));
      setProducts((prev) => prev.map((p) =>
        p.id === sale.productId ? { ...p, quantity: p.quantity + unitsConsumedFor(sale) } : p
      ));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      setListError('Could not delete that sale. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  /* ── stats ── */
  const stats = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const prev  = new Date(start); prev.setDate(prev.getDate() - 1);

    const todayList     = allSales.filter((s) => s.recordedAt >= start);
    const yesterdayList = allSales.filter((s) => s.recordedAt >= prev && s.recordedAt < start);

    const todayTotal    = sumTotal(todayList);
    const yTotal        = sumTotal(yesterdayList);
    const todayReceipts = countReceipts(todayList);
    const allReceipts   = countReceipts(allSales);
    const allTotal      = sumTotal(allSales);

    return {
      todayList, todayTotal, todayReceipts,
      unitsToday: todayList.reduce((a, s) => a + unitsConsumedFor(s), 0),
      avgToday:   todayReceipts ? todayTotal / todayReceipts : 0,
      delta:      yTotal > 0 ? Math.round(((todayTotal - yTotal) / yTotal) * 100) : null,
      allTotal, allReceipts,
      avgAll:     allReceipts ? allTotal / allReceipts : 0,
    };
  }, [allSales]);

  const filtered     = range === 'today' ? stats.todayList : allSales;
  const shown        = filtered.slice(0, visible);
  const remaining    = filtered.length - shown.length;
  const filteredSum  = sumTotal(filtered);

  const imageFor = (productId: string) => products.find((p) => p.id === productId)?.imageUrl;
  const whenLabel = (d: Date) =>
    range === 'today' ? timeOf(d) : `${d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })} · ${timeOf(d)}`;

  /* ── small renderers ── */
  const renderDelete = (sale: SaleWithProduct) => {
    if (!isAdmin) return null;
    if (confirmDeleteId === sale.id) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Delete &amp; restock?</span>
          <button onClick={() => handleDeleteSale(sale)} disabled={deletingId === sale.id} aria-label="Confirm delete"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-50">
            {deletingId === sale.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button onClick={() => setConfirmDeleteId(null)} disabled={deletingId === sale.id} aria-label="Cancel"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }
    return (
      <button onClick={() => setConfirmDeleteId(sale.id)} aria-label="Delete sale"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
        <Trash2 className="h-4 w-4" />
      </button>
    );
  };

  /* ─────────────────────── render ─────────────────────── */
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] space-y-4 px-3 py-4 sm:px-4 lg:px-6">

        {/* ── Header line ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: LEAF }} />
            <span className="truncate font-semibold">{activeBusiness?.name ?? 'No business selected'}</span>
            <span className="hidden text-muted-foreground sm:inline">
              · {stats.todayReceipts} sale{stats.todayReceipts !== 1 ? 's' : ''} today
            </span>
          </div>
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: LIME }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: LEAF }} />
            </span>
            Live
          </span>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid gap-4 lg:grid-cols-3">

          {/* Today hero */}
          <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm sm:p-6 lg:col-span-2"
            style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)), hsl(var(--brand-forest)))' }}>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: LIME }} />

            <div className="relative flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Today’s revenue</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint(LIME, 18) }}>
                <Wallet className="h-[18px] w-[18px]" style={{ color: LIME }} />
              </span>
            </div>

            <div className="relative mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
              <p className="font-heading text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                <span className="mr-0.5 text-2xl text-white/60 sm:text-3xl">₵</span>
                {stats.todayTotal.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
              </p>
              {stats.delta !== null ? (
                <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  stats.delta >= 0 ? 'bg-[hsl(var(--brand-lime)/0.18)] text-[hsl(var(--brand-lime))]' : 'bg-red-500/20 text-red-300'}`}>
                  {stats.delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {Math.abs(stats.delta)}% vs yesterday
                </span>
              ) : (
                <span className="mb-1.5 text-xs text-white/50">No sales yesterday to compare</span>
              )}
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              {[
                { label: 'Sales',        value: stats.todayReceipts.toLocaleString() },
                { label: 'Units sold',   value: stats.unitsToday.toLocaleString() },
                { label: 'Average sale', value: fmt(stats.avgToday) },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <p className="text-[11px] text-white/55">{s.label}</p>
                  <p className="mt-0.5 truncate font-heading text-lg font-semibold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* All-time */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">All time</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                style={{ background: tint(LIME, 18) }}>
                <Receipt className="h-[18px] w-[18px]" />
              </span>
            </div>
            <p className="mt-3 font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {fmt(stats.allTotal)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Total revenue recorded</p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Sales</p>
                <p className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{stats.allReceipts.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Average sale</p>
                <p className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{fmt(stats.avgAll)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Main grid ── */}
        <div className="grid gap-4 lg:grid-cols-5 lg:items-start">

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2">
            <section className="rounded-2xl border border-border bg-card shadow-sm">
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                  style={{ background: tint(LIME, 18) }}>
                  <ShoppingBag className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-[15px] font-semibold leading-tight">New sale</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Search or scan items, then record it.</p>
                </div>
              </header>
              <div className="p-4">
                <SaleForm
                  products={products}
                  submitting={submitting}
                  successMessage={successMsg}
                  errorMessage={submitError}
                  onSubmit={handleSubmit}
                />
              </div>
            </section>
          </motion.div>

          {/* Sales list */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-3">
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                    style={{ background: tint(LIME, 18) }}>
                    <Receipt className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-[15px] font-semibold leading-tight">Recent sales</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {range === 'today' ? 'Everything sold today' : 'Every sale, newest first'}
                    </p>
                  </div>
                </div>

                <div role="tablist" aria-label="Sales range" className="inline-flex rounded-full border border-border bg-muted/50 p-0.5">
                  {([['today', 'Today', stats.todayList.length], ['all', 'All', allSales.length]] as const).map(([key, label, n]) => (
                    <button key={key} role="tab" aria-selected={range === key}
                      onClick={() => { setRange(key); setVisible(PAGE_SIZE); }}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-all ${
                        range === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {label}
                      <span className="text-[11px] tabular-nums text-muted-foreground">{n}</span>
                    </button>
                  ))}
                </div>
              </header>

              {/* inline error */}
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
                <EmptyState icon={ShoppingBag} title="No business selected" body="Pick a business from the sidebar to see its sales." />
              ) : shown.length === 0 ? (
                range === 'today' && allSales.length > 0 ? (
                  <EmptyState icon={Receipt} title="No sales yet today"
                    body="Your first sale of the day will show up here."
                    action={{ label: 'View all sales', onClick: () => setRange('all') }} />
                ) : (
                  <EmptyState icon={Receipt} title="No sales yet" body="Record your first sale and it will appear here." />
                )
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {['Product', 'Customer', 'Qty', 'Total', 'By', 'When'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                          ))}
                          {isAdmin && <th className="px-4 py-2.5" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {shown.map((sale) => (
                          <tr key={sale.id} className="transition-colors hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Thumb src={imageFor(sale.productId)} alt={sale.productName} size="h-10 w-10" />
                                <div className="min-w-0">
                                  <p className="max-w-[14rem] truncate text-[13px] font-semibold">{sale.productName}</p>
                                  {(sale as any).receiptNo && (
                                    <p className="font-mono text-[10px] text-muted-foreground">{(sale as any).receiptNo}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[13px] font-medium">{sale.customerName?.trim() || 'Walk-in'}</p>
                              {sale.customerPhone && <p className="text-[11px] text-muted-foreground">{sale.customerPhone}</p>}
                            </td>
                            <td className="px-4 py-3"><QtyBadge sale={sale} /></td>
                            <td className={`px-4 py-3 text-[13px] font-semibold tabular-nums ${MONEY}`}>{fmt(sale.totalAmount)}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{sale.recordedBy}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{whenLabel(sale.recordedAt)}</td>
                            {isAdmin && <td className="px-4 py-3"><div className="flex justify-end">{renderDelete(sale)}</div></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile list */}
                  <div className="divide-y divide-border sm:hidden">
                    {shown.map((sale) => (
                      <div key={sale.id} className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <Thumb src={imageFor(sale.productId)} alt={sale.productName} size="h-11 w-11" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{sale.productName}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {sale.customerName?.trim() || 'Walk-in'} · {whenLabel(sale.recordedAt)}
                            </p>
                            <div className="mt-1.5"><QtyBadge sale={sale} /></div>
                          </div>
                          <p className={`flex-shrink-0 text-sm font-semibold tabular-nums ${MONEY}`}>{fmt(sale.totalAmount)}</p>
                        </div>
                        {isAdmin && <div className="mt-2 flex justify-end">{renderDelete(sale)}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
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
                    <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        Showing <span className="font-semibold text-foreground">{shown.length}</span> of{' '}
                        <span className="font-semibold text-foreground">{filtered.length}</span>
                      </span>
                      <span className={`font-heading text-base font-semibold tabular-nums ${MONEY}`}>{fmt(filteredSum)}</span>
                    </div>
                  </div>
                </>
              )}
            </section>
          </motion.div>
        </div>
      </div>

      {/* ── Receipt modal ── */}
      <ReceiptModal
        open={receiptOpen}
        data={receiptData}
        onClose={() => setReceiptOpen(false)}
        onSendSMS={handleSendSMS}
        sendingSMS={sendingSMS}
        smsSent={smsSent}
      />
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
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
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