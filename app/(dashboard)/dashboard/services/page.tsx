'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  query, where,
} from 'firebase/firestore';
import { Service, ServiceRecord } from '@/lib/types';
import { ServiceForm } from './components/ServiceForm';
import {
  Loader2, TrendingUp, TrendingDown, Wrench, Trash2, X, Check, Wallet,
  Receipt, ChevronDown, AlertCircle, ListChecks,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ───────────────────────── helpers ───────────────────────── */

const PAGE_SIZE = 50;
const LIME = 'hsl(var(--brand-lime))';
const LEAF = 'hsl(var(--brand-leaf))';
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const MONEY = 'text-[hsl(var(--brand-emerald))] dark:text-[hsl(var(--brand-lime))]';

const genReceiptNo = () => `SRV-${Date.now().toString(36).toUpperCase()}`;
const fmt = (n: number) => `₵${n.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
const sumPrice = (l: ServiceRecord[]) => l.reduce((a, r) => a + r.price, 0);
const sumCost  = (l: ServiceRecord[]) => l.reduce((a, r) => a + (r.cost || 0), 0);
const timeOf   = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ───────────────────────── page ───────────────────────── */

export default function ServicesPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();
  const isAdmin = !!user; // same convention as Sales: staff sessions have no `user`

  const [services, setServices] = useState<Service[]>([]);
  const [records,  setRecords]  = useState<ServiceRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [successMsg,  setSuccessMsg]  = useState('');
  const [submitError, setSubmitError] = useState('');
  const [listError,   setListError]   = useState('');
  const [range,   setRange]   = useState<'today' | 'all'>('today');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showCatalog, setShowCatalog] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);

  useEffect(() => { if (activeBusiness) fetchData(); else setLoading(false); }, [activeBusiness]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const [svcSnap, recSnap] = await Promise.all([
        getDocs(query(collection(db, 'services'), where('businessId', '==', activeBusiness.id))),
        getDocs(query(collection(db, 'serviceRecords'), where('businessId', '==', activeBusiness.id))),
      ]);
      const svcs = svcSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      })) as Service[];
      svcs.sort((a, b) => a.name.localeCompare(b.name));
      setServices(svcs);

      const recs = recSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        recordedAt: d.data().recordedAt?.toDate() || new Date(),
      })) as ServiceRecord[];
      recs.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
      setRecords(recs);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error(e);
      setListError('Could not load your services. Check your connection and refresh.');
    } finally { setLoading(false); }
  };

  /** Resolves true only when the job was saved, so the form keeps what was typed if it wasn't. */
  const handleSubmit = async (data: {
    serviceId: string | null;
    newService?: { name: string; category: string; defaultPrice: number };
    price: number; cost: number;
    customerName: string; customerPhone: string; notes: string;
  }): Promise<boolean> => {
    if (!activeBusiness) return false;
    setSubmitting(true);
    setSubmitError('');
    try {
      let serviceId = data.serviceId;
      const picked = serviceId ? services.find((s) => s.id === serviceId) : undefined;
      let serviceName = picked?.name || '';
      let category: string = picked?.category || 'Uncategorized';

      // Brand-new service type: save it to the catalog first so it's reusable next time.
      // If a service with the same name already exists (e.g. a retry after a failed save),
      // reuse it instead of creating a duplicate.
      if (!serviceId && data.newService) {
        const wanted = data.newService.name.trim();
        const dup = services.find((s) => s.name.trim().toLowerCase() === wanted.toLowerCase());
        if (dup) {
          serviceId = dup.id; serviceName = dup.name; category = dup.category || 'Uncategorized';
        } else {
          const svcRef = await addDoc(collection(db, 'services'), {
            businessId: activeBusiness.id,
            name: wanted,
            category: data.newService.category,
            defaultPrice: data.newService.defaultPrice,
            createdAt: new Date(),
          });
          serviceId = svcRef.id;
          serviceName = wanted;
          category = data.newService.category;
          setServices((prev) => [...prev, {
            id: svcRef.id, businessId: activeBusiness.id, name: serviceName, category,
            defaultPrice: data.newService!.defaultPrice, createdAt: new Date(),
          } as Service].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
      if (!serviceId) { setSubmitError('Choose a service first.'); return false; }

      const receiptNo = genReceiptNo();
      const recordedBy = user?.name || 'Staff';
      const recordedAt = new Date();
      const recRef = await addDoc(collection(db, 'serviceRecords'), {
        serviceId, serviceName, category,
        businessId: activeBusiness.id,
        price: data.price, cost: data.cost,
        customerName: data.customerName, customerPhone: data.customerPhone,
        recordedBy, recordedAt,
        notes: data.notes,
        receiptNo,
      });
      setRecords((prev) => [{
        id: recRef.id, serviceId, serviceName, category, businessId: activeBusiness.id,
        price: data.price, cost: data.cost, customerName: data.customerName, customerPhone: data.customerPhone,
        recordedBy, recordedAt, notes: data.notes, receiptNo,
      } as ServiceRecord, ...prev]);

      setSuccessMsg('Service logged');
      setTimeout(() => setSuccessMsg(''), 2500);
      setRange('today');
      return true;
    } catch (e: any) {
      console.error(e);
      setSubmitError(e?.message || 'Could not log the service. Nothing was saved, please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (rec: ServiceRecord) => {
    if (!rec.id) return;
    setDeletingId(rec.id);
    setListError('');
    try {
      await deleteDoc(doc(db, 'serviceRecords', rec.id));
      setRecords((prev) => prev.filter((r) => r.id !== rec.id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      setListError('Could not delete that job. Please try again.');
    } finally { setDeletingId(null); }
  };

  const handleDeleteService = async (svc: Service) => {
    setListError('');
    try {
      await deleteDoc(doc(db, 'services', svc.id));
      setServices((prev) => prev.filter((s) => s.id !== svc.id));
      setConfirmDeleteServiceId(null);
    } catch (e) {
      console.error(e);
      setListError('Could not remove that service. Please try again.');
    }
  };

  /* ── stats ── */
  const stats = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const prev  = new Date(start); prev.setDate(prev.getDate() - 1);

    const todayList = records.filter((r) => r.recordedAt >= start);
    const yList     = records.filter((r) => r.recordedAt >= prev && r.recordedAt < start);

    const todayRevenue = sumPrice(todayList);
    const yRevenue     = sumPrice(yList);
    const todayCost    = sumCost(todayList);
    const allRevenue   = sumPrice(records);

    return {
      todayList, todayRevenue, todayCost,
      todayKept: todayRevenue - todayCost,
      delta: yRevenue > 0 ? Math.round(((todayRevenue - yRevenue) / yRevenue) * 100) : null,
      allRevenue,
      allJobs: records.length,
      avgJob:  records.length ? allRevenue / records.length : 0,
    };
  }, [records]);

  const filtered    = range === 'today' ? stats.todayList : records;
  const shown       = filtered.slice(0, visible);
  const remaining   = filtered.length - shown.length;
  const filteredSum = sumPrice(filtered);

  const whenLabel = (d: Date) =>
    range === 'today' ? timeOf(d) : `${d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })} · ${timeOf(d)}`;

  const renderDelete = (rec: ServiceRecord) => {
    if (!isAdmin || !rec.id) return null;
    if (confirmDeleteId === rec.id) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Delete job?</span>
          <button onClick={() => handleDeleteRecord(rec)} disabled={deletingId === rec.id} aria-label="Confirm delete"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-50">
            {deletingId === rec.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button onClick={() => setConfirmDeleteId(null)} disabled={deletingId === rec.id} aria-label="Cancel"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }
    return (
      <button onClick={() => setConfirmDeleteId(rec.id!)} aria-label="Delete job"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
        <Trash2 className="h-4 w-4" />
      </button>
    );
  };

  /* ─────────────────────── render ─────────────────────── */
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] space-y-4 px-3 py-4 sm:px-4 lg:px-6">

        {/* Header line */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: LEAF }} />
            <span className="truncate font-semibold">{activeBusiness?.name ?? 'No business selected'}</span>
            <span className="hidden text-muted-foreground sm:inline">
              · {stats.todayList.length} job{stats.todayList.length !== 1 ? 's' : ''} today
            </span>
          </div>
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: LIME }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: LEAF }} />
            </span>
            Live
          </span>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid gap-4 lg:grid-cols-3">

          <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm sm:p-6 lg:col-span-2"
            style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)), hsl(var(--brand-forest)))' }}>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: LIME }} />

            <div className="relative flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Today’s revenue</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint(LIME, 18) }}>
                <Wallet className="h-[18px] w-[18px]" style={{ color: LIME }} />
              </span>
            </div>

            <div className="relative mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
              <p className="font-heading text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                <span className="mr-0.5 text-2xl text-white/60 sm:text-3xl">₵</span>
                {stats.todayRevenue.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
              </p>
              {stats.delta !== null ? (
                <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  stats.delta >= 0 ? 'bg-[hsl(var(--brand-lime)/0.18)] text-[hsl(var(--brand-lime))]' : 'bg-red-500/20 text-red-300'}`}>
                  {stats.delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {Math.abs(stats.delta)}% vs yesterday
                </span>
              ) : (
                <span className="mb-1.5 text-xs text-white/50">No jobs yesterday to compare</span>
              )}
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              {[
                { label: 'Jobs',       value: stats.todayList.length.toLocaleString() },
                { label: 'Parts cost', value: fmt(stats.todayCost) },
                { label: 'You kept',   value: fmt(stats.todayKept) },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <p className="text-[11px] text-white/55">{s.label}</p>
                  <p className="mt-0.5 truncate font-heading text-lg font-semibold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">All time</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                style={{ background: tint(LIME, 18) }}>
                <Receipt className="h-[18px] w-[18px]" />
              </span>
            </div>
            <p className="mt-3 font-heading text-3xl font-semibold tabular-nums tracking-tight">{fmt(stats.allRevenue)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Total service revenue</p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Jobs</p>
                <p className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{stats.allJobs.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Average job</p>
                <p className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{fmt(stats.avgJob)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-5 lg:items-start">

          {/* Form + catalog */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl border border-border bg-card shadow-sm">
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                  style={{ background: tint(LIME, 18) }}>
                  <Wrench className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-[15px] font-semibold leading-tight">Log a service</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pick the job, confirm the price, done.</p>
                </div>
              </header>
              <div className="p-4">
                <ServiceForm
                  services={services}
                  submitting={submitting}
                  successMessage={successMsg}
                  errorMessage={submitError}
                  onSubmit={handleSubmit}
                />
              </div>
            </section>

            {/* Service catalog: collapsed by default so it never buries the job history on mobile */}
            {services.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <button type="button" onClick={() => setShowCatalog((v) => !v)} aria-expanded={showCatalog}
                  className="flex min-h-[3.5rem] w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                      style={{ background: tint(LIME, 18) }}>
                      <ListChecks className="h-[18px] w-[18px]" />
                    </span>
                    <span>
                      <span className="block font-heading text-[15px] font-semibold leading-tight">Your services</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{services.length} saved</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${showCatalog ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {showCatalog && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="max-h-80 divide-y divide-border overflow-y-auto overscroll-contain border-t border-border">
                        {services.map((svc) => (
                          <div key={svc.id} className="flex items-center gap-2 px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold">{svc.name}</p>
                              <p className="text-[11px] text-muted-foreground">{svc.category || 'Uncategorized'} · {fmt(svc.defaultPrice)}</p>
                            </div>
                            {confirmDeleteServiceId === svc.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium text-muted-foreground">Remove?</span>
                                <button onClick={() => handleDeleteService(svc)} aria-label="Confirm remove"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setConfirmDeleteServiceId(null)} aria-label="Cancel"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:text-foreground">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteServiceId(svc.id)} aria-label={`Remove ${svc.name}`}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
                        Removing a service never touches past jobs. They stay in your history.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </motion.div>

          {/* Job history */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-3">
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                    style={{ background: tint(LIME, 18) }}>
                    <Receipt className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-[15px] font-semibold leading-tight">Job history</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {range === 'today' ? 'Everything done today' : 'Every job, newest first'}
                    </p>
                  </div>
                </div>

                <div role="tablist" aria-label="Job range" className="inline-flex rounded-full border border-border bg-muted/50 p-0.5">
                  {([['today', 'Today', stats.todayList.length], ['all', 'All', records.length]] as const).map(([key, label, n]) => (
                    <button key={key} role="tab" aria-selected={range === key}
                      onClick={() => { setRange(key); setVisible(PAGE_SIZE); }}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-all ${
                        range === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {label}
                      <span className="text-[11px] tabular-nums text-muted-foreground">{n}</span>
                    </button>
                  ))}
                </div>
              </header>

              <AnimatePresence>
                {listError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
                      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 flex-shrink-0" />{listError}</span>
                      <button onClick={() => setListError('')} aria-label="Dismiss" className="p-1 hover:opacity-70"><X className="h-4 w-4" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loading ? (
                <div className="divide-y divide-border" aria-busy="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : !activeBusiness ? (
                <EmptyState icon={Wrench} title="No business selected" body="Pick a business from the sidebar to see its jobs." />
              ) : shown.length === 0 ? (
                range === 'today' && records.length > 0 ? (
                  <EmptyState icon={Wrench} title="No jobs yet today" body="The first job of the day will show up here."
                    action={{ label: 'View all jobs', onClick: () => setRange('all') }} />
                ) : (
                  <EmptyState icon={Wrench} title="No services logged yet" body="Add your first service type, then log a job to get started." />
                )
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {shown.map((rec) => (
                      <div key={rec.id} className="px-4 py-3.5 transition-colors hover:bg-muted/30">
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                            style={{ background: tint(LIME, 18) }}>
                            <Wrench className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="truncate text-sm font-semibold">{rec.serviceName}</p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {rec.category || 'Uncategorized'}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {rec.customerName || 'Walk-in'}{rec.customerPhone ? ` · ${rec.customerPhone}` : ''}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {whenLabel(rec.recordedAt)} · by {rec.recordedBy}
                            </p>
                            {rec.notes && <p className="mt-1 truncate text-[11px] italic text-muted-foreground">{rec.notes}</p>}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className={`text-sm font-semibold tabular-nums ${MONEY}`}>{fmt(rec.price)}</p>
                            {rec.cost > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{fmt(rec.cost)} parts</p>}
                          </div>
                        </div>
                        {isAdmin && <div className="mt-2 flex justify-end">{renderDelete(rec)}</div>}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border">
                    {remaining > 0 && (
                      <div className="border-b border-border px-4 py-3">
                        <button onClick={() => setVisible((v) => v + PAGE_SIZE)}
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--brand-leaf))] hover:text-foreground">
                          <ChevronDown className="h-4 w-4" />
                          Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} remaining
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        Showing <span className="font-semibold text-foreground">{shown.length}</span> of{' '}
                        <span className="font-semibold text-foreground">{filtered.length}</span>
                      </span>
                      <span className={`font-heading text-base font-semibold tabular-nums ${MONEY}`}>{fmt(filteredSum)}</span>
                    </div>
                  </div>
                </>
              )}
            </section>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── empty state ───────────────────────── */

function EmptyState({ icon: Icon, title, body, action }: {
  icon: React.ElementType; title: string; body: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
        style={{ background: tint(LIME, 18) }}>
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-heading text-[15px] font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      {action && (
        <button onClick={action.onClick}
          className="mt-1 inline-flex h-10 items-center rounded-xl border border-border bg-background px-4 text-[13px] font-medium transition-colors hover:bg-accent">
          {action.label}
        </button>
      )}
    </div>
  );
}