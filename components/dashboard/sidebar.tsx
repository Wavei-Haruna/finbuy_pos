'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import {
  LayoutDashboard, Package, ShoppingCart, AlertCircle,
  BarChart3, Users, Settings, LogOut, Building2, X, ChevronDown, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const navigationItems = [
  { label: 'Dashboard',    href: '/dashboard',            icon: LayoutDashboard, roles: ['admin', 'sales', 'manager'] },
  { label: 'Products',     href: '/dashboard/products',   icon: Package,         roles: ['admin', 'sales', 'manager'] },
  { label: 'Record Sale',  href: '/dashboard/sales',      icon: ShoppingCart,    roles: ['admin', 'sales'] },
  { label: 'Stock Alerts', href: '/dashboard/alerts',     icon: AlertCircle,     roles: ['admin', 'manager'] },
  { label: 'Reports',      href: '/dashboard/reports',    icon: BarChart3,       roles: ['admin', 'manager'] },
  { label: 'Businesses',   href: '/dashboard/businesses', icon: Building2,       roles: ['admin'] },
  { label: 'Settings',     href: '/dashboard/settings',   icon: Settings,        roles: ['admin'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function SidebarInner({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { businesses, activeBusiness, setActiveBusiness } = useBusiness();
  const [bizDropOpen, setBizDropOpen] = useState(false);

  const visibleItems = navigationItems.filter((item) =>
    item.roles.includes(user?.role || '')
  );

  return (
    <aside className="w-64 h-full bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800/50 flex flex-col relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent pointer-events-none" />

      {/* ── LOGO ── */}
      <div className="p-5 border-b border-gray-800/50 relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20 flex-shrink-0">
            <span className="text-gray-900 font-black text-lg">A</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight">Admin</h1>
            <p className="text-[10px] text-gray-400 tracking-[0.15em] font-semibold uppercase">Dashboard</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── BUSINESS SWITCHER ── */}
      {businesses.length > 0 && (
        <div className="px-3 pt-4 relative z-10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] px-1 mb-1.5">Active Branch</p>
          <button
            onClick={() => setBizDropOpen(!bizDropOpen)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-green-500/40 transition-all duration-200 group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm">
              {activeBusiness?.name.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {activeBusiness?.name ?? 'Select business'}
              </p>
              <p className="text-[10px] font-mono text-gray-400">{activeBusiness?.businessId ?? '—'}</p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${bizDropOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {bizDropOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                transition={{ duration: 0.15 }}
                className="mt-1 rounded-xl border border-gray-700/50 bg-gray-900 overflow-hidden shadow-xl z-20 origin-top"
              >
                <div className="p-1 max-h-44 overflow-y-auto">
                  {businesses.map((biz) => {
                    const isActive = activeBusiness?.id === biz.id;
                    return (
                      <button
                        key={biz.id}
                        onClick={() => { setActiveBusiness(biz); setBizDropOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                          isActive
                            ? 'bg-green-500/15 text-green-400'
                            : 'hover:bg-gray-800 text-gray-300'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                          isActive ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {biz.name.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold truncate flex-1">{biz.name}</span>
                        {isActive && <Check className="w-3 h-3 text-green-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-gray-800 p-1">
                  <Link
                    href="/dashboard/businesses"
                    onClick={() => { setBizDropOpen(false); onClose(); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-green-400 hover:bg-green-500/10 transition-colors w-full"
                  >
                    <Building2 className="w-3 h-3" />
                    Add New Business
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── NAV LABEL ── */}
      <div className="px-4 pt-5 pb-2 relative z-10">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">Menu</p>
      </div>

      {/* ── NAV ITEMS ── */}
      <motion.nav
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
        className="flex-1 overflow-y-auto px-3 space-y-0.5 relative z-10 pb-2"
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          const isBiz = item.href === '/dashboard/businesses';

          return (
            <motion.div
              key={item.href}
              variants={{
                hidden: { x: -14, opacity: 0 },
                visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
              }}
            >
              <Link
                href={item.href}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden',
                  isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                {/* Active bg */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                {/* Left accent bar */}
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-r-full" />
                )}
                {/* Hover bg */}
                <div className="absolute inset-0 bg-gray-800/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                {/* Icon */}
                <div className="relative z-10 flex-shrink-0">
                  <Icon className={cn(
                    'w-[18px] h-[18px] transition-all duration-200',
                    isActive
                      ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                      : isBiz
                        ? 'text-green-400 group-hover:text-green-300'
                        : 'text-gray-400 group-hover:text-gray-300'
                  )} />
                </div>

                {/* Label */}
                <span className={cn(
                  'relative z-10 text-sm font-medium flex-1 transition-all duration-200',
                  isActive ? 'font-semibold' : 'group-hover:translate-x-0.5'
                )}>
                  {item.label}
                </span>

                {/* Green dot for Businesses when not active */}
                {isBiz && !isActive && (
                  <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                )}
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* ── USER + LOGOUT ── */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="p-3 border-t border-gray-800/50 relative z-10 space-y-2"
      >
        <div className="px-3 py-2.5 bg-gray-800/40 rounded-xl border border-gray-700/40 hover:border-yellow-500/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-gray-900 font-black text-sm shadow-lg shadow-yellow-500/20 flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate leading-tight">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-400 capitalize flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {user?.role || 'staff'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </motion.div>
    </aside>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden lg:flex w-64 flex-shrink-0 h-screen sticky top-0">
        <SidebarInner onClose={() => {}} />
      </div>

      {/* Mobile: slide-in drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 z-50 flex"
            >
              <SidebarInner onClose={onClose} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}