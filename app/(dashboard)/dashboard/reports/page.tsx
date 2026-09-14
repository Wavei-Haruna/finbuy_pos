'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Product, SalesRecord, Expense, ServiceRecord } from '@/lib/types';
import { useBusiness } from '@/lib/business-context';
import { useAuth } from '@/lib/auth-context';
import { totalExpensesInPeriod } from '@/app/(dashboard)/dashboard/expenses/expense-utils';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Award,
  BarChart3, Loader2, ArrowUpRight, ArrowDownRight,
  ShoppingBag, Layers, Wallet, Sparkles, Minus, Banknote, ShieldAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type TimeRange = 'day' | 'week' | 'month';

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

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const TIME_RANGES: { key: TimeRange; label: string; short: string }[] = [
  { key: 'day',   label: 'Today',      short: '1D'  },
  { key: 'week',  label: 'This Week',  short: '7D'  },
  { key: 'month', label: 'This Month', short: '30D' },
];

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

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl ${className}`} />
);

const ComposedTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 shadow-xl space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{p.name || p.dataKey}</span>
          <span className="text-xs font-black text-gray-900 dark:text-white ml-auto">₵{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{payload[0].name}</p>
      <p className="text-sm font-black text-gray-900 dark:text-white">₵{Number(payload[0].value).toLocaleString()}</p>
    </div>
  );
};

function EmptyChart({ icon: Icon, label, height }: { icon: any; label: string; height: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${height} text-center px-4`}>
      <Icon className="w-9 h-9 text-gray-200 dark:text-gray-700 mb-2" />
      <p className="text-xs font-semibold text-gray-400">{label}</p>
    </div>
  );
}

