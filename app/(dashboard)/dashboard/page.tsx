'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Product, SalesRecord, Expense, ServiceRecord } from '@/lib/types';
import { startOfDay, startOfMonth, addDays, totalExpensesInPeriod } from '@/app/(dashboard)/dashboard/expenses/expense-utils';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Period = 'today' | 'week' | 'month';
type Tone = 'hero' | 'danger' | 'tint' | 'neutral' | 'warn' | 'ok';

interface PeriodStats {
  revenue:  number;
  gross:    number;
  expenses: number;
  count:    number;
}

interface AttentionItem {
  id: string;
  name: string;
  quantity: number;
}

interface RecentItem {
  id: string;
  label: string;
  kind: 'Sale' | 'Service';
  at: Date;
  amount: number;
}

interface DashData {
  today: PeriodStats;
  week:  PeriodStats;
  month: PeriodStats;
  stockValue: number;
  productCount: number;
  lowCount: number;
  outCount: number;
  attention: AttentionItem[];
  recent: RecentItem[];
}

const EMPTY_PERIOD: PeriodStats = { revenue: 0, gross: 0, expenses: 0, count: 0 };
const EMPTY_DATA: DashData = {
  today: EMPTY_PERIOD, week: EMPTY_PERIOD, month: EMPTY_PERIOD,
  stockValue: 0, productCount: 0, lowCount: 0, outCount: 0, attention: [], recent: [],
};

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This week' },
  { key: 'month', label: 'This month' },
];

// Grid spans: hero is double width on desktop, full row on tablet.
const CARD_SPANS = [
  'col-span-2 md:col-span-3 lg:col-span-2',
  '',
  '',
  'col-span-2 md:col-span-1',
];

// Each card has its own weight and meaning. Lime is never a fill — it is
// text and small chips on the dark green, same as the landing hero.
// hero    → deep forest, sales + profit in one panel
// danger  → red tint, money going out / out of stock
// tint    → soft brand green, an asset on the shelf
// warn    → amber, low stock
// ok      → calm card with emerald number, all healthy
// neutral → plain card
const TONES: Record<Tone, { card: string; label: string; value: string; sub: string }> = {
  hero: {
    card:  'border-transparent bg-[hsl(var(--brand-forest))]',
    label: 'text-white/70',
    value: 'text-white',
    sub:   'text-white/60',
  },
  danger: {
    card:  'border-destructive/20 bg-destructive/10',
    label: 'text-destructive/80',
    value: 'text-destructive',
    sub:   'text-destructive/70',
  },
  tint: {
    card:  'border-[hsl(var(--brand-emerald)/0.25)] bg-accent',
    label: 'text-accent-foreground/70',
    value: 'text-accent-foreground',
    sub:   'text-accent-foreground/60',
  },
  warn: {
    card:  'border-amber-300/70 bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/15',
    label: 'text-amber-800/80 dark:text-amber-300/80',
    value: 'text-amber-900 dark:text-amber-200',
    sub:   'text-amber-800/70 dark:text-amber-300/70',
  },
  ok: {
    card:  'border-border bg-card',
    label: 'text-muted-foreground',
    value: 'text-[hsl(var(--brand-emerald))]',
    sub:   'text-muted-foreground',
  },
  neutral: {
    card:  'border-border bg-card',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    sub:   'text-muted-foreground',
  },
};

function getUnitCost(p?: Product): number {
  if (!p) return 0;
  return (p as any).pieceCost ?? p.costPrice ?? 0;
}

function fmt(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return abs >= 10000
    ? `${sign}₵${(abs / 1000).toFixed(1)}K`
    : `${sign}₵${Math.round(abs).toLocaleString()}`;
}

