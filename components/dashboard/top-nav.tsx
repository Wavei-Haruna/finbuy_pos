'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import {
  LogOut, User, Menu, Bell, ChevronDown, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

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
    if (pathname.includes('/alerts'))     return { title: 'Stock Alerts', sub: 'Low stock notifications' };
    if (pathname.includes('/reports'))    return { title: 'Reports',      sub: 'Analytics & insights'    };
    if (pathname.includes('/businesses')) return { title: 'Businesses',   sub: 'Manage your branches'    };
    if (pathname.includes('/users'))      return { title: 'Users',        sub: 'Team management'         };
    if (pathname.includes('/settings'))   return { title: 'Settings',     sub: 'System preferences'      };
    return { title: 'Dashboard', sub: activeBusiness ? `Viewing ${activeBusiness.name}` : 'Overview' };
  };

  const { title, sub } = getPageInfo();

  return (
    <header className="h-14 sm:h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">

      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page title */}
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-tight truncate">{title}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block truncate">{sub}</p>
        </div>
      </div>

      {/* Right: business pill + notifications + user menu */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

        {/* Active business pill — hidden on very small screens */}
        {activeBusiness && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/8 border border-green-500/15">
            <Building2 className="w-3 h-3 text-green-500" />
            <span className="text-xs font-bold text-green-600 dark:text-green-400 max-w-[120px] truncate">
              {activeBusiness.name}
            </span>
          </div>
        )}

        {/* Notification bell */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Bell className="w-4 h-4" />
          {/* Unread dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-gray-950" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-gray-900 font-black text-xs flex-shrink-0 shadow-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:block max-w-[100px] truncate">
              {user?.name}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 hidden sm:block transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden z-50"
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-gray-900 font-black text-sm flex-shrink-0">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400 capitalize">{user?.role || 'admin'}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-1">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                    <User className="w-4 h-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">Signed in as</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200 capitalize">{user?.role || 'admin'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
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