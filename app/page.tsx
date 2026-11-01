// app/page.tsx
// Server component: the marketing page is fully rendered for visitors and search engines.
// Only the nav (auth-aware) and the reveal animation are client components.
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Globe,
  Package,
  Plus,
  Printer,
  Receipt,
  ScanLine,
  ShoppingCart,
  Smartphone,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import {
  LOGO_SRC,
  LOGIN_HREF,
  SIGNUP_HREF,
  SHOW_PRICING,
  PRICING,
  button,
} from '@/components/home/site-config';
import { HomeNav } from '@/components/home/home-nav';
import { Reveal } from '@/components/home/reveal';

const wrap = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const sectionSpace = 'py-16 lg:py-24';

const trustPoints = ['Free to start', 'Runs in your browser', 'Built in Ghana'];

const shopTypes = [
  { label: 'Supermarkets', icon: ShoppingCart },
  { label: 'Mini-marts', icon: Store },
  { label: 'Provision stores', icon: Package },
  { label: 'Wholesale', icon: Boxes },
  { label: 'Electronics', icon: Smartphone },
];

const comparison = {
  before: {
    title: 'Notebook and calculator',
    rows: [
      'Counting the shelves by hand at closing',
      'Cashiers writing receipts one by one',
      'Profit is a guess at month end',
    ],
  },
  after: {
    title: 'Kashora',
    rows: [
      'Stock drops with every item scanned',
      'Receipts printed in seconds at every till',
      'Sales and expenses in one place, every day',
    ],
  },
};

const features = [
  {
    title: 'Scan and sell',
    body: 'Scan a barcode or tap the product, and the item is on the bill. Queues move faster.',
    icon: ScanLine,
  },
  {
    title: 'Stock that keeps up',
    body: 'Every item sold updates your stock, so you always know what is on the shelf.',
    icon: Boxes,
  },
  {
    title: 'Receipts with your name',
    body: 'Print receipts that carry your own business details.',
    icon: Printer,
  },
  {
    title: 'A sign-in for every cashier',
    body: 'Staff sign in with your business name and ID and go straight to the sales screen.',
    icon: Users,
  },
  {
    title: 'More than one branch',
    body: 'Each branch has its own ID, staff and receipts.',
    icon: Store,
  },
  {
    title: 'Expenses and reports',
    body: 'Record what you spend and see how the day went.',
    icon: BarChart3,
  },
];

const steps = [
  { title: 'Create your account', body: 'Add your business name and get your business ID.' },
  { title: 'Add your products', body: 'Enter your products and prices so they are ready to scan and sell.' },
  { title: 'Make your first sale', body: 'Print the receipt and watch your stock update.' },
];

const faqs = [
  {
    q: 'Who can see my reports?',
    a: 'Owners and admins. Cashiers sign in with your business name and ID and go straight to the sales screen.',
  },
  {
    q: 'Can I run more than one branch?',
    a: 'Yes. Each business has its own ID, staff and receipts.',
  },
  {
    q: 'How do my cashiers sign in?',
    a: 'They enter your business name and business ID. You give them the ID from your admin account.',
  },
  {
    q: 'Can I print receipts?',
    a: 'Yes. Receipts carry your own business details.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. Kashora runs in your web browser.',
  },
];

// Sample bars for the dashboard previews (Mon to Sun)
const weekBars = [
  { day: 'Mon', h: 40 },
  { day: 'Tue', h: 65 },
  { day: 'Wed', h: 50 },
  { day: 'Thu', h: 80 },
  { day: 'Fri', h: 60 },
  { day: 'Sat', h: 95 },
  { day: 'Sun', h: 70 },
];

