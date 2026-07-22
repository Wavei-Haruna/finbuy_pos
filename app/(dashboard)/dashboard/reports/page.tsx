'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Product, SalesRecord } from '@/lib/types';
import { useBusiness } from '@/lib/business-context';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, DollarSign, Package, Award,
  BarChart3, Loader2, ArrowUpRight, ArrowDownRight,
  ShoppingBag, Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type TimeRange = 'day' | 'week' | 'month';

interface Stats {
  totalRevenue:   number;
  totalUnitsSold: number;
  avgOrderValue:  number;
  totalOrders:    number;
  topProduct:     { name: string; quantity: number };
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
function getRangeStart(range: TimeRange): Date {
  const now = new Date();
  if (range === 'day') {
    // Start of today (midnight)
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  if (range === 'week') {
    // Start of this week — Monday
    const day  = now.getDay(); // 0=Sun, 1=Mon…
    const diff = (day === 0 ? -6 : 1 - day); // how many days back to Monday
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0, 0);
    return monday;
  }
  // Month — start of this month
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/** Build chart buckets for day = per-hour, week = per-weekday, month = per-day-of-month */
function buildChartBuckets(range: TimeRange): { key: string; label: string; ts: number }[] {
  const now   = new Date();
  const start = getRangeStart(range);
  const buckets: { key: string; label: string; ts: number }[] = [];

  if (range === 'day') {
    // Hours from midnight to current hour
    for (let h = 0; h <= now.getHours(); h++) {
      const d = new Date(start);
      d.setHours(h);
      buckets.push({
        key:   `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${h}`,
        label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`,
        ts:    d.getTime(),
      });
    }
  } else if (range === 'week') {
    // Monday → today
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
      });
    }
    // Fix labels — use actual weekday
    buckets.forEach((b) => {
      const d = new Date(b.ts);
      b.label = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
    });
  } else {
    // Days 1 → today in this month
    const daysInMonth = now.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d);
      buckets.push({
        key:   dt.toDateString(),
        label: `${d}`,
        ts:    dt.getTime(),
      });
    }
  }

  return buckets;
}

/** Map a sale to a bucket key */
function saleToBucketKey(sale: SalesRecord, range: TimeRange): string {
  const d = sale.recordedAt;
  if (range === 'day') {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
  }
  // week + month both key by date string
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
}

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl ${className}`} />
);

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-black text-gray-900 dark:text-white">₵{Number(payload[0].value).toLocaleString()}</p>
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

  const [products,  setProducts]  = useState<Product[]>([]);
  const [allSales,  setAllSales]  = useState<SalesRecord[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!activeBusiness) return;
    const fetchData = async () => {
      setLoading(true);
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
        setAllSales(salesSnap.docs.map((d) => ({
          id: d.id, ...d.data(),
          recordedAt: d.data().recordedAt?.toDate() || new Date(),
        })) as SalesRecord[]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [activeBusiness]);

  const { filteredSales, stats, salesChartData, categoryData, topProducts } = useMemo(() => {
    const rangeStart = getRangeStart(timeRange);
    const filtered   = allSales.filter((s) => s.recordedAt >= rangeStart);

    // Stats
    const totalRevenue   = filtered.reduce((s, r) => s + r.totalAmount, 0);
    const totalUnitsSold = filtered.reduce((s, r) => s + r.quantity, 0);
    const avgOrderValue  = filtered.length > 0 ? totalRevenue / filtered.length : 0;

    // Per-product map
    const prodMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    filtered.forEach((sale) => {
      const p = products.find((x) => x.id === sale.productId);
      if (!p) return;
      if (!prodMap[sale.productId]) prodMap[sale.productId] = { name: p.name, quantity: 0, revenue: 0 };
      prodMap[sale.productId].quantity += sale.quantity;
      prodMap[sale.productId].revenue  += sale.totalAmount;
    });
    const prodArr    = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue);
    const topProduct = prodArr[0] ?? { name: 'N/A', quantity: 0 };

    // Chart — build all buckets first (so empty days still show), then fill
    const buckets  = buildChartBuckets(timeRange);
    const revenueByKey: Record<string, number> = {};
    filtered.forEach((sale) => {
      const k = saleToBucketKey(sale, timeRange);
      revenueByKey[k] = (revenueByKey[k] || 0) + sale.totalAmount;
    });
    const salesChartData = buckets.map((b) => ({
      date:    b.label,
      revenue: Math.round(revenueByKey[b.key] || 0),
    }));

    // Category breakdown
    const catMap: Record<string, number> = {};
    filtered.forEach((sale) => {
      const p = products.find((x) => x.id === sale.productId);
      if (!p) return;
      catMap[p.category] = (catMap[p.category] || 0) + sale.totalAmount;
    });
    const categoryData = Object.entries(catMap)
      .map(([cat, val]) => ({ name: CATEGORY_LABELS[cat] || cat, value: Math.round(val) }))
      .sort((a, b) => b.value - a.value);

    return {
      filteredSales: filtered,
      stats: { totalRevenue, totalUnitsSold, avgOrderValue, totalOrders: filtered.length, topProduct },
      salesChartData,
      categoryData,
      topProducts: prodArr.slice(0, 5),
    };
  }, [allSales, products, timeRange]);

  const rangeLabel = timeRange === 'day' ? 'Today' : timeRange === 'week' ? 'This Week' : 'This Month';

  const statCards = [
    {
      label: 'Total Revenue', icon: DollarSign,
      value: stats.totalRevenue >= 1000 ? `₵${(stats.totalRevenue/1000).toFixed(1)}K` : `₵${Math.round(stats.totalRevenue).toLocaleString()}`,
      accent: '#22c55e', bg: 'bg-green-500/8', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/15',
    },
    {
      label: 'Units Sold', icon: Package,
      value: stats.totalUnitsSold.toLocaleString(),
      accent: '#3b82f6', bg: 'bg-blue-500/8', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/15',
    },
    {
      label: 'Total Orders', icon: ShoppingBag,
      value: stats.totalOrders.toLocaleString(),
      accent: '#f59e0b', bg: 'bg-amber-500/8', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/15',
    },
    {
      label: 'Avg Order Value', icon: TrendingUp,
      value: `₵${Math.round(stats.avgOrderValue).toLocaleString()}`,
      accent: '#ec4899', bg: 'bg-pink-500/8', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/15',
    },
  ];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent" />

      <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto space-y-5 pb-10">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-green-500 uppercase tracking-[0.15em] mb-1">
              Analytics · <span className="text-gray-400 font-normal">{activeBusiness?.name ?? '—'}</span>
            </p>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              Reports<span className="text-gray-300 dark:text-gray-600">.</span>
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

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] sm:h-[100px]" />)
            : statCards.map((card, i) => (
              <motion.div key={card.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}>
                <div className={`rounded-2xl border ${card.border} ${card.bg} bg-white dark:bg-gray-900 p-4 sm:p-5 relative overflow-hidden hover:shadow-md transition-shadow`}>
                  <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.06] blur-xl" style={{ background: card.accent }} />
                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5 truncate">{card.label}</p>
                      <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-none truncate">{card.value}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{rangeLabel}</p>
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

          {/* Revenue trend */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-5 bg-green-500 rounded-full" />
                  <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">Revenue — {rangeLabel}</h3>
                </div>
                {filteredSales.length > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                    ₵{stats.totalRevenue >= 1000 ? `${(stats.totalRevenue/1000).toFixed(1)}K` : Math.round(stats.totalRevenue).toLocaleString()} total
                  </span>
                )}
              </div>
              <div className="p-4 sm:p-5">
                {loading ? (
                  <Skeleton className="h-[220px] sm:h-[260px]" />
                ) : filteredSales.length === 0 ? (
                  <EmptyChart icon={BarChart3} label={`No sales ${rangeLabel.toLowerCase()}`} height="h-[220px] sm:h-[260px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={salesChartData} barCategoryGap="30%">
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor"
                        className="text-gray-100 dark:text-gray-800" strokeOpacity={1} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }}
                        className="text-gray-400" axisLine={false} tickLine={false}
                        interval={timeRange === 'month' ? 4 : 0} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }}
                        className="text-gray-400" axisLine={false} tickLine={false} width={52}
                        tickFormatter={(v) => v >= 1000 ? `₵${(v/1000).toFixed(0)}K` : `₵${v}`} />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(34,197,94,0.06)', radius: 8 }} />
                      <Bar dataKey="revenue" fill="url(#revenueGrad)" radius={[6, 6, 2, 2]} maxBarSize={48} />
                    </BarChart>
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
                          <p className="text-xs font-black text-gray-900 dark:text-white">
                            ₵{p.revenue >= 1000 ? `${(p.revenue/1000).toFixed(1)}K` : p.revenue.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-gray-400">{p.quantity} units</p>
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

                  {/* Total stock value — uses smart box+piece calculation */}
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
                        ₵{products.reduce((s, p) => s + ((p as any).pieceCost ?? p.costPrice ?? 0) * p.quantity, 0).toLocaleString()}
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