'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Product } from '@/lib/types';
import { useBusiness } from '@/lib/business-context';
import {
  AlertTriangle, CheckCircle, PackageX, Package,
  ShieldAlert, Zap, RefreshCw, ExternalLink,
  ChevronRight, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertStatus = 'out' | 'critical' | 'warning';

interface AlertProduct extends Product {
  status: AlertStatus;
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl ${className}`} />
);

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  out: {
    label:       'Out of Stock',
    badge:       'bg-red-500/10 border-red-500/20 text-red-500',
    bar:         'bg-red-500',
    border:      'border-l-red-500',
    icon:        PackageX,
    iconColor:   'text-red-500',
    dot:         'bg-red-500',
    urgency:     'Immediate restock required',
  },
  critical: {
    label:       'Critical',
    badge:       'bg-orange-500/10 border-orange-500/20 text-orange-500',
    bar:         'bg-orange-500',
    border:      'border-l-orange-500',
    icon:        ShieldAlert,
    iconColor:   'text-orange-500',
    dot:         'bg-orange-500',
    urgency:     'Restock soon to avoid stock-out',
  },
  warning: {
    label:       'Low Stock',
    badge:       'bg-amber-400/10 border-amber-400/20 text-amber-500',
    bar:         'bg-amber-400',
    border:      'border-l-amber-400',
    icon:        AlertTriangle,
    iconColor:   'text-amber-500',
    dot:         'bg-amber-400',
    urgency:     'Running low — monitor closely',
  },
} as const;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { activeBusiness } = useBusiness();
  const router = useRouter();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeFilter, setFilter]     = useState<AlertStatus | 'all'>('all');

  const fetchData = async (isRefresh = false) => {
    if (!activeBusiness) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))
      );
      setProducts(snap.docs.map((d) => ({
        id: d.id, ...d.data(),
        dateAdded:   d.data().dateAdded?.toDate()   || new Date(),
        lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
      })) as Product[]);
    } catch (e) {
      console.error(e);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeBusiness]);

  // ── Derive alert items (original logic preserved) ────────────────────
  const alertItems: AlertProduct[] = useMemo(() => {
    return products
      .filter((p) => {
        const threshold = p.lowStockAlert ?? 5;
        return p.quantity <= threshold; // at or below their set threshold
      })
      .map((p) => {
        const threshold = p.lowStockAlert ?? 5;
        return {
          ...p,
          status:
            p.quantity === 0                      ? 'out'
            : p.quantity <= Math.ceil(threshold * 0.4) ? 'critical'  // ≤ 40% of threshold
            : 'warning',
        };
      })
      .sort((a, b) => {
        const order = { out: 0, critical: 1, warning: 2 };
        return order[a.status] - order[b.status] || a.quantity - b.quantity;
      });
  }, [products]);

  const outCount      = alertItems.filter((i) => i.status === 'out').length;
  const criticalCount = alertItems.filter((i) => i.status === 'critical').length;
  const warningCount  = alertItems.filter((i) => i.status === 'warning').length;

  const visibleItems = activeFilter === 'all'
    ? alertItems
    : alertItems.filter((i) => i.status === activeFilter);

  const allClear = alertItems.length === 0;

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-red-500 via-orange-400 to-transparent" />

      <div className="px-4 sm:px-6 py-5 max-w-[1200px] mx-auto space-y-5 pb-10">

        {/* ── HEADER ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-500 uppercase tracking-[0.15em] mb-1">
              Inventory · <span className="text-gray-400 font-normal">{activeBusiness?.name ?? '—'}</span>
            </p>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              Stock Alerts<span className="text-gray-300 dark:text-gray-600">.</span>
            </h1>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
        </motion.div>

        {/* ── SUMMARY PILLS ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'all',      label: 'Total Alerts',  count: alertItems.length,   bg: 'bg-gray-100 dark:bg-gray-800',               text: 'text-gray-700 dark:text-gray-300',  border: 'border-gray-200 dark:border-gray-700' },
                { key: 'out',      label: 'Out of Stock',  count: outCount,             bg: 'bg-red-500/8',     text: 'text-red-500',       border: 'border-red-500/20' },
                { key: 'critical', label: 'Critical',      count: criticalCount,        bg: 'bg-orange-500/8',  text: 'text-orange-500',    border: 'border-orange-500/20' },
                { key: 'warning',  label: 'Low Stock',     count: warningCount,         bg: 'bg-amber-400/8',   text: 'text-amber-500',     border: 'border-amber-400/20' },
              ].map((s) => (
                <button key={s.key} onClick={() => setFilter(s.key as AlertStatus | 'all')}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${s.bg} ${s.border} ${
                    activeFilter === s.key ? 'ring-2 ring-offset-1 ring-offset-gray-50 dark:ring-offset-[#0a0a0a] ring-gray-400 dark:ring-gray-600' : 'hover:opacity-80'
                  }`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                  <p className={`text-2xl font-black ${s.text}`}>{s.count}</p>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── ALL CLEAR STATE ── */}
        <AnimatePresence>
          {!loading && allClear && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl border border-green-500/20 bg-green-500/5 p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">All Stock Levels Healthy</h3>
              <p className="text-sm text-gray-400">Every product is above its minimum stock threshold.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ALERT CARDS ── */}
        {!loading && !allClear && (
          <div className="space-y-3">
            {/* Filter label */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                {activeFilter === 'all' ? `All alerts` : STATUS_CONFIG[activeFilter].label}
                {' '}· {visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''}
              </p>
            </div>

            <AnimatePresence mode="popLayout">
              {visibleItems.map((item, i) => {
                const cfg = STATUS_CONFIG[item.status];
                const StatusIcon = cfg.icon;
                const stockPct = item.lowStockAlert
                  ? Math.min(100, (item.quantity / (item.lowStockAlert * 2)) * 100)
                  : 0;

                return (
                  <motion.div key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
                    className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-l-4 ${cfg.border} shadow-sm overflow-hidden`}>

                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-4">

                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.badge} border`}>
                          <StatusIcon className={`w-4 h-4 ${cfg.iconColor}`} />
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0 space-y-3">

                          {/* Top row */}
                          <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">
                                  {item.name}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${cfg.badge} flex-shrink-0`}>
                                  {cfg.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                                {item.brand && <span className="font-medium">{item.brand}</span>}
                                <span className="flex items-center gap-1 font-mono">
                                  <Hash className="w-2.5 h-2.5" />{item.sku}
                                </span>
                                <span>{CATEGORY_LABELS[item.category] || item.category}</span>
                              </div>
                            </div>
                          </div>

                          {/* Stock meter */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 font-medium">Stock level</span>
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-base ${cfg.iconColor}`}>
                                  {item.quantity}
                                </span>
                                <span className="text-gray-400">/ {item.lowStockAlert ?? 5} min</span>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${cfg.bar}`}
                                initial={{ width: 0 }}
                                animate={{ width: item.quantity === 0 ? '100%' : `${Math.max(4, stockPct)}%` }}
                                transition={{ delay: i * 0.04 + 0.1, duration: 0.5, ease: 'easeOut' }}
                                style={{ opacity: item.quantity === 0 ? 0.4 : 1 }}
                              />
                            </div>
                            <p className={`text-[10px] font-bold ${cfg.iconColor}`}>{cfg.urgency}</p>
                          </div>

                          {/* Stat chips */}
                          <div className="flex flex-wrap gap-2">
                            <StatChip label="Price / Piece" value={`₵${(item.piecePrice ?? item.sellingPrice)?.toLocaleString() ?? '—'}`} />
                            {(item as any).boxEnabled && (item as any).boxPrice && (
                              <StatChip label={`Price / Box (${(item as any).boxQty}pcs)`} value={`₵${(item as any).boxPrice.toLocaleString()}`} />
                            )}
                            <StatChip label="Cost"    value={`₵${(item.pieceCost ?? item.costPrice)?.toLocaleString() ?? '—'}`} />
                            {item.quantity > 0 && (item.pieceCost ?? item.costPrice) > 0 && (
                              <StatChip label="Stock Value"
                                value={`₵${(item.quantity * (item.pieceCost ?? item.costPrice ?? 0)).toLocaleString()}`} />
                            )}
                            <StatChip label="Alert Threshold" value={`${item.lowStockAlert ?? 5} units`} />
                          </div>
                        </div>

                        {/* Restock button */}
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => router.push(`/dashboard/products/${item.id}/edit`)}
                          className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black hover:opacity-80 transition-opacity flex-shrink-0 self-start">
                          <Zap className="w-3 h-3" />
                          Restock
                        </motion.button>
                      </div>

                      {/* Mobile restock button */}
                      <div className="mt-3 sm:hidden">
                        <button
                          onClick={() => router.push(`/dashboard/products/${item.id}/edit`)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black">
                          <Zap className="w-3.5 h-3.5" />
                          Restock — Update Stock Level
                          <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                        </button>
                      </div>
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
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className={`h-[160px] sm:h-[140px]`} />
            ))}
          </div>
        )}

        {/* ── EMPTY FILTER STATE ── */}
        {!loading && !allClear && visibleItems.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 flex flex-col items-center text-center">
            <Package className="w-9 h-9 text-gray-200 dark:text-gray-700 mb-2" />
            <p className="text-sm font-bold text-gray-400">
              No {activeFilter === 'all' ? '' : STATUS_CONFIG[activeFilter].label.toLowerCase()} alerts
            </p>
          </motion.div>
        )}

        {/* ── QUICK LINK TO PRODUCTS ── */}
        {!loading && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            onClick={() => router.push('/dashboard/products')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group shadow-sm">
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">View All Products</p>
              <p className="text-xs text-gray-400 mt-0.5">Manage stock, edit prices, update inventory</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors flex-shrink-0" />
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ─── Stat chip helper ─────────────────────────────────────────────────────────
function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 leading-none mb-0.5">{label}</p>
      <p className="text-xs font-black text-gray-900 dark:text-white leading-none">{value}</p>
    </div>
  );
}