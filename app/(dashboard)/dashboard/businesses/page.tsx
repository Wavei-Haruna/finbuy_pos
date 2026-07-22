'use client';

import { useState } from 'react';
import { useBusiness } from '@/lib/business-context';
import {
  Building2, Plus, Hash, CheckCircle, Loader2,
  ChevronRight, Store, Sparkles, Calendar, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Top accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent" />

      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-7">

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-[0.15em] uppercase text-green-500">
              Management
            </span>
            <span className="w-1 h-1 rounded-full bg-green-500/40" />
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'} registered
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Businesses<span className="text-gray-400 dark:text-gray-600">.</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
            Add and manage your branches or business entities
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">

          {/* ADD BUSINESS FORM */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-2"
          >
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm sticky top-6">

              {/* Form header bar */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5 text-green-500" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  New Business
                </h2>
              </div>

              <div className="p-6 space-y-5">

                {/* Alerts */}
                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-sm font-bold">Business added!</p>
                          <p className="text-xs opacity-80 mt-0.5">Available across your dashboard now</p>
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
                    >
                      <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <Store className="w-3 h-3" />
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Finbuy Kumasi Branch"
                      required
                      autoComplete="off"
                      className="w-full h-11 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm font-medium focus:outline-none focus:border-green-500 transition-colors"
                    />
                  </div>

                  {/* ID field */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <Hash className="w-3 h-3" />
                      Business ID
                      <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 normal-case tracking-normal">
                        auto-generated
                      </span>
                    </label>
                    <input
                      type="text"
                      value={businessId}
                      onChange={(e) =>
                        setBusinessId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16))
                      }
                      placeholder="e.g. FIN-KSI"
                      required
                      autoComplete="off"
                      className="w-full h-11 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm font-mono font-bold focus:outline-none focus:border-green-500 transition-colors"
                    />
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      Auto-filled from name — edit freely. Max 16 chars.
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
                        <div className="p-3.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Preview</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-black shadow-sm shadow-green-500/20">
                              {name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{name}</p>
                              <p className="text-[11px] font-mono text-gray-400 mt-0.5">{businessId || '—'}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit button */}
                  <motion.button
                    type="submit"
                    disabled={submitting || !isFormValid}
                    whileTap={{ scale: 0.97 }}
                    className="w-full h-11 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-500/20"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Adding…</>
                    ) : (
                      <><Plus className="w-4 h-4" />Add Business</>
                    )}
                  </motion.button>
                </form>

                {/* Footer note */}
                <div className="flex items-start gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                    Each business has isolated inventory and sales. Staff only see data for the active branch.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* BUSINESSES LIST */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-3"
          >
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">

              {/* List header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    All Businesses
                  </h2>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {businesses.length} total
                </span>
              </div>

              {/* Loading skeleton */}
              {loading && (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-[72px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && businesses.length === 0 && (
                <div className="py-20 flex flex-col items-center gap-4 text-center px-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-gray-700 dark:text-gray-300">No businesses yet</p>
                    <p className="text-sm text-gray-400 mt-1">Add your first business using the form on the left</p>
                  </div>
                </div>
              )}

              {/* Business list */}
              {!loading && businesses.length > 0 && (
                <div className="p-4 space-y-2">
                  <AnimatePresence initial={false}>
                    {businesses.map((biz, i) => {
                      const isActive = activeBusiness?.id === biz.id;
                      return (
                        <motion.button
                          key={biz.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => setActiveBusiness(biz)}
                          className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 group ${
                            isActive
                              ? 'border-green-500/40 bg-green-500/5 dark:bg-green-500/[0.07]'
                              : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Avatar */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all duration-200 ${
                              isActive
                                ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-md shadow-green-500/20'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            }`}>
                              {biz.name.charAt(0)}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-bold text-sm ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {biz.name}
                                </p>
                                {isActive && (
                                  <span className="text-[10px] font-black text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 uppercase tracking-wider">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5 mt-1">
                                <span className="text-xs font-mono text-gray-400">{biz.businessId}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                  <Calendar className="w-3 h-3" />
                                  {biz.createdAt.toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${
                              isActive
                                ? 'text-green-500'
                                : 'text-gray-300 dark:text-gray-600 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                            }`} />
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