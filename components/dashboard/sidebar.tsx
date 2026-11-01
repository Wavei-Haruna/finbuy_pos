'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import {
  X,
  ChevronDown,
  Check,
  Plus,
  LogOut,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wrench,
  Wallet,
  PackageX,
  BellRing,
  BarChart3,
  Store,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const navigationItems: {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}[] = [
  { label: 'Dashboard',    href: '/dashboard',            icon: LayoutDashboard, roles: ['admin', 'sales', 'manager'] },
  { label: 'Products',     href: '/dashboard/products',   icon: Package,         roles: ['admin', 'sales', 'manager'] },
  { label: 'Record Sale',  href: '/dashboard/sales',      icon: ShoppingCart,    roles: ['admin', 'sales'] },
  { label: 'Services',     href: '/dashboard/services',   icon: Wrench,          roles: ['admin', 'sales'] },
  { label: 'Expenses',     href: '/dashboard/expenses',   icon: Wallet,          roles: ['admin', 'manager'] },
  { label: 'Damages',      href: '/dashboard/damages',    icon: PackageX,        roles: ['admin', 'manager'] },
  { label: 'Stock Alerts', href: '/dashboard/alerts',     icon: BellRing,        roles: ['admin', 'manager'] },
  { label: 'Reports',      href: '/dashboard/reports',    icon: BarChart3,       roles: ['admin', 'manager'] },
  { label: 'Businesses',   href: '/dashboard/businesses', icon: Store,           roles: ['admin'] },
  { label: 'Settings',     href: '/dashboard/settings',   icon: Settings,        roles: ['admin'] },
];

// Slim dark scrollbar so the nav does not show a bright white track
const slimScroll =
  '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] ' +
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-white/30';

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
    <aside className="flex h-full w-[232px] flex-col border-r border-white/5 bg-[hsl(var(--brand-deep))] text-white">
      {/* ── LOGO ── */}
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        {/* White plate so the dark green wordmark stays readable */}
        <Link
          href="/dashboard"
          aria-label="Kashora dashboard"
          className="flex h-11 items-center rounded-xl bg-white px-3"
        >
          <Image
            src="/logo.png"
            alt="Kashora"
            width={120}
            height={36}
            className="h-7 w-auto object-contain"
            priority
          />
        </Link>
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── BRANCH SWITCHER ── */}
      {businesses.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setBizDropOpen(!bizDropOpen)}
            aria-expanded={bizDropOpen}
            className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-colors hover:border-[hsl(var(--brand-lime)/0.4)]"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-lime))] text-xs font-black text-[hsl(var(--brand-deep))]">
              {activeBusiness?.name.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13px] font-bold leading-tight text-white">
                {activeBusiness?.name ?? 'Select business'}
              </p>
              <p className="font-mono text-[10px] text-white/50">
                {activeBusiness?.businessId ?? '—'}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 flex-shrink-0 text-white/50 transition-transform duration-200',
                bizDropOpen && 'rotate-180'
              )}
            />
          </button>

          <AnimatePresence>
            {bizDropOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                transition={{ duration: 0.15 }}
                className="mt-1.5 origin-top overflow-hidden rounded-xl border border-white/15 bg-[hsl(var(--brand-deep))] shadow-xl shadow-black/30"
              >
                {/* Dark panel with a light tint, so white text always has contrast */}
                <div className="bg-white/[0.06]">
                  <div className={cn('max-h-44 space-y-0.5 overflow-y-auto p-1.5', slimScroll)}>
                    {businesses.map((biz) => {
                      const isActive = activeBusiness?.id === biz.id;
                      return (
                        <button
                          key={biz.id}
                          onClick={() => {
                            setActiveBusiness(biz);
                            setBizDropOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                            isActive
                              ? 'bg-white/10 text-white'
                              : 'text-white/75 hover:bg-white/[0.07] hover:text-white'
                          )}
                        >
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-black text-white">
                            {biz.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold leading-tight">
                              {biz.name}
                            </span>
                            <span className="block font-mono text-[10px] text-white/45">
                              {biz.businessId}
                            </span>
                          </span>
                          {isActive && (
                            <Check className="h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--brand-lime))]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-white/10 p-1.5">
                    <Link
                      href="/dashboard/businesses"
                      onClick={() => {
                        setBizDropOpen(false);
                        onClose();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-bold text-[hsl(var(--brand-lime))] transition-colors hover:bg-white/[0.07]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add new business
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className={cn('min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2', slimScroll)}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] transition-colors duration-200',
                isActive
                  ? 'font-bold text-white'
                  : 'font-medium text-white/60 hover:bg-white/[0.05] hover:text-white'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl bg-white/[0.09]"
                  transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  'relative z-10 h-[18px] w-[18px] flex-shrink-0 transition-colors',
                  isActive ? 'text-[hsl(var(--brand-lime))]' : 'text-white/50'
                )}
              />
              <span className="relative z-10 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── USER + LOGOUT ── */}
      <div className="space-y-3 border-t border-white/5 p-3 pb-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-lime))] text-sm font-black text-[hsl(var(--brand-deep))]">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight text-white">
              {user?.name || 'User'}
            </p>
            <p className="text-xs capitalize text-white/50">{user?.role || 'staff'}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[hsl(var(--brand-lime)/0.6)] py-2.5 text-sm font-bold text-[hsl(var(--brand-lime))] transition-colors hover:bg-[hsl(var(--brand-lime)/0.1)]"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: always visible */}
      <div className="sticky top-0 hidden h-screen w-[232px] flex-shrink-0 lg:flex">
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
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 top-0 z-50 flex lg:hidden"
            >
              <SidebarInner onClose={onClose} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}