function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const offset = (s.getDay() + 6) % 7; // Monday start
  const r = new Date(s);
  r.setDate(r.getDate() - offset);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();
  const [data, setData] = useState<DashData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('today');

  // Salaries and other expenses are sensitive — only admin/manager see the
  // expense-adjusted (net) numbers. Staff/sales still see gross profit.
  const canSeeExpenses = !!user && (user.role === 'admin' || user.role === 'manager');

  useEffect(() => {
    if (activeBusiness) fetchData();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness]);

  const fetchData = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const [productsSnap, salesSnap, servicesSnap, expensesSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))),
        getDocs(query(collection(db, 'sales'),    where('businessId', '==', activeBusiness.id))),
        getDocs(query(collection(db, 'serviceRecords'), where('businessId', '==', activeBusiness.id))),
        canSeeExpenses
          ? getDocs(query(collection(db, 'expenses'), where('businessId', '==', activeBusiness.id)))
          : Promise.resolve(null),
      ]);

      const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[];
      const sales = salesSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        recordedAt: d.data().recordedAt?.toDate() || new Date(),
      })) as SalesRecord[];
      const serviceRecords = servicesSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        recordedAt: d.data().recordedAt?.toDate() || new Date(),
      })) as ServiceRecord[];
      const expenses = expensesSnap
        ? (expensesSnap.docs.map((d) => ({
            id: d.id, ...d.data(),
            startDate: d.data().startDate?.toDate() || new Date(),
            endDate:   d.data().endDate?.toDate() || null,
            createdAt: d.data().createdAt?.toDate() || new Date(),
          })) as Expense[])
        : [];

      // ── Stock ──
      let lowCount = 0, outCount = 0, stockValue = 0;
      const attention: AttentionItem[] = [];
      products.forEach((p: any) => {
        const threshold = p.lowStockAlert ?? 5;
        if (p.quantity === 0) {
          outCount++;
          attention.push({ id: p.id, name: p.name, quantity: 0 });
        } else if (p.quantity <= threshold) {
          lowCount++;
          attention.push({ id: p.id, name: p.name, quantity: p.quantity });
        }
        stockValue += p.quantity * (p.piecePrice ?? p.sellingPrice ?? 0);
      });
      attention.sort((a, b) => a.quantity - b.quantity);

      // ── Periods ──
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);
      const tomorrowStart = addDays(todayStart, 1);

      const productById = new Map(products.map((p) => [p.id, p]));

      const summarize = (start: Date, end: Date): PeriodStats => {
        let revenue = 0, gross = 0, count = 0;
        sales.forEach((s) => {
          if (s.recordedAt >= start && s.recordedAt < end) {
            const cost = getUnitCost(productById.get(s.productId)) * s.quantity;
            revenue += s.totalAmount;
            gross += s.totalAmount - cost;
            count++;
          }
        });
        // Services have no stock/COGS — their "cost" is whatever parts were
        // logged against the job (0 for pure labor).
        serviceRecords.forEach((r) => {
          if (r.recordedAt >= start && r.recordedAt < end) {
            revenue += r.price;
            gross += r.price - r.cost;
            count++;
          }
        });
        const exp = canSeeExpenses ? totalExpensesInPeriod(expenses, start, end) : 0;
        return { revenue, gross, expenses: exp, count };
      };

      // ── Recent transactions ──
      const recent: RecentItem[] = [
        ...sales.map((s): RecentItem => ({
          id: s.id,
          label: `${productById.get(s.productId)?.name ?? 'Product'} × ${s.quantity}`,
          kind: 'Sale',
          at: s.recordedAt,
          amount: s.totalAmount,
        })),
        ...serviceRecords.map((r): RecentItem => ({
          id: r.id,
          label: 'Service job',
          kind: 'Service',
          at: r.recordedAt,
          amount: r.price,
        })),
      ]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 6);

      setData({
        today: summarize(todayStart, tomorrowStart),
        week:  summarize(weekStart, tomorrowStart),
        month: summarize(monthStart, tomorrowStart),
        stockValue, lowCount, outCount,
        productCount: products.length,
        attention: attention.slice(0, 5),
        recent,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const profitOf = (p: PeriodStats) => (canSeeExpenses ? p.gross - p.expenses : p.gross);

  const current = data[period];
  const periodWord = period === 'today' ? 'Today' : period === 'week' ? 'This week' : 'This month';
  const profit = profitOf(current);
  const margin = current.revenue > 0 ? Math.round((profit / current.revenue) * 100) : null;
  const attentionTotal = data.lowCount + data.outCount;
  const productCount = data.productCount ?? 0;

  const expensePct =
    current.expenses === 0
      ? 'None logged'
      : current.revenue > 0
        ? `${Math.round((current.expenses / current.revenue) * 100)}% of sales`
        : 'No sales to compare';

  const salesLabel = period === 'today' ? 'Sales today' : `Sales ${periodWord.toLowerCase()}`;

  const secondaryCards: { label: string; value: string; sub: string; tone: Tone }[] = [
    canSeeExpenses
      ? { label: 'Expenses', value: fmt(current.expenses), sub: expensePct, tone: 'danger' }
      : { label: 'Transactions', value: current.count.toLocaleString(), sub: periodWord, tone: 'neutral' },
    {
      label: 'Stock value',
      value: fmt(data.stockValue),
      sub: `${productCount} product${productCount === 1 ? '' : 's'}`,
      tone: 'tint',
    },
    {
      label: 'Needs attention',
      value: attentionTotal.toString(),
      sub: attentionTotal === 0 ? 'All stock healthy' : `${data.lowCount} low · ${data.outCount} out`,
      tone: data.outCount > 0 ? 'danger' : data.lowCount > 0 ? 'warn' : 'ok',
    },
  ];

  const actions = [
    { label: 'Record sale', href: '/dashboard/sales',    roles: ['admin', 'sales'] },
    { label: 'Add product', href: '/dashboard/products', roles: ['admin', 'sales', 'manager'] },
    { label: 'Add expense', href: '/dashboard/expenses', roles: ['admin', 'manager'] },
    { label: 'View reports', href: '/dashboard/reports', roles: ['admin', 'manager'] },
  ]
    .filter((a) => a.roles.includes(user?.role || ''))
    .slice(0, 3);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const formatWhen = (d: Date) =>
    isSameDay(d, new Date())
      ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const heroTone = TONES.hero;

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-[1200px] space-y-4 p-4 sm:p-5 lg:p-6">

        {/* ── HEADER: greeting + action buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((a, i) =>
              i === 0 ? (
                <Link
                  key={a.href}
                  href={a.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {a.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  key={a.href}
                  href={a.href}
                  className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                >
                  {a.label}
                </Link>
              )
            )}
          </div>
        </motion.div>

        {!activeBusiness && !loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-heading text-lg font-semibold text-foreground">No business selected</p>
            <p className="mt-1 text-sm text-muted-foreground">Set up a business to get started.</p>
            {user?.role === 'admin' && (
              <Link
                href="/dashboard/businesses"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                Add business
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── PERIOD TABS + BRANCH/DATE ── */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex self-start rounded-xl bg-border/60 p-1">
                {PERIOD_TABS.map((t) => {
                  const active = period === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setPeriod(t.key)}
                      className={cn(
                        'relative rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="periodPill"
                          className="absolute inset-0 rounded-lg bg-card shadow-sm"
                          transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                        />
                      )}
                      <span className="relative z-10 whitespace-nowrap">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {activeBusiness?.name} · {dateLabel}
              </p>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {loading ? (
                CARD_SPANS.map((span, i) => (
                  <div key={i} className={cn('h-[96px] animate-pulse rounded-2xl border border-border bg-card', span)} />
                ))
              ) : (
                <>
                  {/* Hero: sales + profit in one panel, like the landing hero */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn('rounded-2xl border px-4 py-3.5 sm:px-5', heroTone.card, CARD_SPANS[0])}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className={cn('text-[11px] font-bold uppercase tracking-wide', heroTone.label)}>{salesLabel}</p>
                      {margin !== null && margin >= 0 && (
                        <span className="rounded-full bg-[hsl(var(--brand-lime))] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-deep))]">
                          {margin}% margin
                        </span>
                      )}
                    </div>
                    <p className={cn('tabular mt-1.5 font-heading text-[32px] font-bold leading-none', heroTone.value)}>
                      {fmt(current.revenue)}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold">
                      <span className={cn('tabular', profit < 0 ? 'text-red-300' : 'text-[hsl(var(--brand-lime))]')}>
                        {canSeeExpenses ? 'After expenses' : 'Profit'} {fmt(profit)}
                      </span>
                      <span className={heroTone.sub}>
                        {current.count} transaction{current.count === 1 ? '' : 's'}
                      </span>
                    </p>
                  </motion.div>

                  {secondaryCards.map((card, i) => {
                    const t = TONES[card.tone];
                    return (
                      <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: (i + 1) * 0.05 }}
                        className={cn('rounded-2xl border px-4 py-3.5 sm:px-5', t.card, CARD_SPANS[i + 1])}
                      >
                        <p className={cn('text-[11px] font-bold uppercase tracking-wide', t.label)}>{card.label}</p>
                        <p className={cn('tabular mt-1.5 font-heading text-[26px] font-bold leading-none', t.value)}>
                          {card.value}
                        </p>
                        <p className={cn('mt-2 text-xs font-medium', t.sub)}>{card.sub}</p>
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>

            {/* ── WEEK / MONTH STRIP ── */}
            {!loading && (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-1.5 rounded-2xl border border-border bg-accent/60 px-5 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">This week</span>
                  <span className="font-bold text-foreground">Sales <span className="tabular">{fmt(data.week.revenue)}</span></span>
                  <span className="font-bold text-foreground">Profit <span className="tabular">{fmt(profitOf(data.week))}</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">This month</span>
                  <span className="font-bold text-foreground">Sales <span className="tabular">{fmt(data.month.revenue)}</span></span>
                  <span className="font-bold text-foreground">Profit <span className="tabular">{fmt(profitOf(data.month))}</span></span>
                </div>
              </div>
            )}

            {/* ── MAIN GRID ── */}
            <div className="grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">

              {/* Recent transactions */}
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <h2 className="px-5 py-3.5 font-heading text-[15px] font-bold text-foreground">Recent transactions</h2>
                {loading ? (
                  <div className="space-y-px">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-[48px] animate-pulse border-t border-border bg-muted/50" />)}
                  </div>
                ) : data.recent.length === 0 ? (
                  <p className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground">
                    No transactions yet.
                  </p>
                ) : (
                  <ul>
                    {data.recent.map((r) => (
                      <li
                        key={`${r.kind}-${r.id}`}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 border-t border-border px-5 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{r.label}</p>
                          <p className="text-xs text-muted-foreground">{r.kind}</p>
                        </div>
                        <span className="tabular text-muted-foreground">{formatWhen(r.at)}</span>
                        <span className="tabular min-w-[64px] text-right font-bold text-foreground">{fmt(r.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Needs attention */}
              <section className="rounded-2xl border border-border bg-card px-5 py-3.5">
                <div className="flex items-center justify-between pb-3">
                  <h2 className="font-heading text-[15px] font-bold text-foreground">Needs attention</h2>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {data.lowCount} low · {data.outCount} out
                  </span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" />)}
                  </div>
                ) : data.attention.length === 0 ? (
                  <p className="border-t border-border pt-3 text-sm text-muted-foreground">Stock is all healthy.</p>
                ) : (
                  <ul>
                    {data.attention.map((a) => {
                      const critical = a.quantity <= 1;
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-sm">
                          <span className="truncate font-medium text-foreground">{a.name}</span>
                          <span className={cn(
                            'flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold',
                            critical
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                          )}>
                            {a.quantity === 0 ? 'Out' : `${a.quantity} left`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {attentionTotal > data.attention.length && (
                  <Link
                    href="/dashboard/alerts"
                    className="mt-1 flex items-center gap-1.5 border-t border-border pt-3 text-sm font-bold text-primary hover:underline"
                  >
                    View all {attentionTotal}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}