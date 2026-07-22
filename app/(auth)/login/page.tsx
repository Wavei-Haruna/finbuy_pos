'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Loader2, Mail, Lock, Hash, Store, ArrowRight,
  ShieldCheck, Users, Eye, EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveStaffSession } from '@/lib/staff-auth';

type Mode = 'admin' | 'staff';

export default function LoginPage() {
  const { login, user } = useAuth();
  const router    = useRouter();

  const [mode,           setMode]           = useState<Mode>('admin');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [showPwd,        setShowPwd]        = useState(false);
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
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Staff fields
  const [bizName, setBizName] = useState('');
  const [bizId,   setBizId]   = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      setLoginAttempted(true); // useEffect will redirect once user is ready
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
        ? 'Incorrect email or password.'
        : err.code === 'auth/user-not-found'
          ? 'No account found with this email.'
          : err.code === 'auth/too-many-requests'
            ? 'Too many attempts. Try again later.'
            : 'Sign in failed. Please try again.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'businesses'), where('businessId', '==', bizId.trim().toUpperCase()))
      );
      if (snap.empty) throw new Error('Business ID not found. Check with your admin.');

      const biz  = snap.docs[0];
      const data = biz.data();

      if (data.name.toLowerCase().trim() !== bizName.toLowerCase().trim()) {
        throw new Error('Business name does not match. Please check and try again.');
      }

      saveStaffSession({
        businessId:   biz.id,
        businessName: data.name,
        businessCode: data.businessId,
        loginTime:    new Date().toISOString(),
      });

      router.push('/staff/sales');
    } catch (err: any) {
      setError(err.message || 'Login failed. Try again.');
    } finally { setLoading(false); }
  };

  const switchMode = (m: Mode) => { setMode(m); setError(''); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.07),transparent_60%)] pointer-events-none" />

      <div className="relative w-full max-w-md">

        {/* ── LOGO ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-500/25">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Welcome back</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your dashboard</p>
        </motion.div>

        {/* ── CARD ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">

          {/* Tab toggle */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
            {([
              { key: 'admin', label: 'Admin',       icon: ShieldCheck },
              { key: 'staff', label: 'Staff Login',  icon: Users       },
            ] as { key: Mode; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => switchMode(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all duration-200 relative ${
                  mode === key
                    ? 'text-gray-900 dark:text-white bg-white dark:bg-gray-900'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {mode === key && (
                  <motion.div layoutId="tabLine"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-green-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Subtitle */}
            <AnimatePresence mode="wait">
              <motion.p key={mode} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-gray-400 mb-5 text-center">
                {mode === 'admin'
                  ? 'Full access — manage inventory, reports & settings'
                  : 'Staff access — record sales for your assigned business'}
              </motion.p>
            </AnimatePresence>

            <AnimatePresence mode="wait">

              {/* ── ADMIN FORM ── */}
              {mode === 'admin' && (
                <motion.form key="admin"
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}
                  onSubmit={handleAdminLogin} className="space-y-4">

                  <Field label="Email Address" icon={<Mail className="w-3.5 h-3.5" />}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" required disabled={loading}
                      className="input-base" autoComplete="email" />
                  </Field>

                  <Field label="Password" icon={<Lock className="w-3.5 h-3.5" />}>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" required disabled={loading}
                        className="input-base pr-11" autoComplete="current-password" />
                      <button type="button" tabIndex={-1}
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  <ErrorBox error={error} />
                  <SubmitBtn loading={loading} label="Sign in" />
                </motion.form>
              )}

              {/* ── STAFF FORM ── */}
              {mode === 'staff' && (
                <motion.form key="staff"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}
                  onSubmit={handleStaffLogin} className="space-y-4">

                  <Field label="Business Name" icon={<Store className="w-3.5 h-3.5" />}>
                    <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)}
                      placeholder="e.g. Kumasi Branch" required disabled={loading}
                      className="input-base" />
                  </Field>

                  <Field label="Business ID" icon={<Hash className="w-3.5 h-3.5" />}
                    hint="Provided by your admin">
                    <input type="text" value={bizId}
                      onChange={(e) => setBizId(e.target.value.toUpperCase())}
                      placeholder="e.g. KSI-001" required disabled={loading}
                      className="input-base font-mono font-bold tracking-widest" />
                  </Field>

                  <ErrorBox error={error} />
                  <SubmitBtn loading={loading} label="Access Sales Dashboard" />
                </motion.form>
              )}

            </AnimatePresence>
          </div>
        </motion.div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Admin Dashboard · All rights reserved
        </p>
      </div>

      <style jsx global>{`
        .input-base {
          width: 100%; height: 44px;
          padding: 0 14px;
          border-radius: 12px;
          border: 2px solid rgb(229 231 235);
          background: rgb(249 250 251);
          color: rgb(17 24 39);
          font-size: 14px; font-weight: 500;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .dark .input-base {
          border-color: rgb(55 65 81);
          background: rgb(31 41 55);
          color: rgb(255 255 255);
        }
        .input-base:focus {
          border-color: rgb(34 197 94);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
        }
        .input-base:disabled { opacity: 0.5; cursor: not-allowed; }
        .input-base::placeholder { color: rgb(156 163 175); font-weight: 400; }
      `}</style>
    </div>
  );
}

function Field({ label, icon, hint, children }: {
  label: string; icon: React.ReactNode; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        {icon} {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 flex items-center gap-1">ℹ {hint}</p>}
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
      className="w-full h-11 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-500/20 mt-1">
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <>{label} <ArrowRight className="w-4 h-4" /></>}
    </motion.button>
  );
}