/** Small trend pill — up/down/flat vs previous equivalent period */
function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const flat = Math.abs(pct) < 0.5;
  const up   = pct > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = flat
    ? 'text-gray-400 bg-gray-100 dark:bg-gray-800'
    : up
      ? 'text-green-600 dark:text-green-400 bg-green-500/10'
      : 'text-red-600 dark:text-red-400 bg-red-500/10';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-md ${color}`}>
      <Icon className="w-3 h-3" />
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
  const isRestricted   = !!user && !canSeeExpenses && user.role !== 'sales'; // defensive; nav already hides this for 'sales'/'staff'

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

  const { filteredSales, hasActivity, stats, salesChartData, categoryData, topProducts, deltas } = useMemo(() => {
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
      filteredSales: filtered,
      hasActivity: filtered.length + filteredServiceJobs.length > 0,
      stats: {
        totalRevenue, totalCost, totalGrossProfit, totalExpenses, totalNetProfit, netMargin,
        totalUnitsSold, avgOrderValue, totalOrders, topProduct,
      },
      salesChartData,
      categoryData,
      topProducts: prodArr.slice(0, 5),
      deltas,
    };
  }, [allSales, allServiceJobs, products, expenses, timeRange, canSeeExpenses]);

  const rangeLabel = timeRange === 'day' ? 'Today' : timeRange === 'week' ? 'This Week' : 'This Month';
  const fmt = (v: number) => v >= 1000 ? `₵${(v / 1000).toFixed(1)}K` : `₵${Math.round(v).toLocaleString()}`;

  const statCards = [
    {
      label: 'Total Revenue', icon: DollarSign, delta: deltas.revenue,
      value: fmt(stats.totalRevenue),
      accent: '#22c55e', bg: 'bg-green-500/8', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/15',
    },
    {
      label: canSeeExpenses ? 'Net Profit' : 'Gross Profit', icon: Wallet, delta: deltas.netProfit,
      value: fmt(canSeeExpenses ? stats.totalNetProfit : stats.totalGrossProfit),
      sub: canSeeExpenses
        ? `${fmt(stats.totalGrossProfit)} gross − ${fmt(stats.totalExpenses)} expenses`
        : `${stats.netMargin.toFixed(0)}% margin`,
      accent: '#8b5cf6', bg: 'bg-purple-500/8', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/15',
    },
    {
      label: 'Units Sold', icon: Package, delta: null,
      value: stats.totalUnitsSold.toLocaleString(),
      accent: '#3b82f6', bg: 'bg-blue-500/8', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/15',
    },
    {
      label: 'Total Orders', icon: ShoppingBag, delta: deltas.orders,
      value: stats.totalOrders.toLocaleString(),
      accent: '#f59e0b', bg: 'bg-amber-500/8', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/15',
    },
    {
      label: 'Avg Order Value', icon: TrendingUp, delta: deltas.aov,
      value: `₵${Math.round(stats.avgOrderValue).toLocaleString()}`,
      accent: '#ec4899', bg: 'bg-pink-500/8', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/15',
    },
  ];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a] relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-green-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-40 -left-24 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px]" />

      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent relative z-10" />

      <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto space-y-5 pb-10 relative z-10">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-green-500 uppercase tracking-[0.15em] mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Analytics · <span className="text-gray-400 font-normal">{activeBusiness?.name ?? '—'}</span>
            </p>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
              Reports<span className="text-green-500">.</span>
            </h1>
          </div>

          {/* Time range toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm self-start sm:self-auto">
            {TIME_RANGES.map((r) => (
              <button key={r.key} onClick={() => setTimeRange(r.key)}
                className={`relative px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
                  timeRange === r.key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}>
                <span className="sm:hidden">{r.short}</span>
                <span className="hidden sm:inline">{r.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {!canSeeExpenses && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <p className="text-xs font-semibold">Showing gross profit only — expense-adjusted net profit is visible to admins and managers.</p>
          </div>
        )}

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[92px] sm:h-[108px]" />)
            : statCards.map((card, i) => (
              <motion.div key={card.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
                whileHover={{ y: -2 }}>
                <div className={`rounded-2xl border ${card.border} ${card.bg} bg-white dark:bg-gray-900 p-4 sm:p-5 relative overflow-hidden hover:shadow-lg transition-shadow`}>
                  <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.08] blur-xl" style={{ background: card.accent }} />
                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5 truncate">{card.label}</p>
                      <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-none truncate">{card.value}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <p className="text-[10px] text-gray-400 truncate">{'sub' in card && card.sub ? card.sub : rangeLabel}</p>
                        <TrendBadge pct={card.delta} />
                      </div>
                    </div>
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center flex-shrink-0`}>
                      <card.icon className={`w-4 h-4 ${card.text}`} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          }
        </div>

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Revenue & profit trend */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-5 bg-green-500 rounded-full" />
                  <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                    Revenue & {canSeeExpenses ? 'Net Profit' : 'Profit'} — {rangeLabel}
                  </h3>
                </div>
                {hasActivity && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                      {fmt(stats.totalRevenue)} revenue
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      {fmt(canSeeExpenses ? stats.totalNetProfit : stats.totalGrossProfit)} {canSeeExpenses ? 'net' : 'profit'}
                    </span>
                    {canSeeExpenses && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                        {fmt(stats.totalExpenses)} expenses
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-5">
                {loading ? (
                  <Skeleton className="h-[220px] sm:h-[260px]" />
                ) : !hasActivity ? (
                  <EmptyChart icon={BarChart3} label={`No sales or services ${rangeLabel.toLowerCase()}`} height="h-[220px] sm:h-[260px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={salesChartData} barCategoryGap="30%">
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.35} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor"
                        className="text-gray-100 dark:text-gray-800" strokeOpacity={1} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }}
                        className="text-gray-400" axisLine={false} tickLine={false}
                        interval={timeRange === 'month' ? 4 : 0} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }}
                        className="text-gray-400" axisLine={false} tickLine={false} width={52}
                        tickFormatter={(v) => v >= 1000 ? `₵${(v / 1000).toFixed(0)}K` : `₵${v}`} />
                      <Tooltip content={<ComposedTooltip />} cursor={{ fill: 'rgba(34,197,94,0.06)', radius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} iconType="circle" iconSize={8} />
                      <Bar dataKey="revenue" name="Revenue" fill="url(#revenueGrad)" radius={[6, 6, 2, 2]} maxBarSize={40} />
                      <Line type="monotone" dataKey="netProfit" name={canSeeExpenses ? 'Net Profit' : 'Profit'} stroke="#8b5cf6" strokeWidth={2.5}
                        dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      {canSeeExpenses && (
                        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2.5}
                          strokeDasharray="4 3" dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>

          {/* Category donut */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden h-full">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-500 rounded-full" />
                <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">By Category</h3>
              </div>
              <div className="p-4 sm:p-5">
                {loading ? (
                  <Skeleton className="h-[220px]" />
                ) : categoryData.length === 0 ? (
                  <EmptyChart icon={Layers} label="No category data" height="h-[220px]" />
                ) : (
                  <>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={categoryData} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
                            dataKey="value" stroke="none" paddingAngle={3}>
                            {categoryData.map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{fmt(stats.totalRevenue)}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {categoryData.map((cat, idx) => {
                        const pct = stats.totalRevenue > 0 ? ((cat.value / stats.totalRevenue) * 100).toFixed(0) : '0';
                        return (
                          <div key={cat.name} className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex-1 truncate">{cat.name}</span>
                            <span className="text-xs font-black text-gray-900 dark:text-white flex-shrink-0">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Top products */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <span className="w-1 h-5 bg-amber-400 rounded-full" />
                <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">Top Products</h3>
                <span className="ml-auto text-[10px] font-black text-gray-400 uppercase tracking-wider">{rangeLabel}</span>
              </div>
              {loading ? (
                <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : topProducts.length === 0 ? (
                <EmptyChart icon={Award} label="No product data" height="h-32" />
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {topProducts.map((p, i) => {
                    const maxRevenue = topProducts[0]?.revenue ?? 1;
                    const pct = Math.round((p.revenue / maxRevenue) * 100);
                    const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                    return (
                      <motion.div key={p.name}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 + i * 0.05 }}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          i === 0 ? 'bg-amber-400 text-white'
                          : i === 1 ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                          <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full bg-green-500"
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.4 + i * 0.05, duration: 0.6, ease: 'easeOut' }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-black text-gray-900 dark:text-white">{fmt(p.revenue)}</p>
                          <p className="text-[10px] text-purple-500 dark:text-purple-400 font-bold">{fmt(p.profit)} gross</p>
                          <p className="text-[10px] text-gray-400">{p.quantity} units · {margin.toFixed(0)}% margin</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Inventory health */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <span className="w-1 h-5 bg-purple-500 rounded-full" />
                <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">Inventory Health</h3>
                <span className="ml-auto text-[10px] text-gray-400 font-bold">Live</span>
              </div>
              {loading ? (
                <div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
              ) : (
                <div className="p-5 space-y-3">
                  {[
                    { label: 'Total Products',  value: products.length,                                                                          bg: 'bg-gray-100 dark:bg-gray-800',              text: 'text-gray-700 dark:text-gray-300', icon: Package       },
                    { label: 'Healthy Stock',   value: products.filter((p) => p.quantity > (p.lowStockAlert ?? 5)).length,                       bg: 'bg-green-500/8 border border-green-500/15', text: 'text-green-600 dark:text-green-400', icon: TrendingUp   },
                    { label: 'Low Stock',       value: products.filter((p) => p.quantity > 0 && p.quantity <= (p.lowStockAlert ?? 5)).length,    bg: 'bg-amber-500/8 border border-amber-500/15', text: 'text-amber-600 dark:text-amber-400', icon: ArrowDownRight },
                    { label: 'Out of Stock',    value: products.filter((p) => p.quantity === 0).length,                                          bg: 'bg-red-500/8 border border-red-500/15',     text: 'text-red-600 dark:text-red-400',    icon: ArrowDownRight },
                  ].map((item, i) => (
                    <motion.div key={item.label}
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + i * 0.05 }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl ${item.bg}`}>
                      <div className="flex items-center gap-2.5">
                        <item.icon className={`w-3.5 h-3.5 ${item.text}`} />
                        <span className={`text-xs font-bold ${item.text}`}>{item.label}</span>
                      </div>
                      <span className={`text-lg font-black ${item.text}`}>{item.value}</span>
                    </motion.div>
                  ))}

                  {/* Total stock value + potential profit if sold at listed price */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Value (selling)</span>
                      <span className="text-base font-black text-gray-900 dark:text-white">
                        ₵{products.reduce((s, p) => s + calcProductValue(p), 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Value (cost)</span>
                      <span className="text-sm font-black text-gray-500 dark:text-gray-400">
                        ₵{products.reduce((s, p) => s + getUnitCost(p) * p.quantity, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider">Potential Profit</span>
                      <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                        ₵{products.reduce((s, p) => s + (calcProductValue(p) - getUnitCost(p) * p.quantity), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}