// Sample basket for the till preview
const sampleBasket = [
  { name: 'Cooking oil 1L', qty: 2, price: 68 },
  { name: 'Rice 5kg', qty: 1, price: 95 },
  { name: 'Milo 400g', qty: 1, price: 52 },
  { name: 'Sugar 1kg', qty: 3, price: 21 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-muted text-foreground">
      <style>{`html { scroll-behavior: smooth; }`}</style>

      <HomeNav />

      <main>
        {/* ── HERO ── */}
        <section
          className={`${wrap} grid items-center gap-10 pb-14 pt-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-20 lg:pt-10`}
        >
          <Reveal>
            <h1 className="max-w-lg text-balance text-[1.875rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem]">
              Know what you sold, what is on the shelf, and what you keep.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              The till, the stock book and your daily records for supermarkets and busy shops.
              Scan, sell and watch your stock update across every cashier.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href={SIGNUP_HREF} className={button('primary', 'lg')}>
                Start free
                <ArrowRight className="h-4 w-4 text-brand-lime" />
              </Link>
              <a
                href="#how-it-works"
                className="group inline-flex items-center gap-1.5 text-[15px] font-bold text-foreground underline-offset-4 hover:underline"
              >
                See how it works
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-foreground/80">
              {trustPoints.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-brand-emerald" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Dashboard preview (sample numbers) */}
          <Reveal delay={0.1}>
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 -z-10 rounded-[3rem] bg-brand-lime/25 blur-3xl"
              />
              <div className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-brand-deep/10 sm:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-muted-foreground">Today · Main branch</p>
                  <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-emerald" />
                    Live
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4 rounded-2xl bg-primary p-5 text-primary-foreground">
                  <div>
                    <p className="text-sm font-semibold text-primary-foreground/70">Sales today</p>
                    <p className="mt-1 font-heading text-4xl font-extrabold tabular-nums sm:text-[2.75rem]">
                      GH₵12,480
                    </p>
                    <p className="mt-2 text-sm font-semibold text-brand-lime">
                      After expenses GH₵9,650
                    </p>
                  </div>
                  <div className="flex h-20 items-end gap-1.5" aria-hidden>
                    {weekBars.map((b) => (
                      <div
                        key={b.day}
                        className={`w-2.5 rounded-sm ${b.day === 'Sat' ? 'bg-brand-lime' : 'bg-white/25'}`}
                        style={{ height: `${b.h}%` }}
                      />
                    ))}
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-sm tabular-nums">
                  <li className="flex items-center gap-3 rounded-xl bg-brand-lime/25 px-3 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-lime text-xs font-extrabold text-brand-deep">
                      T1
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-foreground">#1042 · Ama</span>
                      <span className="block text-xs font-semibold text-primary">
                        Till 1 · 14 items · Just now
                      </span>
                    </span>
                    <span className="font-bold text-foreground">GH₵186</span>
                  </li>
                  <li className="flex items-center gap-3 px-3 py-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-primary">
                      T2
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-foreground">#1041 · Esi</span>
                      <span className="block text-xs text-muted-foreground">
                        Till 2 · 6 items · 2 min ago
                      </span>
                    </span>
                    <span className="font-bold text-foreground">GH₵72</span>
                  </li>
                  <li className="flex items-center gap-3 border-t border-border px-3 pt-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Package className="h-4 w-4 text-primary" />
                    </span>
                    <span className="flex-1 font-medium text-foreground">
                      20 products updated in stock
                    </span>
                    <span className="rounded-full bg-brand-lime/30 px-2.5 py-0.5 text-xs font-bold text-brand-deep">
                      Stock
                    </span>
                  </li>
                </ul>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Preview with sample numbers
              </p>
            </div>
          </Reveal>
        </section>

        {/* ── WHO IT IS FOR ── */}
        <section className={wrap}>
          <div className="flex flex-col items-center gap-5 border-t border-border pt-9">
            <p className="text-sm font-medium text-muted-foreground">
              Made for shops with queues, shelves and more than one cashier
            </p>
            <ul className="flex flex-wrap justify-center gap-3">
              {shopTypes.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── PRODUCT TOUR: THE TILL ── */}
        <section className={`${wrap} ${sectionSpace}`}>
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <Reveal>
              <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
                A till that keeps the queue moving
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                Scan each item and the bill builds itself. The total adds up, the receipt prints
                and your stock drops by the right amount. No typing sums, no counting shelves at
                closing time.
              </p>
              <ul className="mt-6 space-y-3 text-[15px] font-medium text-foreground">
                {[
                  'Barcode scanning or a tap on the product',
                  'Stock count shown as you sell',
                  'Receipt prints with your business details',
                  'Every cashier signs in on their own',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-lime">
                      <Check className="h-3 w-3 text-brand-deep" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-3xl border border-border bg-card p-4 shadow-xl shadow-brand-deep/10 sm:p-5">
                <div className="flex items-center gap-2 pb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  <span className="ml-3 text-xs font-semibold text-muted-foreground">
                    Till 1 · New sale
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1.25fr_0.75fr]">
                  <div>
                    <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3">
                      <ScanLine className="h-5 w-5 text-primary" />
                      <span className="text-sm font-semibold text-primary">
                        Scan a barcode or search a product
                      </span>
                    </div>
                    <ul className="mt-3 divide-y divide-border text-sm tabular-nums">
                      {sampleBasket.map((item) => (
                        <li key={item.name} className="flex items-center gap-3 py-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground">
                            {item.qty}×
                          </span>
                          <span className="flex-1 font-medium text-foreground">{item.name}</span>
                          <span className="font-bold text-foreground">
                            GH₵{item.qty * item.price}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col rounded-2xl bg-primary p-4 text-primary-foreground">
                    <p className="text-xs font-semibold text-primary-foreground/70">Current sale</p>
                    <p className="mt-3 text-sm tabular-nums text-primary-foreground/80">
                      7 items
                    </p>
                    <div className="mt-auto pt-6">
                      <p className="text-sm font-semibold text-primary-foreground/70">Total</p>
                      <p className="font-heading text-3xl font-extrabold tabular-nums">GH₵346</p>
                    </div>
                    <div className="mt-4 rounded-xl bg-brand-lime py-2.5 text-center text-sm font-extrabold text-brand-deep">
                      Charge GH₵346
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Preview with sample numbers
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── NOTEBOOK VS KASHORA ── */}
        <section className={`${wrap} pb-16 lg:pb-24`}>
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
              Still counting shelves by hand?
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl bg-destructive/10 p-6 sm:p-8">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {comparison.before.title}
                </h3>
                <ul className="mt-4 divide-y divide-destructive/15">
                  {comparison.before.rows.map((row) => (
                    <li
                      key={row}
                      className="flex items-center gap-3 py-3.5 text-sm font-medium text-foreground"
                    >
                      <X className="h-4 w-4 shrink-0 text-destructive" />
                      {row}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="h-full rounded-3xl bg-accent p-6 sm:p-8">
                <h3 className="font-heading text-lg font-bold text-primary">
                  {comparison.after.title}
                </h3>
                <ul className="mt-4 divide-y divide-primary/15">
                  {comparison.after.rows.map((row) => (
                    <li
                      key={row}
                      className="flex items-center gap-3 py-3.5 text-sm font-medium text-foreground"
                    >
                      <Check className="h-4 w-4 shrink-0 text-brand-emerald" />
                      {row}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className={`${wrap} scroll-mt-24 pb-16 lg:pb-24`}>
          <Reveal>
            <h2 className="text-balance text-center text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
              Everything a supermarket needs, nothing it doesn&rsquo;t
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={(i % 3) * 0.06}>
                  <div className="h-full rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                      <Icon className="h-5 w-5 text-primary" />
                    </span>
                    <h3 className="mt-5 font-heading text-lg font-bold text-foreground">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {f.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className={`${wrap} scroll-mt-24 pb-16 lg:pb-24`}>
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
              Start in three steps
            </h2>
          </Reveal>

          <div className="relative mt-10 grid gap-10 md:grid-cols-3">
            <div
              aria-hidden
              className="absolute left-[16%] right-[16%] top-5 hidden h-px bg-border md:block"
            />
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="relative flex flex-col items-center text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-lime font-heading text-base font-extrabold text-brand-deep ring-8 ring-muted">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-10 flex justify-center">
              <Link href={SIGNUP_HREF} className={button('primary', 'lg')}>
                Start free
                <ArrowRight className="h-4 w-4 text-brand-lime" />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ── DASHBOARD BAND ── */}
        <section className="bg-brand-deep text-white">
          <div className={`${wrap} grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24`}>
            <Reveal>
              <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
                See your whole day at a glance
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
                Sales, expenses and what is left, all in one dashboard that updates as your
                cashiers sell.
              </p>
              <ul className="mt-6 space-y-3 text-[15px] font-medium text-white/85">
                {[
                  { icon: Receipt, t: 'Every sale recorded with the cashier who made it' },
                  { icon: Wallet, t: 'Expenses taken off so you see what you keep' },
                  { icon: Globe, t: 'Check your shop from any phone or computer' },
                ].map(({ icon: Icon, t }) => (
                  <li key={t} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-lime" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white/60">This week</p>
                    <p className="mt-1 font-heading text-3xl font-extrabold tabular-nums">
                      GH₵68,420
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-lime px-3 py-1 text-xs font-bold text-brand-deep">
                    Sales
                  </span>
                </div>

                <div className="mt-8 flex h-40 items-end gap-3" aria-hidden>
                  {weekBars.map((b) => (
                    <div
                      key={b.day}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                    >
                      <div
                        className={`w-full rounded-lg ${b.day === 'Sat' ? 'bg-brand-lime' : 'bg-white/20'}`}
                        style={{ height: `${b.h}%` }}
                      />
                      <span className="text-xs font-semibold text-white/50">{b.day}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-xs text-white/40">Preview with sample numbers</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── PRICING (hidden until real prices are confirmed) ── */}
        {SHOW_PRICING && (
          <section id="pricing" className={`${wrap} ${sectionSpace} scroll-mt-24`}>
            <Reveal>
              <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
                One price per branch
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PRICING.map((tier, i) => (
                <Reveal key={tier.name} delay={i * 0.06}>
                  <div
                    className={`h-full rounded-2xl border p-6 ${
                      tier.featured
                        ? 'border-brand-deep bg-brand-deep text-white'
                        : 'border-border bg-card text-foreground'
                    }`}
                  >
                    <p className="font-heading text-base font-bold">{tier.name}</p>
                    <p className="mt-3 font-heading text-4xl font-extrabold tabular-nums">
                      GH₵{tier.price}
                      <span
                        className={`ml-1 text-sm font-semibold ${
                          tier.featured ? 'text-white/60' : 'text-muted-foreground'
                        }`}
                      >
                        /month
                      </span>
                    </p>
                    <p
                      className={`mt-3 text-sm ${
                        tier.featured ? 'text-white/70' : 'text-muted-foreground'
                      }`}
                    >
                      {tier.note}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        <section id="faq" className={`${wrap} ${sectionSpace} scroll-mt-24`}>
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
              Questions
            </h2>
          </Reveal>

          <Reveal delay={0.06} className="mx-auto mt-10 max-w-3xl">
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {faqs.map((f) => (
                <details key={f.q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-bold text-foreground [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── CLOSING CTA ── */}
        <section className={`${wrap} pb-16 lg:pb-24`}>
          <Reveal>
            <div className="rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-10 lg:py-16">
              <h2 className="text-balance text-2xl font-bold sm:text-3xl lg:text-4xl">
                Make your first sale today
              </h2>
              <p className="mx-auto mt-3 max-w-md text-base text-primary-foreground/70">
                Run your business better, starting with the next customer in the queue.
              </p>
              <Link href={SIGNUP_HREF} className={`${button('lime', 'lg')} mt-7`}>
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border">
        <div
          className={`${wrap} flex flex-col items-center justify-between gap-6 py-10 sm:flex-row`}
        >
          <Link href="/" aria-label="Kashora home">
            <Image
              src={LOGO_SRC}
              alt="Kashora"
              width={180}
              height={60}
              className="h-12 w-auto mix-blend-multiply"
            />
          </Link>

          <div className="flex items-center gap-6 text-sm">
            <Link
              href={LOGIN_HREF}
              className="font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <p className="text-muted-foreground">
              © {new Date().getFullYear()} Kashora. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}