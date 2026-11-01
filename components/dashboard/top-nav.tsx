'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { LogOut, User, Menu, Bell, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TopNavProps {
  onMenuClick: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { user, logout } = useAuth();
  const { activeBusiness } = useBusiness();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Dynamic page title from pathname (SSR-safe via usePathname)
  const pathname = usePathname();
  const getPageInfo = () => {
    if (pathname.includes('/products'))   return { title: 'Products',     sub: 'Manage your inventory'   };
    if (pathname.includes('/sales'))      return { title: 'Record Sale',  sub: 'Log a new transaction'   };
    if (pathname.includes('/services'))   return { title: 'Services',     sub: 'Repairs and jobs'        };
    if (pathname.includes('/expenses'))   return { title: 'Expenses',     sub: 'Salaries and costs'      };
    if (pathname.includes('/damages'))    return { title: 'Damages',      sub: 'Damaged and lost stock'  };
    if (pathname.includes('/alerts'))     return { title: 'Stock Alerts', sub: 'Low stock notifications' };
    if (pathname.includes('/reports'))    return { title: 'Reports',      sub: 'Analytics & insights'    };
    if (pathname.includes('/businesses')) return { title: 'Businesses',   sub: 'Manage your branches'    };
    if (pathname.includes('/users'))      return { title: 'Users',        sub: 'Team management'         };
    if (pathname.includes('/settings'))   return { title: 'Settings',     sub: 'System preferences'      };
    return { title: 'Overview', sub: 'Your business at a glance' };
  };

  const { title, sub } = getPageInfo();
  const initial = user?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-muted/80 px-4 backdrop-blur-md sm:h-16 sm:px-6">

      {/* Left: hamburger (mobile) + page title */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h2 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground sm:text-base">
            {title}
          </h2>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{sub}</p>
        </div>
      </div>

      {/* Right: branch pill + notifications + user menu */}
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">

        {/* Active branch pill */}
        {activeBusiness && (
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--brand-emerald))]" />
            <span className="max-w-[140px] truncate text-xs font-bold text-foreground">
              {activeBusiness.name}
            </span>
          </div>
        )}

        {/* Notification bell */}
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-muted bg-destructive" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition-colors hover:bg-card sm:pr-3"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
              {initial}
            </div>
            <span className="hidden max-w-[110px] truncate text-sm font-semibold text-foreground sm:block">
              {user?.name}
            </span>
            <ChevronDown
              className={cn(
                'hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 sm:block',
                userMenuOpen && 'rotate-180'
              )}
            />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/10"
              >
                {/* User info */}
                <div className="border-b border-border px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{user?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-1.5">
                  <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Signed in as</p>
                      <p className="flex items-center gap-1.5 text-xs font-bold capitalize text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--brand-emerald))]" />
                        {user?.role || 'admin'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click outside to close */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}
    </header>
  );
}