'use client';

// components/home/home-nav.tsx
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  LOGO_SRC,
  LOGIN_HREF,
  SIGNUP_HREF,
  DASHBOARD_HREF,
  NAV_ITEMS,
  button,
} from './site-config';

export function HomeNav() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  // Logged-in owners get a shortcut to the dashboard instead of being redirected away
  const renderActions = (size: 'sm' | 'md') => {
    if (loading) return <div className="h-10 w-44" aria-hidden />;

    if (user) {
      return (
        <Link href={DASHBOARD_HREF} className={button('primary', size)}>
          Open dashboard
        </Link>
      );
    }

    return (
      <>
        <Link href={LOGIN_HREF} className={button('secondary', size)}>
          Sign in
        </Link>
        <Link href={SIGNUP_HREF} className={button('primary', size)}>
          Start free
        </Link>
      </>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-muted/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Kashora home" className="shrink-0">
          <Image
            src={LOGO_SRC}
            alt="Kashora"
            width={140}
            height={48}
            priority
            className="h-11 w-auto mix-blend-multiply"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">{renderActions('sm')}</div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-muted md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3 sm:px-8" aria-label="Mobile">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-3 text-sm font-semibold text-foreground last:border-b-0"
              >
                {item.label}
              </a>
            ))}
            <div className="flex gap-2 py-4">{renderActions('md')}</div>
          </nav>
        </div>
      )}
    </header>
  );
}