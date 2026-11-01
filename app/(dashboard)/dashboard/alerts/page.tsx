'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Product, SalesRecord } from '@/lib/types';
import { useBusiness } from '@/lib/business-context';
import {
  AlertTriangle, PackageX, Package, ShieldAlert, RefreshCw, ArrowRight, Clock, CheckCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertStatus = 'out' | 'critical' | 'warning';

interface AlertProduct extends Product {
  status: AlertStatus;
  dailyVelocity: number;   // avg units sold/day, last 30 days
  daysLeft: number | null; // null = no recent sales data to estimate from
}

// ─── Category label map ───────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  'home-appliances':          'Home Appliances',
  'sneakers':                  'Sneakers',
  'phone-laptop-accessories':  'Tech Accessories',
  'clothing':                  'Clothing',
  'food-beverages':            'Food & Beverages',
  'other':                     'Other',
};

const VELOCITY_WINDOW_DAYS = 30;

// ─── Status config: each level carries its own weight ─────────────────────────
// out      → red tint card, strongest
// critical → orange tint card
// warning  → plain card, amber accents
const STATUS_CONFIG = {
  out: {
    label:   'Out of stock',
    urgency: 'Immediate restock required',
    icon:    PackageX,
    card:    'border-destructive/25 bg-destructive/5',
    chip:    'bg-destructive/10 text-destructive',
    bar:     'bg-destructive',
    text:    'text-destructive',
    dot:     'bg-destructive',
    primary: true,
  },
  critical: {
    label:   'Critical',
    urgency: 'Restock soon to avoid a stock-out',
    icon:    ShieldAlert,
    card:    'border-orange-300/60 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10',
    chip:    'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
    bar:     'bg-orange-500',
    text:    'text-orange-700 dark:text-orange-300',
    dot:     'bg-orange-500',
    primary: true,
  },
  warning: {
    label:   'Low stock',
    urgency: 'Running low, monitor closely',
    icon:    AlertTriangle,
    card:    'border-border bg-card',
    chip:    'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    bar:     'bg-amber-400',
    text:    'text-amber-700 dark:text-amber-300',
    dot:     'bg-amber-400',
    primary: false,
  },
} as const;

const STATUS_ORDER: AlertStatus[] = ['out', 'critical', 'warning'];

const FILTER_TABS: { key: AlertStatus | 'all'; label: string; dot?: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'out',      label: 'Out of stock', dot: 'bg-destructive' },
  { key: 'critical', label: 'Critical',     dot: 'bg-orange-500' },
  { key: 'warning',  label: 'Low stock',    dot: 'bg-amber-400' },
];

// Health bar is drawn on the dark panel, so these are plain colors
const HEALTH_COLORS = {
  healthy:  '#12A150',
  warning:  '#FBBF24',
  critical: '#F97316',
  out:      '#EF4444',
};

function getUnitCost(p: Product): number {
  return (p as any).pieceCost ?? p.costPrice ?? 0;
}

