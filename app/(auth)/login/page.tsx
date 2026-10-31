'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Loader2, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveStaffSession } from '@/lib/staff-auth';

type Mode = 'select' | 'admin' | 'staff';

// Change these if your file or route names are different
const LOGO_SRC = '/logo.png';
const FORGOT_PASSWORD_HREF = '/forgot-password';
const SIGNUP_HREF = '/signup';

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-border bg-muted text-sm font-medium text-foreground ' +
  'placeholder:text-muted-foreground placeholder:font-normal outline-none transition ' +
  'focus:border-ring focus:bg-card focus:ring-4 focus:ring-[hsl(var(--ring)/0.2)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const linkClass =
  'font-semibold text-primary underline underline-offset-4 hover:opacity-80 transition-opacity';

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();

  // Start on the "choose how to sign in" screen. The actual login form
  // only appears after the user picks admin or staff.
  const [mode, setMode] = useState<Mode>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Redirect only AFTER onAuthStateChanged has fully set the user
  // This prevents the race condition where router.push fires before
  // the user doc is fetched from Firestore
  useEffect(() => {
    if (loginAttempted && user) {
      router.push('/dashboard');
    }
  }, [user, loginAttempted, router]);

  // Admin fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Staff fields
  const [bizName, setBizName] = useState('');
  const [bizId, setBizId] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setLoginAttempted(true); // useEffect will redirect once user is ready
    } catch (err: any) {
      const msg =
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Incorrect email or password.'
          : err.code === 'auth/user-not-found'
            ? 'No account found with this email.'
            : err.code === 'auth/too-many-requests'
              ? 'Too many attempts. Try again later.'
              : 'Sign in failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'businesses'), where('businessId', '==', bizId.trim().toUpperCase()))
      );
      if (snap.empty) throw new Error('Business ID not found. Check with your admin.');

      const biz = snap.docs[0];
      const data = biz.data();

      if (data.name.toLowerCase().trim() !== bizName.toLowerCase().trim()) {
        throw new Error('Business name does not match. Please check and try again.');
      }

      saveStaffSession({
        businessId: biz.id,
        businessName: data.name,
        businessCode: data.businessId,
        loginTime: new Date().toISOString(),
      });

      router.push('/staff/sales');
    } catch (err: any) {
      setError(err.message || 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Picking a type takes you TO that login form. Going back resets the
  // form state for that type.
  const chooseMode = (m: Exclude<Mode, 'select'>) => {
    setError('');
    setMode(m);
  };
  const goBack = () => {
    setError('');
    setEmail('');
    setPassword('');
    setBizName('');
    setBizId('');
    setMode('select');
  };

  const subtitle =
    mode === 'select'
      ? 'How would you like to sign in?'
      : mode === 'admin'
        ? 'Sign in with your email and password'
        : 'Enter your business name and ID';

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* ── LOGO + HEADING ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {/* White plate only in dark mode so the dark green wordmark stays readable */}
          <div className="inline-block rounded-2xl dark:bg-white dark:px-5 dark:py-3 mb-6">
            <Image
              src={LOGO_SRC}
              alt="Kashora - Run your business better"
              width={220}
              height={76}
              priority
              className="h-auto w-[200px] sm:w-[220px] mix-blend-multiply dark:mix-blend-normal"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: CHOOSE HOW TO SIGN IN ── */}
          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="space-y-3">
                <ChoiceButton
                  title="Owner or admin"
                  subtitle="Inventory, sales, reports and settings"
                  onClick={() => chooseMode('admin')}
                />
                <ChoiceButton
                  title="Cashier or staff"
                  subtitle="Sign in with your business name and ID"
                  onClick={() => chooseMode('staff')}
                />
              </div>

              <div className="mt-8 space-y-2 text-center text-sm">
                <p>
                  <Link href={FORGOT_PASSWORD_HREF} className={linkClass}>
                    Forgot password?
                  </Link>
                </p>
                <p className="text-muted-foreground">
                  New here?{' '}
                  <Link href={SIGNUP_HREF} className={linkClass}>
                    Start your free trial
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: ADMIN FORM ── */}
          {mode === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <BackLink onClick={goBack} />

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <Field label="Email address" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    className={inputClass}
                    autoComplete="email"
                  />
                </Field>

                <Field label="Password" htmlFor="password">
                  <div className="relative">
                    <input
                      id="password"
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      className={`${inputClass} pr-11`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd(!showPwd)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                <ErrorBox error={error} />
                <SubmitBtn loading={loading} label="Sign in" />
              </form>
            </motion.div>
          )}

          {/* ── STEP 2: STAFF FORM ── */}
          {mode === 'staff' && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <BackLink onClick={goBack} />

              <form onSubmit={handleStaffLogin} className="space-y-4">
                <Field label="Business name" htmlFor="bizName">
                  <input
                    id="bizName"
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="e.g. Kumasi Branch"
                    required
                    disabled={loading}
                    className={inputClass}
                  />
                </Field>

                <Field label="Business ID" htmlFor="bizId" hint="Provided by your admin">
                  <input
                    id="bizId"
                    type="text"
                    value={bizId}
                    onChange={(e) => setBizId(e.target.value.toUpperCase())}
                    placeholder="e.g. KSI-001"
                    required
                    disabled={loading}
                    className={`${inputClass} font-bold tracking-widest tabular-nums`}
                  />
                </Field>

                <ErrorBox error={error} />
                <SubmitBtn loading={loading} label="Access sales dashboard" />
              </form>
            </motion.div>
          )}

        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground mt-8">
          © {new Date().getFullYear()} Kashora · Run your business better
        </p>
      </div>
    </div>
  );
}

function ChoiceButton({ title, subtitle, onClick }: {
  title: string; subtitle: string; onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="group w-full text-left flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary"
    >
      <div className="flex-1 min-w-0">
        <p className="font-heading text-[15px] font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <ArrowRight className="w-4 h-4 flex-shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
    </motion.button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground mb-5 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
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
        >
          <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
            {error}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={{ scale: 0.98 }}
      className="mt-1 w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {label}
          {/* Lime arrow on the forest button in light mode */}
          <ArrowRight className="w-4 h-4 text-[hsl(var(--brand-lime))] dark:text-primary-foreground" />
        </>
      )}
    </motion.button>
  );
}