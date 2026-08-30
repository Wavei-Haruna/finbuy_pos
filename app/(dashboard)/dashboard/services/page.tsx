'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  query, where,
} from 'firebase/firestore';
import { Service, ServiceRecord, ServiceCategory, SERVICE_CATEGORY_LABELS } from '@/lib/types';
import { ServiceForm } from './components/ServiceForm';
import {
  Smartphone, Loader2, TrendingUp, Wrench, Trash2, X, Check,
  Calendar, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const genReceiptNo = () => `SRV-${Date.now().toString(36).toUpperCase()}`;

export default function ServicesPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();
  const isAdmin = !!user; // same convention as Sales: staff sessions have no `user`

  const [services, setServices] = useState<Service[]>([]);
  const [records, setRecords]   = useState<ServiceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);

  useEffect(() => { if (activeBusiness) fetchData(); else setLoading(false); }, [activeBusiness]);

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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (data: {
    serviceId: string | null;
    newService?: { name: string; category: ServiceCategory; defaultPrice: number };
    price: number; cost: number;
    customerName: string; customerPhone: string; notes: string;
  }) => {
    if (!activeBusiness) return;
    setSubmitting(true);
    try {
      let serviceId = data.serviceId;
      let serviceName = services.find((s) => s.id === serviceId)?.name || '';
      let category: ServiceCategory = services.find((s) => s.id === serviceId)?.category || 'other';

      // Brand-new service type — save it to the catalog first so it's reusable next time.
      if (!serviceId && data.newService) {
        const svcRef = await addDoc(collection(db, 'services'), {
          businessId: activeBusiness.id,
          name: data.newService.name,
          category: data.newService.category,
          defaultPrice: data.newService.defaultPrice,
          createdAt: new Date(),
        });
        serviceId = svcRef.id;
        serviceName = data.newService.name;
        category = data.newService.category;
        setServices((prev) => [...prev, {
          id: svcRef.id, businessId: activeBusiness.id, name: serviceName, category, defaultPrice: data.newService!.defaultPrice, createdAt: new Date(),
        }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (!serviceId) return;

      const recRef = await addDoc(collection(db, 'serviceRecords'), {
        serviceId, serviceName, category,
        businessId: activeBusiness.id,
        price: data.price, cost: data.cost,
        customerName: data.customerName, customerPhone: data.customerPhone,
        recordedBy: user?.name || 'Staff',
        recordedAt: new Date(),
        notes: data.notes,
        receiptNo: genReceiptNo(),
      });
      setRecords((prev) => [{
        id: recRef.id, serviceId, serviceName, category, businessId: activeBusiness.id,
        price: data.price, cost: data.cost, customerName: data.customerName, customerPhone: data.customerPhone,
        recordedBy: user?.name || 'Staff', recordedAt: new Date(), notes: data.notes, receiptNo: '',
      }, ...prev]);
      setSuccessMsg('Service logged!');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (e) {
      console.error(e);
      alert('Failed to log service');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (rec: ServiceRecord) => {
    if (!rec.id) return;
    setDeletingId(rec.id);
    try {
      await deleteDoc(doc(db, 'serviceRecords', rec.id));
      setRecords((prev) => prev.filter((r) => r.id !== rec.id));
      setConfirmDeleteId(null);
    } catch (e) { console.error(e); alert('Failed to delete'); }
    finally { setDeletingId(null); }
  };

  const handleDeleteService = async (svc: Service) => {
    try {
      await deleteDoc(doc(db, 'services', svc.id));
      setServices((prev) => prev.filter((s) => s.id !== svc.id));
      setConfirmDeleteServiceId(null);
    } catch (e) { console.error(e); alert('Failed to remove service'); }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayRecords = records.filter((r) => r.recordedAt >= today);
  const todayRevenue  = todayRecords.reduce((s, r) => s + r.price, 0);
  const totalJobs     = records.length;
  const allTimeRevenue = records.reduce((s, r) => s + r.price, 0);

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-transparent" />

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.15em] mb-1">
            Services · <span className="text-gray-400 font-normal">{activeBusiness?.name ?? '—'}</span>
          </p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Services<span className="text-gray-300 dark:text-gray-600">.</span>
          </h1>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex flex-wrap gap-3">
          {[
            { label: "Today's Jobs",    value: todayRecords.length,                     icon: Wrench,      color: 'text-indigo-500', bg: 'bg-indigo-500/8 border-indigo-500/15' },
            { label: "Today's Revenue", value: `₵${todayRevenue.toLocaleString()}`,      icon: TrendingUp,  color: 'text-green-500',  bg: 'bg-green-500/8 border-green-500/15'  },
            { label: 'Total Jobs',      value: totalJobs,                                icon: Smartphone,  color: 'text-purple-500', bg: 'bg-purple-500/8 border-purple-500/15'},
            { label: 'All-time Revenue',value: `₵${allTimeRevenue.toLocaleString()}`,    icon: Sparkles,    color: 'text-amber-500',  bg: 'bg-amber-500/8 border-amber-500/15' },
          ].map((s) => (
            <div key={s.label} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${s.bg} bg-white dark:bg-gray-900`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">{s.label}</p>
                <p className="text-sm font-black text-gray-900 dark:text-white leading-none">{s.value}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-5">

          {/* Form + catalog — left */}
          <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sticky top-4">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <span className="w-1 h-5 bg-indigo-500 rounded-full" />
                <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">Log a Service</h2>
              </div>
              <div className="p-4">
                <ServiceForm
                  services={services}
                  submitting={submitting}
                  successMessage={successMsg}
                  onSubmit={handleSubmit}
                />
              </div>
            </div>

            {/* Saved service catalog */}
            {services.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Your Services</h3>
                <div className="space-y-1.5">
                  {services.map((svc) => (
                    <div key={svc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{svc.name}</p>
                        <p className="text-[10px] text-gray-400">{SERVICE_CATEGORY_LABELS[svc.category]} · ₵{svc.defaultPrice.toLocaleString()}</p>
                      </div>
                      {confirmDeleteServiceId === svc.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeleteService(svc)} className="w-6 h-6 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setConfirmDeleteServiceId(null)} className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteServiceId(svc.id)} className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Job history — right */}
          <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-5 bg-yellow-400 rounded-full" />
                  <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">Job History</h2>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {records.length} total
                </span>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                  <p className="text-sm text-gray-400">Loading…</p>
                </div>
              ) : !activeBusiness ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Smartphone className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-semibold text-gray-400">No business selected</p>
                </div>
              ) : records.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
                  <Wrench className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-semibold text-gray-400">No services logged yet</p>
                  <p className="text-xs text-gray-400">Log your first flash, unlock, or repair to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-900 max-h-[720px] overflow-y-auto">
                  {records.map((rec, i) => (
                    <motion.div key={rec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{rec.serviceName}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                            {SERVICE_CATEGORY_LABELS[rec.category]}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {rec.customerName || 'Walk-in'}{rec.customerPhone ? ` · ${rec.customerPhone}` : ''}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {rec.recordedAt.toLocaleDateString()} {rec.recordedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · by '}{rec.recordedBy}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <p className="font-black text-green-600 dark:text-green-400 text-sm">₵{rec.price.toLocaleString()}</p>
                        {rec.cost > 0 && <p className="text-[10px] text-gray-400">₵{rec.cost.toLocaleString()} parts</p>}
                        {isAdmin && (
                          confirmDeleteId === rec.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeleteRecord(rec)} disabled={deletingId === rec.id}
                                className="w-6 h-6 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center disabled:opacity-50">
                                {deletingId === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(rec.id!)} className="text-gray-300 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}