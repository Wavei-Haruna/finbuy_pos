'use client';

// app/signup/page.tsx
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { auth, db } from '@/lib/firebase';
import {
  LOGO_SRC,
  LOGIN_HREF,
  DASHBOARD_HREF,
  button,
} from '@/components/home/site-config';

// ── Edit these if your routes are named differently ─────────────────────────
const PRODUCTS_HREF = '/dashboard/products'; // where products are added
const SALES_HREF = '/dashboard/sales'; // where an admin makes a sale
const TRIAL_NOTE = '14-day free trial. Cancel any time.';

// Same key BusinessProvider uses to remember the active business
const ACTIVE_BUSINESS_KEY = 'finbuy_active_business_id';
// Remembers which onboarding step to resume at if the owner leaves and comes back
const ONBOARDING_KEY = 'kashora_onboarding_step';

type Step = 1 | 2 | 3;
type ProductMethod = 'scan' | 'add';

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Your business' },
  { n: 2, label: 'Add your products' },
  { n: 3, label: 'Make your first sale' },
];

const INDUSTRIES = ['Retail', 'Food and drink', 'Fashion', 'Electronics', 'Services'];

const PRODUCT_METHODS: { id: ProductMethod; title: string; subtitle: string }[] = [
  { id: 'add', title: 'Add one by one', subtitle: 'Name, price, stock' },
  { id: 'scan', title: 'Scan barcodes', subtitle: 'Use your phone camera' },
];

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground ' +
  'placeholder:text-muted-foreground placeholder:font-normal outline-none transition ' +
  'focus:border-ring focus:ring-4 focus:ring-ring/20 disabled:opacity-50 disabled:cursor-not-allowed';

// Staff sign in with this code, and the login page uppercases what they type,
// so codes are always generated in uppercase, e.g. "FIN-482".
async function generateBusinessCode(name: string): Promise<string> {
  const letters = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = (letters.slice(0, 3) || 'KSH').padEnd(3, 'K');

  for (let i = 0; i < 8; i++) {
    const code = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    const snap = await getDocs(
      query(collection(db, 'businesses'), where('businessId', '==', code))
    );
    if (snap.empty) return code;
  }
  return `${prefix}-${Date.now().toString().slice(-5)}`;
}

