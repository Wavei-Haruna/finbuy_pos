'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { Building2, X, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const navigationItems = [
  { label: 'Dashboard',    href: '/dashboard',            roles: ['admin', 'sales', 'manager'] },
  { label: 'Products',     href: '/dashboard/products',   roles: ['admin', 'sales', 'manager'] },
  { label: 'Record Sale',  href: '/dashboard/sales',      roles: ['admin', 'sales'] },
  { label: 'Services',     href: '/dashboard/services',   roles: ['admin', 'sales'] },
  { label: 'Expenses',     href: '/dashboard/expenses',   roles: ['admin', 'manager'] },
  { label: 'Damages',      href: '/dashboard/damages',    roles: ['admin', 'manager'] },
  { label: 'Stock Alerts', href: '/dashboard/alerts',     roles: ['admin', 'manager'] },
  { label: 'Reports',      href: '/dashboard/reports',    roles: ['admin', 'manager'] },
  { label: 'Businesses',   href: '/dashboard/businesses', roles: ['admin'] },
  { label: 'Settings',     href: '/dashboard/settings',   roles: ['admin'] },
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
    <aside className="flex h-full w-[232px] flex-col border-r border-white/5 bg-[hsl(var(--brand-deep))] text-white">
      {/* ── LOGO ── */}
      <div className="flex items-center justify-between px-5 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-white p-1">
            <Image
              src="/logo.png"
              alt="Kashora"
              width={28}
              height={28}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <span className="font-heading text-[22px] font-semibold leading-none tracking-tight text-white">
            Kashora
          </span>
        </div>
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
            className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-colors hover:border-[hsl(var(--brand-lime)/0.4)]"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-lime))] text-xs font-black text-[hsl(var(--brand-deep))]">
              {activeBusiness?.name.charAt(0) ?? '?'}
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
                className="mt-1 origin-top overflow-hidden rounded-xl border border-white/10 bg-[hsl(var(--card))] shadow-xl"
              >
                <div className="max-h-44 overflow-y-auto p-1">
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
                          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <span className="flex-1 truncate text-[13px] font-semibold">
                          {biz.name}
                        </span>
                        {isActive && (
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--brand-lime))]" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/10 p-1">
                  <Link
                    href="/dashboard/businesses"
                    onClick={() => {
                      setBizDropOpen(false);
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold text-[hsl(var(--brand-lime))] transition-colors hover:bg-white/5"
                  >
                    <Building2 className="h-3 w-3" />
                    Add New Business
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'relative flex items-center rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-200',
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
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── USER + LOGOUT ── */}
      <div className="space-y-3 p-3 pb-4">
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
          className="w-full rounded-xl border border-[hsl(var(--brand-lime)/0.6)] py-2.5 text-sm font-bold text-[hsl(var(--brand-lime))] transition-colors hover:bg-[hsl(var(--brand-lime)/0.1)]"
        >
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