function fmt(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return abs >= 10000
    ? `${sign}₵${(abs / 1000).toFixed(1)}K`
    : `${sign}₵${Math.round(abs).toLocaleString()}`;
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-2xl bg-border/60', className)} />
);

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label} </span>
      <span className="tabular font-semibold text-foreground">{value}</span>
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { activeBusiness } = useBusiness();
  const router = useRouter();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [sales,        setSales]       = useState<SalesRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeFilter, setFilter]     = useState<AlertStatus | 'all'>('all');

  const fetchData = async (isRefresh = false) => {
    if (!activeBusiness) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [prodSnap, salesSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))),
        getDocs(query(collection(db, 'sales'),    where('businessId', '==', activeBusiness.id))),
      ]);
      setProducts(prodSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        dateAdded:   d.data().dateAdded?.toDate()   || new Date(),
        lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
      })) as Product[]);
      setSales(salesSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        recordedAt: d.data().recordedAt?.toDate() || new Date(),
      })) as SalesRecord[]);
    } catch (e) {
      console.error(e);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeBusiness]);

  // ── Sales velocity per product, last 30 days ──────────────────────────
  const velocityByProduct = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - VELOCITY_WINDOW_DAYS);
    const totals: Record<string, number> = {};
    sales.forEach((s) => {
      if (s.recordedAt < cutoff) return;
      totals[s.productId] = (totals[s.productId] || 0) + s.quantity;
    });
    const perDay: Record<string, number> = {};
    Object.entries(totals).forEach(([id, qty]) => { perDay[id] = qty / VELOCITY_WINDOW_DAYS; });
    return perDay;
  }, [sales]);

  // ── Derive alert items (original threshold logic preserved + velocity) ─
  const alertItems: AlertProduct[] = useMemo(() => {
    return products
      .filter((p) => {
        const threshold = p.lowStockAlert ?? 5;
        return p.quantity <= threshold;
      })
      .map((p) => {
        const threshold = p.lowStockAlert ?? 5;
        const velocity  = velocityByProduct[p.id] || 0;
        const daysLeft  = velocity > 0 ? p.quantity / velocity : null;
        return {
          ...p,
          status:
            p.quantity === 0                          ? 'out'
            : p.quantity <= Math.ceil(threshold * 0.4) ? 'critical'
            : 'warning',
          dailyVelocity: velocity,
          daysLeft,
        } as AlertProduct;
      })
      .sort((a, b) => {
        const order = { out: 0, critical: 1, warning: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        // within the same status, surface the fastest-depleting item first
        const aDays = a.daysLeft ?? Infinity;
        const bDays = b.daysLeft ?? Infinity;
        if (aDays !== bDays) return aDays - bDays;
        return a.quantity - b.quantity;
      });
  }, [products, velocityByProduct]);

  const counts: Record<AlertStatus | 'all', number> = {
    all:      alertItems.length,
    out:      alertItems.filter((i) => i.status === 'out').length,
    critical: alertItems.filter((i) => i.status === 'critical').length,
    warning:  alertItems.filter((i) => i.status === 'warning').length,
  };

  const visibleItems = activeFilter === 'all'
    ? alertItems
    : alertItems.filter((i) => i.status === activeFilter);

  const allClear = alertItems.length === 0;
  const healthyCount = Math.max(0, products.length - alertItems.length);

  // ── Smart Restock Plan ─────────────────────────────────────────────────
  const restockPlan = useMemo(() => {
    let totalCost = 0;
    let totalSellValue = 0;
    let itemsNeedingCash = 0;
    alertItems.forEach((item) => {
      const threshold = item.lowStockAlert ?? 5;
      const target    = threshold * 2; // restock up to a healthy buffer
      const needed    = Math.max(0, target - item.quantity);
      if (needed > 0) {
        totalCost += needed * getUnitCost(item);
        totalSellValue += needed * ((item as any).piecePrice ?? item.sellingPrice ?? 0);
        itemsNeedingCash += 1;
      }
    });
    const soonest = alertItems
      .filter((i) => i.daysLeft !== null)
      .sort((a, b) => (a.daysLeft as number) - (b.daysLeft as number))[0] ?? null;

    return { totalCost, totalSellValue, itemsNeedingCash, soonest };
  }, [alertItems]);

  const soonestDays = restockPlan.soonest ? Math.max(0, Math.ceil(restockPlan.soonest.daysLeft as number)) : null;
  const restockProfit = restockPlan.totalSellValue - restockPlan.totalCost;

  const healthSegments = [
    { key: 'healthy',  label: 'Healthy',  count: healthyCount,      color: HEALTH_COLORS.healthy },
    { key: 'warning',  label: 'Low',      count: counts.warning,    color: HEALTH_COLORS.warning },
    { key: 'critical', label: 'Critical', count: counts.critical,   color: HEALTH_COLORS.critical },
    { key: 'out',      label: 'Out',      count: counts.out,        color: HEALTH_COLORS.out },
  ];

  return (
    <div className="min-h-full bg-muted">
      <div className="mx-auto max-w-[1200px] space-y-4 p-4 pb-10 sm:p-5 lg:p-6">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Stock alerts</h1>
            <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
              {activeBusiness?.name ?? '—'} · What to restock, and when
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/dashboard/products')}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent"
            >
              All products
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>

        {/* ── HERO: restock plan + stock health ── */}
        {loading ? (
          <div className="h-[212px] animate-pulse rounded-2xl bg-[hsl(var(--brand-deep))]/20" />
        ) : allClear ? (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-[hsl(var(--brand-deep))] p-5 dark:border-border dark:bg-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white/60">Stock health</p>
                <h2 className="mt-0.5 font-heading text-[28px] font-bold leading-tight text-white">
                  All stock levels healthy
                </h2>
                <p className="mt-1 text-sm text-white/60">Every product is above its minimum threshold.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--brand-lime))] px-3 py-1 text-xs font-bold text-[hsl(var(--brand-deep))]">
                <CheckCircle className="h-3.5 w-3.5" />
                All clear
              </span>
            </div>
            {products.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: HEALTH_COLORS.healthy }} />
                <p className="mt-2 text-xs font-semibold text-white/60">
                  <span className="tabular text-white">{products.length}</span> product{products.length !== 1 ? 's' : ''} in stock
                </p>
              </div>
            )}
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-white/10 bg-[hsl(var(--brand-deep))] p-5 dark:border-border dark:bg-card"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-white/60">Smart restock plan</p>
              <span className="rounded-full bg-[hsl(var(--brand-lime))] px-3 py-1 text-xs font-bold text-[hsl(var(--brand-deep))]">
                {alertItems.length} need{alertItems.length === 1 ? 's' : ''} attention
              </span>
            </div>

            <div className="mt-3 grid gap-5 sm:grid-cols-[1.3fr_1fr_auto] sm:items-end">
              {/* Cash needed */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">Cash to fully restock</p>
                <p className="tabular mt-1 font-heading text-[34px] font-bold leading-none text-white">
                  {fmt(restockPlan.totalCost)}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold">
                  {restockPlan.totalSellValue > 0 && restockProfit > 0 && (
                    <span className="tabular text-[hsl(var(--brand-lime))]">
                      Sells for {fmt(restockPlan.totalSellValue)} · {fmt(restockProfit)} profit
                    </span>
                  )}
                  <span className="text-white/50">
                    {restockPlan.itemsNeedingCash} item{restockPlan.itemsNeedingCash !== 1 ? 's' : ''}, to a healthy buffer
                  </span>
                </p>
              </div>

              {/* Fastest depleting */}
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">Fastest depleting</p>
                {restockPlan.soonest ? (
                  <>
                    <p className="mt-1 truncate font-heading text-xl font-bold text-white">{restockPlan.soonest.name}</p>
                    <p className="mt-1 text-xs font-semibold text-[hsl(var(--brand-lime))]">
                      ~{soonestDays} day{soonestDays !== 1 ? 's' : ''} left at current pace
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 font-heading text-xl font-bold text-white">—</p>
                    <p className="mt-1 text-xs text-white/50">Not enough recent sales to estimate</p>
                  </>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={() => router.push('/dashboard/products')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[hsl(var(--brand-deep))] transition-colors hover:bg-white/90"
              >
                Start restocking
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Stock health bar */}
            {products.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full">
                  {healthSegments.filter((s) => s.count > 0).map((s) => (
                    <motion.div
                      key={s.key}
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.count / products.length) * 100}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: s.color }}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-white/60">
                  {healthSegments.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5">
                      <i className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.label} <span className="tabular text-white">{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* ── FILTER TABS ── */}
        {!loading && !allClear && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-full self-start overflow-x-auto">
              <div className="inline-flex rounded-xl bg-border/60 p-1">
                {FILTER_TABS.map((t) => {
                  const active = activeFilter === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setFilter(t.key)}
                      className={cn(
                        'relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors',
                        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="alertsPill"
                          className="absolute inset-0 rounded-lg bg-card shadow-sm"
                          transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                        />
                      )}
                      {t.dot && <span className={cn('relative z-10 h-2 w-2 rounded-full', t.dot)} />}
                      <span className="relative z-10 whitespace-nowrap">{t.label}</span>
                      <span className={cn(
                        'tabular relative z-10 rounded-full px-1.5 text-[11px] font-bold',
                        active ? 'bg-muted text-foreground' : 'text-muted-foreground'
                      )}>
                        {counts[t.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* ── ALERT CARDS ── */}
        {!loading && !allClear && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item, i) => {
                const cfg = STATUS_CONFIG[item.status];
                const StatusIcon = cfg.icon;
                const threshold = item.lowStockAlert ?? 5;
                const stockPct = Math.min(100, (item.quantity / (threshold * 2)) * 100);
                const showHeader = i === 0 || visibleItems[i - 1].status !== item.status;

                const daysCeil = item.daysLeft === null ? null : Math.ceil(item.daysLeft);
                const daysLeftLabel = daysCeil === null
                  ? null
                  : daysCeil <= 0 ? 'Selling now'
                  : `~${daysCeil} day${daysCeil !== 1 ? 's' : ''} left`;
                const daysLeftColor = item.daysLeft === null
                  ? ''
                  : item.daysLeft <= 3
                    ? 'bg-destructive/10 text-destructive'
                    : item.daysLeft <= 7
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                      : 'bg-[hsl(var(--brand-emerald)/0.12)] text-[hsl(var(--brand-emerald))]';

                const unitCost = item.pieceCost ?? item.costPrice;
                const goRestock = () => router.push(`/dashboard/products/${item.id}/edit`);

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: Math.min(i, 8) * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
                  >
                    {/* Group header */}
                    {showHeader && (
                      <div className={cn('flex flex-wrap items-center gap-2 px-1 pb-2', i > 0 && 'pt-3')}>
                        <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                        <h2 className="font-heading text-sm font-bold text-foreground">{cfg.label}</h2>
                        <span className="tabular rounded-full bg-border/60 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                          {counts[item.status]}
                        </span>
                        <span className="text-xs text-muted-foreground">{cfg.urgency}</span>
                      </div>
                    )}

                    <div className={cn('rounded-2xl border p-4 transition-shadow hover:shadow-md sm:p-5', cfg.card)}>
                      <div className="flex items-start gap-4">

                        {/* Icon */}
                        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', cfg.chip)}>
                          <StatusIcon className="h-[18px] w-[18px]" />
                        </div>

                        {/* Main content */}
                        <div className="min-w-0 flex-1 space-y-2.5">

                          {/* Title row */}
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-heading text-[15px] font-bold text-foreground">{item.name}</h3>
                              {daysLeftLabel && (
                                <span className={cn('inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', daysLeftColor)}>
                                  <Clock className="h-3 w-3" />
                                  {daysLeftLabel}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                              {item.brand && <span className="font-medium">{item.brand}</span>}
                              <span className="font-mono">{item.sku}</span>
                              <span>{CATEGORY_LABELS[item.category] || item.category}</span>
                            </p>
                          </div>

                          {/* Stock meter */}
                          <div className="flex items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/60">
                              <motion.div
                                className={cn('h-full rounded-full', cfg.bar)}
                                initial={{ width: 0 }}
                                animate={{ width: item.quantity === 0 ? '100%' : `${Math.max(4, stockPct)}%` }}
                                transition={{ delay: Math.min(i, 8) * 0.03 + 0.1, duration: 0.5, ease: 'easeOut' }}
                                style={{ opacity: item.quantity === 0 ? 0.35 : 1 }}
                              />
                            </div>
                            <p className="flex-shrink-0 text-xs text-muted-foreground">
                              <span className={cn('tabular font-heading text-base font-bold', cfg.text)}>{item.quantity}</span>
                              {' '}/ {threshold} min
                            </p>
                          </div>

                          {/* Facts */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                            <Fact label="Price" value={`₵${(item.piecePrice ?? item.sellingPrice)?.toLocaleString() ?? '—'}`} />
                            {(item as any).boxEnabled && (item as any).boxPrice && (
                              <Fact label={`Box (${(item as any).boxQty}pcs)`} value={`₵${(item as any).boxPrice.toLocaleString()}`} />
                            )}
                            <Fact label="Cost" value={`₵${unitCost?.toLocaleString() ?? '—'}`} />
                            {item.quantity > 0 && unitCost > 0 && (
                              <Fact label="Stock value" value={`₵${(item.quantity * (unitCost ?? 0)).toLocaleString()}`} />
                            )}
                            <Fact label="Pace" value={item.dailyVelocity > 0 ? `${item.dailyVelocity.toFixed(1)}/day` : 'No recent sales'} />
                          </div>
                        </div>

                        {/* Restock button (desktop): urgent items get the primary, low stock the secondary */}
                        <button
                          onClick={goRestock}
                          className={cn(
                            'hidden flex-shrink-0 items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-bold transition-colors sm:inline-flex',
                            cfg.primary
                              ? 'bg-primary text-primary-foreground hover:opacity-90'
                              : 'border border-border bg-card text-foreground hover:bg-accent'
                          )}
                        >
                          Restock
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Mobile restock button */}
                      <button
                        onClick={goRestock}
                        className={cn(
                          'mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors sm:hidden',
                          cfg.primary
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border bg-card text-foreground'
                        )}
                      >
                        Restock
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* ── LOADING SKELETONS ── */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-11 w-80 max-w-full rounded-xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] border border-border bg-card" />
            ))}
          </div>
        )}

        {/* ── EMPTY FILTER STATE ── */}
        {!loading && !allClear && visibleItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center rounded-2xl border border-border bg-card p-10 text-center"
          >
            <Package className="mb-2 h-9 w-9 text-border" />
            <p className="text-sm font-semibold text-muted-foreground">
              No {activeFilter === 'all' ? '' : STATUS_CONFIG[activeFilter].label.toLowerCase() + ' '}alerts
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}