function friendlyError(err: any): string {
  switch (err?.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
}

export default function SignupPage() {
  const { user, loading: authLoading, register } = useAuth();
  const router = useRouter();
  const initDone = useRef(false);

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [needsAccount, setNeedsAccount] = useState(true);

  // Step 1 fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [bizName, setBizName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);

  // Step 2
  const [method, setMethod] = useState<ProductMethod>('add');

  // Created business (for step 3)
  const [created, setCreated] = useState<{ id: string; name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Decide where to start: new visitor, signed-in without a business, or mid-onboarding
  useEffect(() => {
    if (authLoading || initDone.current) return;
    initDone.current = true;

    if (!user) {
      setReady(true);
      return;
    }

    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'businesses'), where('userId', '==', user.id))
        );
        const marker = localStorage.getItem(ONBOARDING_KEY);

        if (snap.empty) {
          // Signed in but no business yet: only ask for the business details
          setNeedsAccount(false);
          setStep(1);
        } else if (marker === '2' || marker === '3') {
          const d = snap.docs[0];
          setNeedsAccount(false);
          setCreated({ id: d.id, name: d.data().name, code: d.data().businessId });
          setStep(Number(marker) as Step);
        } else {
          // Existing owner who is not mid-onboarding: nothing to do here
          router.replace(DASHBOARD_HREF);
          return;
        }
      } catch {
        // If the lookup fails, fall back to the normal form
      }
      setReady(true);
    })();
  }, [authLoading, user, router]);

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = fullName.trim();
    const business = bizName.trim();

    if (needsAccount && (!name || !email.trim() || password.length < 6)) {
      setError('Add your name, email and a password of at least 6 characters.');
      return;
    }
    if (!business) {
      setError('Add your business name.');
      return;
    }

    setLoading(true);
    try {
      let registeredNow = false;

      if (needsAccount) {
        await register(email.trim(), password, name, 'admin');
        registeredNow = true;
        // If the next step fails, a retry must not try to register again
        setNeedsAccount(false);
      }

      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Could not sign you in. Please try again.');

      const code = await generateBusinessCode(business);
      const ref = await addDoc(collection(db, 'businesses'), {
        name: business,
        businessId: code,
        createdAt: new Date(),
        userId: uid,
        logoUrl: null,
        industry,
        // New shops are not phone-repair shops; owners can change this in Settings
        businessType: 'general',
      });

      // The auth listener also creates a user doc (named after the email) the
      // moment the account exists. Make sure the name the owner typed wins.
      if (registeredNow) {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (!snap.exists() || snap.data().name !== name) {
          await setDoc(
            userRef,
            { name, email: email.trim(), role: 'admin', createdAt: new Date() },
            { merge: true }
          );
        }
      }

      localStorage.setItem(ACTIVE_BUSINESS_KEY, ref.id);
      localStorage.setItem(ONBOARDING_KEY, '2');
      setCreated({ id: ref.id, name: business, code });
      setStep(2);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // Hard navigation on purpose: it makes the business provider reload and
  // pick up the business that was just created.
  const leaveTo = (href: string, nextStep?: '3') => {
    if (nextStep) localStorage.setItem(ONBOARDING_KEY, nextStep);
    else localStorage.removeItem(ONBOARDING_KEY);
    window.location.assign(href);
  };

  const skipProducts = () => {
    localStorage.setItem(ONBOARDING_KEY, '3');
    setStep(3);
  };

  const copyCode = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked, nothing to do */
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted lg:grid lg:grid-cols-[minmax(380px,0.85fr)_1.15fr]">
      <SidePanel step={step} />

      <main className="flex min-h-screen flex-col px-5 sm:px-10">
        {/* Mobile header */}
        <div className="flex items-center justify-between py-5 lg:hidden">
          <Link href="/" aria-label="Kashora home">
            <Image
              src={LOGO_SRC}
              alt="Kashora"
              width={140}
              height={48}
              priority
              className="h-10 w-auto mix-blend-multiply"
            />
          </Link>
          <Link href={LOGIN_HREF} className="text-sm font-semibold text-primary underline underline-offset-4">
            Sign in
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">
          <ProgressBars step={step} />

          <AnimatePresence mode="wait">
            {/* ── STEP 1: ACCOUNT + BUSINESS ── */}
            {step === 1 && (
              <motion.form
                key="step1"
                onSubmit={handleBusinessSubmit}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-8"
                noValidate
              >
                <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
                  Tell us about your business
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can change all of this later.
                </p>

                <div className="mt-8 space-y-5">
                  {needsAccount && (
                    <>
                      <Field label="Your name" htmlFor="fullName">
                        <input
                          id="fullName"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Ama Mensah"
                          disabled={loading}
                          className={inputClass}
                          autoComplete="name"
                        />
                      </Field>

                      <Field label="Email address" htmlFor="email">
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          disabled={loading}
                          className={inputClass}
                          autoComplete="email"
                        />
                      </Field>

                      <Field label="Password" htmlFor="password" hint="At least 6 characters">
                        <div className="relative">
                          <input
                            id="password"
                            type={showPwd ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={loading}
                            className={`${inputClass} pr-11`}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPwd(!showPwd)}
                            aria-label={showPwd ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>

                      <div className="border-t border-border" />
                    </>
                  )}

                  <Field label="Business name" htmlFor="bizName">
                    <input
                      id="bizName"
                      type="text"
                      value={bizName}
                      onChange={(e) => setBizName(e.target.value)}
                      placeholder="e.g. Finbuy Kumasi"
                      disabled={loading}
                      className={inputClass}
                    />
                  </Field>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">What do you sell?</p>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map((item) => {
                        const active = industry === item;
                        return (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={active}
                            disabled={loading}
                            onClick={() => setIndustry(item)}
                            className={`h-11 rounded-xl border px-4 text-sm font-bold transition-colors ${
                              active
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-foreground hover:border-primary'
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <ErrorBox error={error} />

                  <button
                    type="submit"
                    disabled={loading}
                    className={`${button('primary', 'lg')} w-full disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4 text-brand-lime" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href={LOGIN_HREF} className="font-semibold text-primary underline underline-offset-4">
                      Sign in
                    </Link>
                  </p>
                </div>
              </motion.form>
            )}

            {/* ── STEP 2: ADD PRODUCTS ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-8"
              >
                <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
                  Add your products
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pick the quickest way. You can add more any time.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How to add products">
                  {PRODUCT_METHODS.map((m) => {
                    const active = method === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMethod(m.id)}
                        className={`rounded-2xl border bg-card px-5 py-4 text-left shadow-sm transition-colors ${
                          active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary'
                        }`}
                      >
                        <p className="font-heading text-[15px] font-bold text-foreground">{m.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{m.subtitle}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <button type="button" onClick={skipProducts} className={button('secondary', 'lg')}>
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={() => leaveTo(`${PRODUCTS_HREF}?from=signup&method=${method}`, '3')}
                    className={button('primary', 'lg')}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 text-brand-lime" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: FIRST SALE ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-8"
              >
                <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
                  Make your first sale
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try the till. Your stock updates as soon as the sale is done.
                </p>

                {created && (
                  <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Your business ID for {created.name}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="font-heading text-3xl font-extrabold tracking-widest text-primary tabular-nums">
                        {created.code}
                      </p>
                      <button
                        type="button"
                        onClick={copyCode}
                        className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                      >
                        {copied ? <Check className="h-4 w-4 text-brand-emerald" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Your cashiers sign in with your business name and this ID.
                    </p>
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={() => leaveTo(DASHBOARD_HREF)} className={button('secondary', 'lg')}>
                    Go to my dashboard
                  </button>
                  <button type="button" onClick={() => leaveTo(SALES_HREF)} className={button('primary', 'lg')}>
                    Open the sales screen
                    <ArrowRight className="h-4 w-4 text-brand-lime" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function SidePanel({ step }: { step: Step }) {
  return (
    <aside className="hidden flex-col justify-between bg-brand-deep px-12 py-12 text-white lg:flex">
      <Link href="/" aria-label="Kashora home" className="self-start">
        {/* White plate so the dark green wordmark stays readable */}
        <span className="inline-block rounded-xl bg-white px-4 py-2">
          <Image src={LOGO_SRC} alt="Kashora" width={140} height={48} priority className="h-9 w-auto" />
        </span>
      </Link>

      <div>
        <h2 className="text-balance text-5xl font-extrabold leading-[1.05] xl:text-6xl">
          Your shop, <span className="text-brand-lime">open</span> in three minutes.
        </h2>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-white/65">
          Sell, track stock and see your profit.
        </p>

        <ol className="mt-10 space-y-4">
          {STEPS.map((s) => {
            const done = step > s.n;
            const current = step === s.n;
            return (
              <li key={s.n} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                    current
                      ? 'bg-brand-lime text-brand-deep'
                      : done
                        ? 'bg-brand-lime/20 text-brand-lime'
                        : 'bg-white/10 text-white/60'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : s.n}
                </span>
                <span
                  className={`text-base ${
                    current ? 'font-bold text-white' : done ? 'font-semibold text-white/80' : 'font-semibold text-white/50'
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="text-sm text-white/50">{TRIAL_NOTE}</p>
    </aside>
  );
}

function ProgressBars({ step }: { step: Step }) {
  return (
    <div className="flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
      {STEPS.map((s) => (
        <span
          key={s.n}
          className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s.n ? 'bg-primary' : 'bg-border'}`}
        />
      ))}
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: {
  label: string; htmlFor: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
          role="alert"
        >
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}