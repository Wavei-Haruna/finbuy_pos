'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Product, SalesRecord, Expense, ServiceRecord } from '@/lib/types';
import { useBusiness } from '@/lib/business-context';
import { useAuth } from '@/lib/auth-context';
import { totalExpensesInPeriod } from '@/app/(dashboard)/dashboard/expenses/expense-utils';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { BarChart3, Layers, Award, ArrowUpRight, ArrowDownRight, Minus, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type TimeRange = 'day' | 'week' | 'month';
type Tone = 'danger' | 'tint' | 'neutral' | 'warn';

interface Stats {
  totalRevenue:    number;
  totalCost:       number;
  totalGrossProfit: number;
  totalExpenses:   number;
  totalNetProfit:  number;
  netMargin:       number;
  totalUnitsSold:  number;
  avgOrderValue:   number;
  totalOrders:     number;
  topProduct:      { name: string; quantity: number };
}

interface Deltas {
  revenue: number | null;
  netProfit: number | null;
  orders:  number | null;
  aov:     number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  'home-appliances':          'Home Appliances',
  'sneakers':                  'Sneakers',
  'phone-laptop-accessories':  'Tech Accessories',
  'clothing':                  'Clothing',
  'food-beverages':            'Food & Beverages',
  'other':                     'Other',
};

// Recharts draws SVG, so these are the hex values of the brand tokens in globals.css
// (lime 75 100% 48%, forest 163 86% 20%, emerald 146 80% 35%, leaf 98 73% 46%, deep 166 85% 8%).
const BRAND = {
  lime:    '#B8F500',
  forest:  '#075F46',
  emerald: '#12A150',
  leaf:    '#5ECB20',
  slate:   '#556D66',
  deep:    '#03261E',
};
const CHART_COLORS = [BRAND.forest, BRAND.emerald, BRAND.leaf, BRAND.lime, BRAND.slate, BRAND.deep];

const TIME_RANGES: { key: TimeRange; label: string; short: string }[] = [
  { key: 'day',   label: 'Today',      short: '1D'  },
  { key: 'week',  label: 'This Week',  short: '7D'  },
  { key: 'month', label: 'This Month', short: '30D' },
];

// Light-card tones: each card carries its own meaning.
const TONES: Record<Tone, { card: string; label: string; value: string; sub: string }> = {
  danger: {
    card:  'border-destructive/20 bg-destructive/10',
    label: 'text-destructive/80',
    value: 'text-destructive',
    sub:   'text-destructive/70',
  },
  tint: {
    card:  'border-[hsl(var(--brand-emerald)/0.25)] bg-accent',
    label: 'text-accent-foreground/70',
    value: 'text-accent-foreground',
    sub:   'text-accent-foreground/60',
  },
  warn: {
    card:  'border-amber-300/70 bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/15',
    label: 'text-amber-800/80 dark:text-amber-300/80',
    value: 'text-amber-900 dark:text-amber-200',
    sub:   'text-amber-800/70 dark:text-amber-300/70',
  },
  neutral: {
    card:  'border-border bg-card',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    sub:   'text-muted-foreground',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get the start-of-day boundary for a given range — always calendar-accurate */
function getRangeStart(range: TimeRange, ref: Date = new Date()): Date {
  const now = ref;
  if (range === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  if (range === 'week') {
    const day  = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/** Bounds for the immediately preceding equivalent period, used for trend deltas */
function getPreviousRangeBounds(range: TimeRange): { start: Date; end: Date } {
  const currentStart = getRangeStart(range);
  if (range === 'day') {
    const start = new Date(currentStart);
    start.setDate(start.getDate() - 1);
    return { start, end: currentStart };
  }
  if (range === 'week') {
    const start = new Date(currentStart);
    start.setDate(start.getDate() - 7);
    return { start, end: currentStart };
  }
  // month
  const start = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
  return { start, end: currentStart };
}

/** Build chart buckets for day = per-hour, week = per-weekday, month = per-day-of-month.
 *  Each bucket also carries its own [start, end) window so expenses can be
 *  prorated per-bucket the same way they are for the dashboard's daily numbers. */
function buildChartBuckets(range: TimeRange): { key: string; label: string; ts: number; end: number }[] {
  const now   = new Date();
  const start = getRangeStart(range);
  const buckets: { key: string; label: string; ts: number; end: number }[] = [];
  const HOUR = 60 * 60 * 1000;
  const DAY  = 24 * HOUR;

  if (range === 'day') {
    for (let h = 0; h <= now.getHours(); h++) {
      const d = new Date(start);
      d.setHours(h);
      buckets.push({
        key:   `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${h}`,
        label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`,
        ts:    d.getTime(),
        end:   d.getTime() + HOUR,
      });
    }
  } else if (range === 'week') {
    const day = now.getDay();
    const daysFromMon = day === 0 ? 6 : day - 1;
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i <= daysFromMon; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({
        key:   d.toDateString(),
        label: DAYS[(start.getDay() + i - 1 + 7) % 7] || DAYS[i],
        ts:    d.getTime(),
        end:   d.getTime() + DAY,
      });
    }
    buckets.forEach((b) => {
      const d = new Date(b.ts);
      b.label = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
    });
  } else {
    const daysInMonth = now.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d);
      buckets.push({
        key:   dt.toDateString(),
        label: `${d}`,
        ts:    dt.getTime(),
        end:   dt.getTime() + DAY,
      });
    }
  }

  return buckets;
}

/** Map any timestamp to a bucket key */
function dateToBucketKey(d: Date, range: TimeRange): string {
  if (range === 'day') {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
}

/** Map a sale to a bucket key */
function saleToBucketKey(sale: SalesRecord, range: TimeRange): string {
  return dateToBucketKey(sale.recordedAt, range);
}

/** Per-unit cost for a product — falls back sensibly across schema variants */
function getUnitCost(p?: Product): number {
  if (!p) return 0;
  return (p as any).pieceCost ?? p.costPrice ?? 0;
}

/** Cost incurred for a single sale, based on the product's current unit cost */
function getSaleCost(sale: SalesRecord, p?: Product): number {
  return getUnitCost(p) * sale.quantity;
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
  <div className={cn('animate-pulse rounded-xl bg-muted', className)} />
);

const ComposedTooltip = ({ active, payload, label, profitLabel }: any) => {
  if (!active || !payload?.length) return null;
  const meta: Record<string, { name: string; color: string }> = {
    revenue:   { name: 'Revenue',    color: BRAND.lime },
    netProfit: { name: profitLabel,  color: BRAND.forest },
    expenses:  { name: 'Expenses',   color: '#ef4444' },
  };
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xl">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      {payload.map((p: any) => {
        const m = meta[p.dataKey];
        if (!m) return null;
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
            <span className="text-[11px] font-semibold text-muted-foreground">{m.name}</span>
            <span className="tabular ml-auto pl-3 text-xs font-bold text-foreground">₵{Number(p.value).toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xl">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{payload[0].name}</p>
      <p className="tabular text-sm font-bold text-foreground">₵{Number(payload[0].value).toLocaleString()}</p>
    </div>
  );
};

function EmptyChart({ icon: Icon, label, height, onDark = false }: { icon: any; label: string; height: string; onDark?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 text-center', height)}>
      <Icon className={cn('mb-2 h-9 w-9', onDark ? 'text-white/20' : 'text-border')} />
      <p className={cn('text-xs font-semibold', onDark ? 'text-white/50' : 'text-muted-foreground')}>{label}</p>
    </div>
  );
}

/** Small trend pill — up/down/flat vs previous equivalent period */
function TrendBadge({ pct, onDark = false }: { pct: number | null; onDark?: boolean }) {
  if (pct === null) return null;
  const flat = Math.abs(pct) < 0.5;
  const up   = pct > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = onDark
    ? flat
      ? 'bg-white/10 text-white/70'
      : up
        ? 'bg-[hsl(var(--brand-lime))] text-[hsl(var(--brand-deep))]'
        : 'bg-red-400/20 text-red-300'
    : flat
      ? 'bg-muted text-muted-foreground'
      : up
        ? 'bg-[hsl(var(--brand-emerald)/0.12)] text-[hsl(var(--brand-emerald))]'
        : 'bg-destructive/10 text-destructive';
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold', color)}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

// ─── Smart stock value (same logic as products page) ──────────────────────────
function calcProductValue(p: Product): number {
  const piecePrice = (p as any).piecePrice ?? p.sellingPrice ?? 0;
  if ((p as any).boxEnabled && (p as any).boxPrice && (p as any).boxQty > 1) {
    const fullBoxes    = Math.floor(p.quantity / (p as any).boxQty);
    const remainingPcs = p.quantity % (p as any).boxQty;
    return fullBoxes * (p as any).boxPrice + remainingPcs * piecePrice;
  }
  return piecePrice * p.quantity;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { activeBusiness } = useBusiness();
  const { user } = useAuth();

  // Salaries live inside expenses — only admin/manager see the expense-adjusted
  // (real) profit numbers here. Same gate as the Expenses page and dashboard.
  const canSeeExpenses = !!user && (user.role === 'admin' || user.role === 'manager');

  const [products,  setProducts]  = useState<Product[]>([]);
  const [allSales,  setAllSales]  = useState<SalesRecord[]>([]);
  const [allServiceJobs, setAllServiceJobs] = useState<ServiceRecord[]>([]);
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!activeBusiness) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [prodSnap, salesSnap, servicesSnap, expensesSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))),
          getDocs(query(collection(db, 'sales'),    where('businessId', '==', activeBusiness.id))),
          getDocs(query(collection(db, 'serviceRecords'), where('businessId', '==', activeBusiness.id))),
          canSeeExpenses
            ? getDocs(query(collection(db, 'expenses'), where('businessId', '==', activeBusiness.id)))
            : Promise.resolve(null),
        ]);
        setProducts(prodSnap.docs.map((d) => ({
          id: d.id, ...d.data(),
          dateAdded:   d.data().dateAdded?.toDate()   || new Date(),
          lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
        })) as Product[]);
        setAllSales(salesSnap.docs.map((d) => ({
          id: d.id, ...d.data(),
          recordedAt: d.data().recordedAt?.toDate() || new Date(),
        })) as SalesRecord[]);
        setAllServiceJobs(servicesSnap.docs.map((d) => ({
          id: d.id, ...d.data(),
          recordedAt: d.data().recordedAt?.toDate() || new Date(),
        })) as ServiceRecord[]);
        setExpenses(
          expensesSnap
            ? (expensesSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
                startDate: d.data().startDate?.toDate() || new Date(),
                endDate:   d.data().endDate?.toDate() || null,
                createdAt: d.data().createdAt?.toDate() || new Date(),
              })) as Expense[])
            : []
        );
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [activeBusiness, canSeeExpenses]);

  const { hasActivity, stats, salesChartData, categoryData, topProducts, deltas } = useMemo(() => {
    const now         = new Date();
    const rangeStart   = getRangeStart(timeRange);
    const filtered     = allSales.filter((s) => s.recordedAt >= rangeStart);
    const filteredServiceJobs = allServiceJobs.filter((r) => r.recordedAt >= rangeStart);
    const findProduct  = (id: string) => products.find((x) => x.id === id);

    // Stats — gross first (revenue - cost of goods / parts), then net (gross - real expenses).
    // Service jobs (flashing, unlocking, repairs) have no inventory cost — their "cost" is
    // whatever parts were logged against the job, 0 for pure labor — but they're real revenue
    // and count toward the same profit numbers as product sales.
    const salesRevenue      = filtered.reduce((s, r) => s + r.totalAmount, 0);
    const salesCost         = filtered.reduce((s, r) => s + getSaleCost(r, findProduct(r.productId)), 0);
    const serviceRevenue    = filteredServiceJobs.reduce((s, r) => s + r.price, 0);
    const serviceCost       = filteredServiceJobs.reduce((s, r) => s + r.cost, 0);
    const totalRevenue     = salesRevenue + serviceRevenue;
    const totalCost        = salesCost + serviceCost;
    const totalGrossProfit = totalRevenue - totalCost;
    const totalExpenses    = canSeeExpenses ? totalExpensesInPeriod(expenses, rangeStart, now) : 0;
    const totalNetProfit   = totalGrossProfit - totalExpenses;
    const netMargin        = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
    const totalUnitsSold   = filtered.reduce((s, r) => s + r.quantity, 0);
    const totalOrders      = filtered.length + filteredServiceJobs.length;
    const avgOrderValue    = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Per-product map (revenue + gross profit — expenses aren't tied to a single product)
    const prodMap: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};
    filtered.forEach((sale) => {
      const p = findProduct(sale.productId);
      if (!p) return;
      if (!prodMap[sale.productId]) prodMap[sale.productId] = { name: p.name, quantity: 0, revenue: 0, profit: 0 };
      const cost = getSaleCost(sale, p);
      prodMap[sale.productId].quantity += sale.quantity;
      prodMap[sale.productId].revenue  += sale.totalAmount;
      prodMap[sale.productId].profit   += (sale.totalAmount - cost);
    });
    const prodArr    = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue);
    const topProduct = prodArr[0] ?? { name: 'N/A', quantity: 0 };

    // Chart — build all buckets first (so empty days still show), fill with revenue, net profit,
    // and (for admins/managers) expenses. Expenses are prorated per-bucket using each bucket's
    // own [ts, end) window — same accrual logic as the dashboard, just applied hour-by-hour or day-by-day.
    const buckets  = buildChartBuckets(timeRange);
    const revenueByKey: Record<string, number> = {};
    const grossByKey:   Record<string, number> = {};
    filtered.forEach((sale) => {
      const k = saleToBucketKey(sale, timeRange);
      const p = findProduct(sale.productId);
      const cost = getSaleCost(sale, p);
      revenueByKey[k] = (revenueByKey[k] || 0) + sale.totalAmount;
      grossByKey[k]   = (grossByKey[k]   || 0) + (sale.totalAmount - cost);
    });
    filteredServiceJobs.forEach((job) => {
      const k = dateToBucketKey(job.recordedAt, timeRange);
      revenueByKey[k] = (revenueByKey[k] || 0) + job.price;
      grossByKey[k]   = (grossByKey[k]   || 0) + (job.price - job.cost);
    });
    const salesChartData = buckets.map((b) => {
      const bucketExpenses = canSeeExpenses
        ? totalExpensesInPeriod(expenses, new Date(b.ts), new Date(Math.min(b.end, now.getTime())))
        : 0;
      return {
        date:      b.label,
        revenue:   Math.round(revenueByKey[b.key] || 0),
        netProfit: Math.round((grossByKey[b.key] || 0) - bucketExpenses),
        ...(canSeeExpenses ? { expenses: Math.round(bucketExpenses) } : {}),
      };
    });

    // Category breakdown
    const catMap: Record<string, number> = {};
    filtered.forEach((sale) => {
      const p = findProduct(sale.productId);
      if (!p) return;
      catMap[p.category] = (catMap[p.category] || 0) + sale.totalAmount;
    });
    const categoryData = Object.entries(catMap)
      .map(([cat, val]) => ({ name: CATEGORY_LABELS[cat] || cat, value: Math.round(val) }))
      .sort((a, b) => b.value - a.value);

    // Previous-period deltas
    const { start: prevStart, end: prevEnd } = getPreviousRangeBounds(timeRange);
    const prevFiltered      = allSales.filter((s) => s.recordedAt >= prevStart && s.recordedAt < prevEnd);
    const prevServiceJobs   = allServiceJobs.filter((r) => r.recordedAt >= prevStart && r.recordedAt < prevEnd);
    const prevSalesRevenue  = prevFiltered.reduce((s, r) => s + r.totalAmount, 0);
    const prevSalesCost     = prevFiltered.reduce((s, r) => s + getSaleCost(r, findProduct(r.productId)), 0);
    const prevServiceRevenue = prevServiceJobs.reduce((s, r) => s + r.price, 0);
    const prevServiceCost    = prevServiceJobs.reduce((s, r) => s + r.cost, 0);
    const prevRevenue     = prevSalesRevenue + prevServiceRevenue;
    const prevGrossProfit = prevRevenue - (prevSalesCost + prevServiceCost);
    const prevExpenses    = canSeeExpenses ? totalExpensesInPeriod(expenses, prevStart, prevEnd) : 0;
    const prevNetProfit   = prevGrossProfit - prevExpenses;
    const prevOrders      = prevFiltered.length + prevServiceJobs.length;
    const prevAov         = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    const pct = (curr: number, prev: number): number | null => {
      if (prev === 0) return curr > 0 ? 100 : null;
      return ((curr - prev) / prev) * 100;
    };

    const deltas: Deltas = {
      revenue:   pct(totalRevenue, prevRevenue),
      netProfit: pct(totalNetProfit, prevNetProfit),
      orders:    pct(totalOrders, prevOrders),
      aov:       pct(avgOrderValue, prevAov),
    };

    return {
      hasActivity: filtered.length + filteredServiceJobs.length > 0,
      stats: {
        totalRevenue, totalCost, totalGrossProfit, totalExpenses, totalNetProfit, netMargin,
        totalUnitsSold, avgOrderValue, totalOrders, topProduct,
      } as Stats,
      salesChartData,
      categoryData,
      topProducts: prodArr.slice(0, 5),
      deltas,
    };
  }, [allSales, allServiceJobs, products, expenses, timeRange, canSeeExpenses]);

  const rangeLabel = timeRange === 'day' ? 'Today' : timeRange === 'week' ? 'This week' : 'This month';
  const prevLabel  = timeRange === 'day' ? 'yesterday' : timeRange === 'week' ? 'last week' : 'last month';
  const bucketUnit = timeRange === 'day' ? 'hour' : 'day';

  const profitValue = canSeeExpenses ? stats.totalNetProfit : stats.totalGrossProfit;
  const profitLabel = canSeeExpenses ? 'Net profit' : 'Gross profit';
  const profitSub = canSeeExpenses
    ? `${fmt(stats.totalGrossProfit)} gross − ${fmt(stats.totalExpenses)} expenses`
    : 'Revenue minus cost of goods';
  const margin = Math.round(stats.netMargin);

  // The standout bucket gets the lime bar, like the landing preview
  const peak = salesChartData.reduce(
    (best, d, i) => (d.revenue > best.value ? { index: i, value: d.revenue, label: d.date } : best),
    { index: -1, value: 0, label: '' }
  );

  const expensePct =
    stats.totalRevenue > 0
      ? `${Math.round((stats.totalExpenses / stats.totalRevenue) * 100)}% of revenue`
      : 'No revenue to compare';

  const smallCards: { label: string; value: string; sub: string; tone: Tone; delta: number | null }[] = [
    canSeeExpenses
      ? { label: 'Expenses', value: fmt(stats.totalExpenses), sub: expensePct, tone: 'danger', delta: null }
      : { label: 'Cost of sales', value: fmt(stats.totalCost), sub: 'Goods & parts sold', tone: 'neutral', delta: null },
    { label: 'Orders', value: stats.totalOrders.toLocaleString(), sub: rangeLabel, tone: 'neutral', delta: deltas.orders },
    { label: 'Avg order', value: fmt(stats.avgOrderValue), sub: 'Per transaction', tone: 'tint', delta: deltas.aov },
    { label: 'Units sold', value: stats.totalUnitsSold.toLocaleString(), sub: rangeLabel, tone: 'neutral', delta: null },
  ];

  // Inventory
  const healthyCount = products.filter((p) => p.quantity > (p.lowStockAlert ?? 5)).length;
  const lowCount     = products.filter((p) => p.quantity > 0 && p.quantity <= (p.lowStockAlert ?? 5)).length;
  const outCount     = products.filter((p) => p.quantity === 0).length;
  const stockSelling = products.reduce((s, p) => s + calcProductValue(p), 0);
  const stockCost    = products.reduce((s, p) => s + getUnitCost(p) * p.quantity, 0);
  const stockPotential = stockSelling - stockCost;

  const inventoryTiles: { label: string; value: number; tone: Tone }[] = [
    { label: 'Total products', value: products.length, tone: 'neutral' },
    { label: 'Healthy stock',  value: healthyCount,    tone: 'tint' },
    { label: 'Low stock',      value: lowCount,        tone: 'warn' },
    { label: 'Out of stock',   value: outCount,        tone: 'danger' },
  ];

  const axisTick = { fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.55)' };

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
            <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Reports</h1>
            <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
              {activeBusiness?.name ?? '—'} · Sales, profit and stock at a glance
            </p>
          </div>

          <div className="inline-flex self-start rounded-xl bg-border/60 p-1 sm:self-auto">
            {TIME_RANGES.map((r) => {
              const active = timeRange === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setTimeRange(r.key)}
                  className={cn(
                    'relative rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="reportsPill"
                      className="absolute inset-0 rounded-lg bg-card shadow-sm"
                      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap sm:hidden">{r.short}</span>
                  <span className="relative z-10 hidden whitespace-nowrap sm:inline">{r.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {!canSeeExpenses && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/70 bg-amber-100/70 px-4 py-2.5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
            <p className="text-xs font-semibold">Showing gross profit only. Expense-adjusted net profit is visible to admins and managers.</p>
          </div>
        )}

        {/* ── HERO: chart panel + profit/KPI stack ── */}
        <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">

          {/* Chart panel, same language as the landing "whole day at a glance" card */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col rounded-2xl border border-white/10 bg-[hsl(var(--brand-deep))] p-5 dark:border-border dark:bg-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white/60">{rangeLabel}</p>
                <p className="tabular mt-0.5 font-heading text-[34px] font-bold leading-none text-white">
                  {loading ? '—' : fmt(stats.totalRevenue)}
                </p>
                {!loading && deltas.revenue !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    <TrendBadge pct={deltas.revenue} onDark />
                    <span className="text-xs text-white/50">vs {prevLabel}</span>
                  </div>
                )}
              </div>
              <span className="rounded-full bg-[hsl(var(--brand-lime))] px-3 py-1 text-xs font-bold text-[hsl(var(--brand-deep))]">
                Sales
              </span>
            </div>

            <div className="mt-5 flex-1">
              {loading ? (
                <Skeleton className="h-[250px] bg-white/10" />
              ) : !hasActivity ? (
                <EmptyChart
                  icon={BarChart3}
                  label={`No sales or services ${rangeLabel.toLowerCase()}`}
                  height="h-[250px]"
                  onDark
                />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={salesChartData} barCategoryGap="22%">
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      interval={timeRange === 'month' ? 4 : 0}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v) => (v >= 1000 ? `₵${(v / 1000).toFixed(0)}K` : `₵${v}`)}
                    />
                    <Tooltip
                      content={<ComposedTooltip profitLabel={profitLabel} />}
                      cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 8 }}
                    />
                    <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 3, 3]} maxBarSize={46}>
                      {salesChartData.map((_, idx) => (
                        <Cell key={idx} fill={idx === peak.index ? BRAND.lime : 'rgba(255,255,255,0.16)'} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="netProfit"
                      name={profitLabel}
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#ffffff', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                    {canSeeExpenses && (
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        name="Expenses"
                        stroke="#fca5a5"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={{ r: 3, fill: '#fca5a5', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Custom legend: Recharts' own can't show the lime peak bar */}
            {!loading && hasActivity && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/10 pt-3 text-xs font-semibold text-white/60">
                {peak.index >= 0 && (
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--brand-lime))]" />
                    <span>
                      Best {bucketUnit}: <span className="text-white">{peak.label}</span> ·{' '}
                      <span className="tabular text-[hsl(var(--brand-lime))]">{fmt(peak.value)}</span>
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-white/20" /> Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-0.5 w-3.5 bg-white" /> {profitLabel}
                </span>
                {canSeeExpenses && (
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block h-0 w-3.5 border-t-2 border-dashed border-red-300" /> Expenses
                  </span>
                )}
              </div>
            )}
          </motion.section>

          {/* Right stack: profit hero + four KPI cards */}
          <div className="grid grid-cols-2 content-start gap-3">
            {loading ? (
              <>
                <div className="col-span-2 h-[112px] animate-pulse rounded-2xl bg-[hsl(var(--brand-forest))]/30" />
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-border bg-card" />
                ))}
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="col-span-2 rounded-2xl border border-transparent bg-[hsl(var(--brand-forest))] px-4 py-3.5 sm:px-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">{profitLabel}</p>
                    {stats.totalRevenue > 0 && margin >= 0 && (
                      <span className="rounded-full bg-[hsl(var(--brand-lime))] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-deep))]">
                        {margin}% margin
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'tabular mt-1.5 font-heading text-[32px] font-bold leading-none',
                    profitValue < 0 ? 'text-red-300' : 'text-white'
                  )}>
                    {fmt(profitValue)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="tabular text-xs font-semibold text-white/60">{profitSub}</span>
                    <TrendBadge pct={deltas.netProfit} onDark />
                  </div>
                </motion.div>

                {smallCards.map((card, i) => {
                  const t = TONES[card.tone];
                  return (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                      className={cn('rounded-2xl border px-4 py-3.5', t.card)}
                    >
                      <p className={cn('text-[11px] font-bold uppercase tracking-wide', t.label)}>{card.label}</p>
                      <p className={cn('tabular mt-1.5 font-heading text-[24px] font-bold leading-none', t.value)}>
                        {card.value}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={cn('text-xs font-medium', t.sub)}>{card.sub}</span>
                        <TrendBadge pct={card.delta} />
                      </div>
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* ── TOP PRODUCTS + CATEGORY ── */}
        <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">

          {/* Top products */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex items-center justify-between px-5 py-3.5">
              <h2 className="font-heading text-[15px] font-bold text-foreground">Top products</h2>
              <span className="text-xs font-semibold text-muted-foreground">{rangeLabel}</span>
            </div>
            {loading ? (
              <div className="space-y-2 border-t border-border p-5">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="border-t border-border">
                <EmptyChart icon={Award} label="No product data" height="h-32" />
              </div>
            ) : (
              <ul>
                {topProducts.map((p, i) => {
                  const maxRevenue = topProducts[0]?.revenue ?? 1;
                  const pct = Math.round((p.revenue / maxRevenue) * 100);
                  const pMargin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                  return (
                    <motion.li
                      key={p.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className="flex items-center gap-3 border-t border-border px-5 py-3 transition-colors hover:bg-muted/60"
                    >
                      <span className={cn(
                        'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        i === 0
                          ? 'bg-[hsl(var(--brand-lime))] text-[hsl(var(--brand-deep))]'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full rounded-full bg-[hsl(var(--brand-emerald))]"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="tabular text-sm font-bold text-foreground">{fmt(p.revenue)}</p>
                        <p className="tabular text-[11px] font-semibold text-[hsl(var(--brand-emerald))]">{fmt(p.profit)} gross</p>
                        <p className="text-[11px] text-muted-foreground">{p.quantity} units · {pMargin.toFixed(0)}% margin</p>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.section>

          {/* Category donut */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="px-5 py-3.5">
              <h2 className="font-heading text-[15px] font-bold text-foreground">By category</h2>
            </div>
            <div className="border-t border-border p-5">
              {loading ? (
                <Skeleton className="h-[220px]" />
              ) : categoryData.length === 0 ? (
                <EmptyChart icon={Layers} label="No category data" height="h-[200px]" />
              ) : (
                <>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={78}
                          dataKey="value"
                          stroke="none"
                          paddingAngle={3}
                        >
                          {categoryData.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="tabular font-heading text-base font-bold text-foreground">{fmt(stats.totalRevenue)}</p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {categoryData.map((cat, idx) => {
                      const pct = stats.totalRevenue > 0 ? ((cat.value / stats.totalRevenue) * 100).toFixed(0) : '0';
                      return (
                        <li key={cat.name} className="flex items-center gap-2.5 text-sm">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{cat.name}</span>
                          <span className="tabular text-xs text-muted-foreground">{fmt(cat.value)}</span>
                          <span className="tabular w-9 text-right text-xs font-bold text-foreground">{pct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </motion.section>
        </div>

        {/* ── INVENTORY HEALTH ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="flex items-center justify-between px-5 py-3.5">
            <h2 className="font-heading text-[15px] font-bold text-foreground">Inventory health</h2>
            <span className="text-xs font-semibold text-muted-foreground">Live</span>
          </div>
          <div className="space-y-3 border-t border-border p-5">
            {loading ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[76px]" />)}
                </div>
                <Skeleton className="h-[76px]" />
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {inventoryTiles.map((tile) => {
                    const t = TONES[tile.tone];
                    return (
                      <div key={tile.label} className={cn('rounded-xl border px-4 py-3', t.card)}>
                        <p className={cn('text-[11px] font-bold uppercase tracking-wide', t.label)}>{tile.label}</p>
                        <p className={cn('tabular mt-1 font-heading text-[26px] font-bold leading-none', t.value)}>{tile.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Stock value strip: potential profit gets the lime accent */}
                <div className="grid grid-cols-1 gap-4 rounded-xl bg-[hsl(var(--brand-forest))] px-5 py-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">Stock value (selling)</p>
                    <p className="tabular mt-1 font-heading text-xl font-bold text-white">{fmt(stockSelling)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">Stock value (cost)</p>
                    <p className="tabular mt-1 font-heading text-xl font-bold text-white/80">{fmt(stockCost)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">Potential profit</p>
                    <p className="tabular mt-1 font-heading text-xl font-bold text-[hsl(var(--brand-lime))]">{fmt(stockPotential)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}