'use client';

import { useState } from 'react';
import { useBusiness } from '@/lib/business-context';
import {
  Building2, Plus, CheckCircle, Loader2,
  ChevronRight, Calendar, ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { button } from '@/components/home/site-config';

const inputClass =
  'w-full h-11 px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground ' +
  'placeholder:text-muted-foreground placeholder:font-normal outline-none transition ' +
  'focus:border-ring focus:ring-4 focus:ring-ring/20 disabled:opacity-50 disabled:cursor-not-allowed';

export default function BusinessesPage() {
  const { businesses, activeBusiness, setActiveBusiness, addBusiness, loading } = useBusiness();

  const [name, setName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const slugify = (val: string) =>
    val
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.slice(0, 3))
      .join('-')
      .slice(0, 12);

  const handleNameChange = (val: string) => {
    setName(val);
    // Only auto-update ID if user hasn't manually edited it
    if (!businessId || businessId === slugify(name)) {
      setBusinessId(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessId.trim()) return;

    const isDupe = businesses.some(
      (b) => b.businessId.toLowerCase() === businessId.trim().toLowerCase()
    );
    if (isDupe) {
      setError('A business with this ID already exists. Choose a unique ID.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await addBusiness(name.trim(), businessId.trim());
      setName('');
      setBusinessId('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to add business. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = name.trim().length > 0 && businessId.trim().length > 0;

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Businesses
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Add and manage your branches
            </p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
            {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'}
          </span>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* ADD BUSINESS FORM */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-2"
          >
            <div className="sticky top-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border px-6 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
                  <Plus className="h-4 w-4 text-primary" />
                </span>
                <h2 className="font-heading text-base font-bold text-foreground">New business</h2>
              </div>

              <div className="space-y-5 p-6">
                {/* Alerts */}
                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                      role="status"
                    >
                      <div className="flex items-center gap-3 rounded-xl bg-accent px-4 py-3 text-primary">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-bold">Business added</p>
                          <p className="mt-0.5 text-xs text-primary/80">
                            It is available across your dashboard now.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
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

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="bizName" className="text-sm font-semibold text-foreground">
                      Business name
                    </label>
                    <input
                      id="bizName"
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Kumasi Fresh Supermarket"
                      required
                      autoComplete="off"
                      disabled={submitting}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="bizId" className="text-sm font-semibold text-foreground">
                      Business ID
                    </label>
                    <input
                      id="bizId"
                      type="text"
                      value={businessId}
                      onChange={(e) =>
                        setBusinessId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16))
                      }
                      placeholder="e.g. KUM-FRE"
                      required
                      autoComplete="off"
                      disabled={submitting}
                      className={`${inputClass} font-mono font-bold tracking-wider`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Filled in from the name. Edit it if you like, 16 characters at most. Your
                      cashiers sign in with this ID.
                    </p>
                  </div>

                  {/* Live preview */}
                  <AnimatePresence>
                    {name && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/60 p-3.5">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-lime text-sm font-extrabold text-brand-deep">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold leading-tight text-foreground">
                              {name}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              {businessId || '—'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={submitting || !isFormValid}
                    className={`${button('primary', 'lg')} w-full disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-brand-lime" />
                        Add business
                      </>
                    )}
                  </button>
                </form>

                <div className="flex items-start gap-2.5 border-t border-border pt-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Each business has its own stock and sales. Staff only see data for the branch
                    they are signed in to.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* BUSINESSES LIST */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-3"
          >
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
                    <Building2 className="h-4 w-4 text-primary" />
                  </span>
                  <h2 className="font-heading text-base font-bold text-foreground">
                    All businesses
                  </h2>
                </div>
                <span className="text-sm font-semibold text-muted-foreground">
                  {businesses.length} total
                </span>
              </div>

              {/* Loading skeleton */}
              {loading && (
                <div className="space-y-3 p-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && businesses.length === 0 && (
                <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                    <Building2 className="h-7 w-7 text-primary" />
                  </span>
                  <div>
                    <p className="font-heading text-lg font-bold text-foreground">
                      No businesses yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add your first business using the form.
                    </p>
                  </div>
                </div>
              )}

              {/* Business list */}
              {!loading && businesses.length > 0 && (
                <div className="space-y-2 p-4">
                  <AnimatePresence initial={false}>
                    {businesses.map((biz, i) => {
                      const isActive = activeBusiness?.id === biz.id;
                      return (
                        <motion.button
                          key={biz.id}
                          type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => setActiveBusiness(biz)}
                          aria-pressed={isActive}
                          className={`group w-full rounded-2xl border p-4 text-left transition-colors ${
                            isActive
                              ? 'border-primary bg-accent'
                              : 'border-border bg-card hover:border-primary'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <span
                              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                                isActive
                                  ? 'bg-brand-lime text-brand-deep'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
                              {biz.name.charAt(0).toUpperCase()}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-bold text-foreground">
                                  {biz.name}
                                </p>
                                {isActive && (
                                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="font-mono font-semibold text-foreground/70">
                                  {biz.businessId}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {biz.createdAt.toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                            </div>

                            <ChevronRight
                              className={`h-4 w-4 flex-shrink-0 transition-all duration-200 ${
                                isActive
                                  ? 'text-primary'
                                  : '-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                              }`}
                            />
                          </div>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}