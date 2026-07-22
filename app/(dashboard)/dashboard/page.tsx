'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Package, AlertCircle, TrendingUp, ShoppingCart,
  Plus, BarChart3, Building2,
  ArrowUpRight, Zap, ChevronDown, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const { businesses, activeBusiness, setActiveBusiness } = useBusiness();
  const [stats, setStats] = useState({ totalProducts: 0, lowStockItems: 0, totalValue: 0, salesCount: 0 });
  const [loading, setLoading] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    if (activeBusiness) fetchStats();
    else setLoading(false);
  }, [activeBusiness]);

  const fetchStats = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const productsSnap = await getDocs(query(collection(db, 'products'), where('businessId', '==', activeBusiness.id)));
      const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      let lowStock = 0, totalValue = 0;
      products.forEach((p: any) => {
        if (p.quantity < 10) lowStock++;
        totalValue += p.quantity * p.sellingPrice;
      });
      const salesSnap = await getDocs(query(collection(db, 'sales'), where('businessId', '==', activeBusiness.id)));
      setStats({ totalProducts: products.length, lowStockItems: lowStock, totalValue, salesCount: salesSnap.size });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const statCards = [
    { title: 'Total Products',  display: stats.totalProducts.toString(),                   icon: Package,     color: '#3b82f6', bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.18)'  },
    { title: 'Low Stock',        display: stats.lowStockItems.toString(),                   icon: AlertCircle, color: stats.lowStockItems > 0 ? '#ef4444' : '#22c55e', bg: stats.lowStockItems > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.07)', border: stats.lowStockItems > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)' },
    { title: 'Inventory Value',  display: `₵${(stats.totalValue / 1000).toFixed(1)}K`,    icon: TrendingUp,  color: '#22c55e', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.18)'   },
    { title: 'Total Sales',      display: stats.salesCount.toString(),                      icon: ShoppingCart,color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.18)'  },
  ];

  // ─── 4 QUICK ACTIONS ───────────────────────────────────────────────
  const quickActions = [
    { title: 'Add Product',   description: 'New inventory item',   icon: Plus,       href: '/dashboard/products',   color: '#3b82f6', gradient: 'from-blue-500 to-blue-600',   bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)'  },
    { title: 'Record Sale',   description: 'Log a transaction',    icon: ShoppingCart, href: '/dashboard/sales',    color: '#22c55e', gradient: 'from-green-500 to-green-600', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)'   },
    { title: 'View Reports',  description: 'Analytics & insights', icon: BarChart3,  href: '/dashboard/reports',    color: '#a855f7', gradient: 'from-purple-500 to-purple-600',bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)'  },
    { title: 'Add Business',  description: 'Register new branch',  icon: Building2,  href: '/dashboard/businesses', color: '#f59e0b', gradient: 'from-amber-500 to-amber-600',  bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
  ];
  // ───────────────────────────────────────────────────────────────────

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-green-500">{greeting}</span>
              <span className="w-1 h-1 rounded-full bg-green-500/40" />
              <span className="text-xs text-gray-400 font-medium">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              {firstName}<span className="text-gray-400 dark:text-gray-600">.</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
              {activeBusiness ? <>Viewing <span className="text-gray-700 dark:text-gray-300 font-semibold">{activeBusiness.name}</span></> : 'Set up a business to get started'}
            </p>
          </div>

          {/* Live badge + business switcher */}
          <div className="flex items-center gap-3">
            {activeBusiness && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">Live</span>
              </div>
            )}

            {businesses.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setSwitcherOpen(!switcherOpen)}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-black">
                    {activeBusiness?.name.charAt(0) ?? '+'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{activeBusiness?.name ?? 'Select business'}</p>
                    <p className="text-[10px] font-mono text-gray-400">{activeBusiness?.businessId ?? '—'}</p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${switcherOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {switcherOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Switch Business</p>
                      </div>
                      <div className="p-1.5 space-y-0.5 max-h-52 overflow-y-auto">
                        {businesses.map((biz) => {
                          const isActive = activeBusiness?.id === biz.id;
                          return (
                            <button
                              key={biz.id}
                              onClick={() => { setActiveBusiness(biz); setSwitcherOpen(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isActive ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${isActive ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                {biz.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold leading-tight truncate">{biz.name}</p>
                                <p className="text-[10px] font-mono text-gray-400">{biz.businessId}</p>
                              </div>
                              {isActive && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-1.5 border-t border-gray-100 dark:border-gray-800">
                        <Link
                          href="/dashboard/businesses"
                          onClick={() => setSwitcherOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-500/8 transition-colors w-full"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add New Business
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        {switcherOpen && <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />}

        {/* STATS GRID */}
        {(activeBusiness || loading) && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {loading
              ? [...Array(4)].map((_, i) => <div key={i} className="h-[120px] rounded-2xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />)
              : statCards.map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <motion.div
                      key={card.title}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 + i * 0.07 }}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                      className="group relative overflow-hidden rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
                      style={{ borderColor: card.border }}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: `radial-gradient(ellipse at top right, ${card.bg.replace('0.07', '0.14')}, transparent 70%)` }} />
                      <div className="relative flex items-start justify-between mb-3 sm:mb-4">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.bg, border: `1px solid ${card.border}` }}>
                          <Icon className="w-4 h-4" style={{ color: card.color }} />
                        </div>

                      </div>
                      <div className="relative">
                        <p className="text-2xl sm:text-3xl font-black tracking-tight leading-none" style={{ color: card.color }}>{card.display}</p>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">{card.title}</p>

                      </div>
                    </motion.div>
                  );
                })}
          </div>
        )}

        {/* ── QUICK ACTIONS: always 4, always visible ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm"
        >
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quick Actions</h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">4 shortcuts</span>
          </div>

          <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.07 }}
                  whileHover={{ y: -4, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.96 }}
                >
                  <Link href={action.href}>
                    <div
                      className="group relative flex flex-col items-center text-center gap-2.5 p-4 sm:p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 overflow-hidden h-full"
                      style={{ borderColor: action.border, backgroundColor: action.bg }}
                    >
                      {/* Top sweep on hover */}
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                        style={{ backgroundColor: action.color }}
                      />
                      {/* Glow on hover */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ background: `radial-gradient(ellipse at top, ${action.bg.replace('0.08', '0.22')}, transparent 80%)` }}
                      />

                      {/* Icon */}
                      <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      {/* Title — always visible */}
                      <p className="relative font-bold text-gray-900 dark:text-white text-sm leading-tight">{action.title}</p>

                      {/* Description — desktop only */}
                      <p className="relative hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 leading-snug -mt-1">{action.description}</p>

                      {/* Arrow */}
                      <ArrowUpRight
                        className="absolute top-3 right-3 w-3.5 h-3.5 opacity-0 group-hover:opacity-70 transition-opacity duration-200"
                        style={{ color: action.color }}
                      />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </div>
  );
}