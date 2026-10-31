// app/page.tsx
// Server component: the marketing page is fully rendered for visitors and search engines.
// Only the nav (auth-aware) and the reveal animation are client components.
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Plus, X } from 'lucide-react';

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
const sectionSpace = 'py-20 lg:py-28';

const comparison = {
  before: {
    title: 'Notebook and calculator',
    rows: [
      'Counting stock by hand',
      'Receipts written one by one',
      'Profit is a guess at month end',
    ],
  },
  after: {
    title: 'Kashora',
    rows: [
      'Stock updates with every sale',
      'Receipts printed in seconds',
      'Sales and expenses in one place, every day',
    ],
  },
};

const features = [
  {
    title: 'Sell in seconds',
    body: 'Scan a barcode or tap the product, and the sale is done.',
  },
  {
    title: 'Stock that keeps up',
    body: 'Every sale updates your stock, so you always know what is on the shelf.',
  },
  {
    title: 'Receipts with your name',
    body: 'Print receipts that carry your own business details.',
  },
  {
    title: 'Sign-ins for your cashiers',
    body: 'Staff sign in with your business name and ID and go straight to the sales screen.',
  },
  {
    title: 'More than one shop',
    body: 'Each branch has its own ID, staff and receipts.',
  },
  {
    title: 'Expenses and reports',
    body: 'Record what you spend and see how the day went.',
  },
];

const steps = [
  { title: 'Create your account', body: 'Add your business name and get your business ID.' },
  { title: 'Add your products', body: 'Enter your products and prices so they are ready to sell.' },
  { title: 'Make your first sale', body: 'Print the receipt and watch your stock update.' },
];

