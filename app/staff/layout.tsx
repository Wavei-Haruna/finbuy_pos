'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStaffSession, clearStaffSession, StaffSession } from '@/lib/staff-auth';
import { ShoppingCart, Wrench, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/staff/sales',    label: 'Sales',    icon: ShoppingCart },
  { href: '/staff/services', label: 'Services', icon: Wrench },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<StaffSession | null>(null);

  useEffect(() => {
    setSession(getStaffSession());
  }, [pathname]);

  // No session (yet, or logged out) — let the page's own guard/redirect handle it,
  // don't render chrome for a session that isn't there.
  if (!session) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-transparent" />

      {/* Top bar — shared across all staff pages */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-black text-sm">
            {session.businessName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">{session.businessName}</p>
            <p className="text-[10px] font-mono text-gray-400">{session.businessCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
            </span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Staff Mode</span>
          </div>
          <button onClick={() => { clearStaffSession(); router.replace('/login'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </div>

      {/* Tab nav — switch between recording products (Sales) and services */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6">
        <div className="max-w-[1400px] mx-auto flex gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  active
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}