const faqs = [
  {
    q: 'Who can see my reports?',
    a: 'Owners and admins. Cashiers sign in with your business name and ID and go straight to the sales screen.',
  },
  {
    q: 'Can I run more than one shop?',
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

// Sample bars for the dashboard preview (Mon to Sun)
const weekBars = [
  { day: 'Mon', h: 40 },
  { day: 'Tue', h: 65 },
  { day: 'Wed', h: 50 },
  { day: 'Thu', h: 80 },
  { day: 'Fri', h: 60 },
  { day: 'Sat', h: 95 },
  { day: 'Sun', h: 70 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-muted text-foreground">
      <style>{`html { scroll-behavior: smooth; }`}</style>

      <HomeNav />

      <main>
        {/* ── HERO ── */}
        <section
          className={`${wrap} grid items-center gap-14 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-16`}
        >
          <Reveal>
            <h1 className="text-balance text-[2.75rem] font-extrabold leading-[1.03] text-foreground sm:text-6xl lg:text-[4.25rem]">
              Know what you sold, what you have, and what you keep.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              The till, the stock book and your daily records in one place. Make a sale in
              seconds and see how your shop is doing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={SIGNUP_HREF} className={button('primary', 'lg')}>
                Start free
                <ArrowRight className="h-4 w-4 text-brand-lime" />
              </Link>
              <a href="#how-it-works" className={button('secondary', 'lg')}>
                See how it works
              </a>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Built in Ghana for shops that sell every day.
            </p>
          </Reveal>

          {/* Dashboard preview (sample numbers) */}
          <Reveal delay={0.1}>
            <div className="relative pb-8 sm:pl-6">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-brand-deep/10 sm:p-6">
                <p className="text-sm font-semibold text-muted-foreground">Today · Main shop</p>

                <div className="mt-4 rounded-2xl bg-primary p-5 text-primary-foreground">
                  <p className="text-sm font-semibold text-primary-foreground/70">Sales today</p>
                  <p className="mt-1 font-heading text-5xl font-extrabold tabular-nums">
                    GH₵295
                  </p>
                  <p className="mt-2 text-sm font-semibold text-brand-lime">
                    After expenses GH₵179
                  </p>
                </div>

                <ul className="mt-4 divide-y divide-border text-sm tabular-nums">
                  <li className="flex items-center justify-between py-3">
                    <span className="font-medium text-foreground">#0507 · Ama</span>
                    <span className="font-bold text-foreground">GH₵135</span>
                  </li>
                  <li className="flex items-center justify-between py-3">
                    <span className="font-medium text-foreground">#0506 · Esi</span>
                    <span className="font-bold text-foreground">GH₵60</span>
                  </li>
                  <li className="flex items-center justify-between pt-3">
                    <span className="font-medium text-foreground">2 products updated in stock</span>
                    <span className="rounded-full bg-brand-lime/30 px-2.5 py-0.5 text-xs font-bold text-brand-deep">
                      Stock
                    </span>
                  </li>
                </ul>
              </div>

              <div className="absolute -bottom-0 left-0 rounded-2xl bg-brand-lime px-5 py-3 text-brand-deep shadow-lg shadow-brand-deep/20 sm:-left-0">
                <p className="text-xs font-bold">Sale recorded</p>
                <p className="font-heading text-2xl font-extrabold tabular-nums">GH₵135</p>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground sm:pl-6">
                Preview with sample numbers
              </p>
            </div>
          </Reveal>
        </section>

        {/* ── WHO IT IS FOR ── */}
        <section className={wrap}>
          <p className="border-t border-border pt-10 text-center text-sm text-muted-foreground">
            Built for electronics, fashion, food and drink, home goods and service shops.
          </p>
        </section>

        {/* ── NOTEBOOK VS KASHORA ── */}
        <section className={`${wrap} ${sectionSpace}`}>
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold text-foreground sm:text-4xl">
              Still using a notebook?
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl bg-destructive/10 p-6 sm:p-8">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {comparison.before.title}
                </h3>
                <ul className="mt-4 divide-y divide-destructive/15">
                  {comparison.before.rows.map((row) => (
                    <li key={row} className="flex items-center gap-3 py-3.5 text-sm font-medium text-foreground">
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
                    <li key={row} className="flex items-center gap-3 py-3.5 text-sm font-medium text-foreground">
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
        <section id="features" className={`${wrap} scroll-mt-24 pb-20 lg:pb-28`}>
          <Reveal>
            <h2 className="text-balance text-center text-3xl font-extrabold text-foreground sm:text-4xl">
              Everything a shop needs, nothing it doesn&rsquo;t
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary">
                  <span className="block h-2.5 w-2.5 rounded-[3px] bg-brand-lime" />
                  <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className={`${wrap} scroll-mt-24 pb-20 lg:pb-28`}>
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold text-foreground sm:text-4xl">
              Start in three steps
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-lime font-heading text-base font-extrabold text-brand-deep">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── DASHBOARD BAND ── */}
        <section className="bg-brand-deep text-white">
          <div className={`${wrap} grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28`}>
            <Reveal>
              <h2 className="text-balance text-3xl font-extrabold sm:text-4xl lg:text-5xl">
                See your whole day at a glance
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70">
                Sales, expenses and what is left, all in one dashboard that updates as you sell.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white/60">This week</p>
                    <p className="mt-1 font-heading text-3xl font-extrabold tabular-nums">
                      GH₵2,140
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-lime px-3 py-1 text-xs font-bold text-brand-deep">
                    Sales
                  </span>
                </div>

                <div className="mt-8 flex h-40 items-end gap-3" aria-hidden>
                  {weekBars.map((b) => (
                    <div key={b.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
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
              <h2 className="text-center text-3xl font-extrabold text-foreground sm:text-4xl">
                One price per branch
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
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
            <h2 className="text-center text-3xl font-extrabold text-foreground sm:text-4xl">
              Questions
            </h2>
          </Reveal>

          <Reveal delay={0.06} className="mx-auto mt-12 max-w-3xl">
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
        <section className={`${wrap} pb-20 lg:pb-28`}>
          <Reveal>
            <div className="rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-10 lg:py-20">
              <h2 className="text-balance text-3xl font-extrabold sm:text-4xl lg:text-5xl">
                Make your first sale today
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base text-primary-foreground/70">
                Run your business better, starting with the next customer.
              </p>
              <Link href={SIGNUP_HREF} className={`${button('lime', 'lg')} mt-8`}>
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border">
        <div className={`${wrap} flex flex-col items-center justify-between gap-6 py-10 sm:flex-row`}>
          <Link href="/" aria-label="Kashora home">
            <Image
              src={LOGO_SRC}
              alt="Kashora"
              width={140}
              height={48}
              className="h-11 w-auto mix-blend-multiply"
            />
          </Link>

          <div className="flex items-center gap-6 text-sm">
            <Link href={LOGIN_HREF} className="font-semibold text-muted-foreground transition-colors hover:text-foreground">
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