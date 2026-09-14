'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where, doc,
  runTransaction, deleteDoc, increment,
} from 'firebase/firestore';
import { Product, DamageRecord } from '@/lib/types';
import { DamageForm } from './DamageForm';
import {
  PackageX, Loader2, Trash2, X, Check, ShieldAlert, Banknote, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const fmt = (v: number) => `₵${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function DamagesPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();

  // Same restriction as Expenses — this affects stock + shows cost data.
  const canView = !!user && (user.role === 'admin' || user.role === 'manager');

  const [products, setProducts] = useState<Product[]>([]);
  const [damages, setDamages]   = useState<DamageRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBusiness && canView) fetchAll();
    else setLoading(false);
  }, [activeBusiness, canView]);

  const fetchAll = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const [productsSnap, damagesSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))),
        getDocs(query(collection(db, 'damages'), where('businessId', '==', activeBusiness.id))),
      ]);

      const productsData = productsSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        dateAdded: d.data().dateAdded?.toDate() || new Date(),
        lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
      })) as Product[];

      const damagesData = damagesSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        reportedAt: d.data().reportedAt?.toDate() || new Date(),
      })) as DamageRecord[];
      damagesData.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());

      setProducts(productsData);
      setDamages(damagesData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const totalLoss = useMemo(() => damages.reduce((sum, d) => sum + d.totalCost, 0), [damages]);
  const totalUnitsDamaged = useMemo(() => damages.reduce((sum, d) => sum + d.quantity, 0), [damages]);

  const handleSubmit = async (data: { productId: string; quantity: number; reason: string; notes: string }) => {
    if (!activeBusiness) return;
    setSubmitting(true);
    try {
      const productRef = doc(db, 'products', data.productId);
      const damageRef  = doc(collection(db, 'damages'));
      const expenseRef = doc(collection(db, 'expenses'));

      const damageDoc = await runTransaction(db, async (tx) => {
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists()) throw new Error('Product no longer exists');
        const product = productSnap.data() as Product;

        if (data.quantity > product.quantity) {
          throw new Error(`Only ${product.quantity} in stock — someone may have sold or damaged units since you opened this form`);
        }

        const unitCost = product.costPrice || 0;
        const totalCost = unitCost * data.quantity;
        const now = new Date();

        // 1. Decrement stock — same mechanism sales use.
        tx.update(productRef, { quantity: increment(-data.quantity), lastUpdated: now });

        // 2. Damage record (snapshots product name/sku so it still reads
        //    correctly even if the product is later renamed or deleted).
        const damagePayload = {
          businessId:  activeBusiness.id,
          productId:   data.productId,
          productName: product.name,
          productSku:  product.sku,
          quantity:    data.quantity,
          unitCost,
          totalCost,
          reason:      data.reason,
          expenseId:   expenseRef.id,
          reportedBy:  user?.name || 'Admin',
          reportedAt:  now,
          ...(data.notes ? { notes: data.notes } : {}),
        };
        tx.set(damageRef, damagePayload);

        // 3. Linked expense — hits net profit via the normal Expenses flow.
        tx.set(expenseRef, {
          businessId:  activeBusiness.id,
          category:    'damages',
          description: `Damage: ${product.name} x${data.quantity} (${data.reason})`,
          amount:      totalCost,
          frequency:   'one-time',
          startDate:   now,
          endDate:     null,
          recordedBy:  user?.name || 'Admin',
          createdAt:   now,
          linkedDamageId: damageRef.id,
        });

        return { id: damageRef.id, ...damagePayload };
      });

      setDamages((prev) => [damageDoc as DamageRecord, ...prev]);
      setProducts((prev) => prev.map((p) => p.id === data.productId ? { ...p, quantity: p.quantity - data.quantity } : p));
      setSuccessMsg('Damage recorded — stock and expenses updated!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to record damage');
    } finally {
      setSubmitting(false);
    }
  };

  // Deleting a damage reverses both sides: restores stock, removes the
  // linked expense. There's no "edit" — a damage is a physical fact, so if
  // the quantity or product was wrong, delete it and record a fresh one.
  const handleDelete = async (dmg: DamageRecord) => {
    setDeletingId(dmg.id);
    try {
      const productRef = doc(db, 'products', dmg.productId);
      const damageRef  = doc(db, 'damages', dmg.id);
      const expenseRef = doc(db, 'expenses', dmg.expenseId);

      await runTransaction(db, async (tx) => {
        const productSnap = await tx.get(productRef);
        if (productSnap.exists()) {
          tx.update(productRef, { quantity: increment(dmg.quantity), lastUpdated: new Date() });
        }
        tx.delete(damageRef);
        tx.delete(expenseRef);
      });

      setDamages((prev) => prev.filter((d) => d.id !== dmg.id));
      setProducts((prev) => prev.map((p) => p.id === dmg.productId ? { ...p, quantity: p.quantity + dmg.quantity } : p));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to delete — the linked expense may already be gone. Try refreshing.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!canView) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500">Restricted</p>
          <p className="text-xs text-gray-400 mt-1">Damages affect stock and cost data — only visible to admins and managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-orange-500 via-orange-400 to-transparent" />

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-bold text-orange-500 uppercase tracking-[0.15em] mb-1">
            Damages · <span className="text-gray-400 font-normal">{activeBusiness?.name ?? '—'}</span>
          </p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Damages<span className="text-gray-300 dark:text-gray-600">.</span>
          </h1>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex flex-wrap gap-3">
          {[
            { label: 'Total Loss (all time)', value: fmt(totalLoss),        icon: Banknote, color: 'text-orange-500', bg: 'bg-orange-500/8 border-orange-500/15' },
            { label: 'Units Damaged',          value: totalUnitsDamaged,     icon: Hash,     color: 'text-red-500',    bg: 'bg-red-500/8 border-red-500/15' },
            { label: 'Total Entries',          value: damages.length,        icon: PackageX, color: 'text-gray-500',   bg: 'bg-gray-500/8 border-gray-500/15' },
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

          {/* Form — left */}
          <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sticky top-4">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <span className="w-1 h-5 bg-orange-500 rounded-full" />
                <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">Report Damage</h2>
              </div>
              <div className="p-4">
                <DamageForm
                  products={products}
                  submitting={submitting}
                  successMessage={successMsg}
                  onSubmit={handleSubmit}
                />
              </div>
            </div>
          </motion.div>

          {/* Damage list — right */}
          <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-5 bg-yellow-400 rounded-full" />
                  <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">All Damages</h2>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {damages.length} total
                </span>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
                  <p className="text-sm text-gray-400">Loading…</p>
                </div>
              ) : !activeBusiness ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <PackageX className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-semibold text-gray-400">No business selected</p>
                </div>
              ) : damages.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
                  <PackageX className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-semibold text-gray-400">No damages recorded yet</p>
                  <p className="text-xs text-gray-400">Broken, expired, or lost stock will show up here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-900 max-h-[720px] overflow-y-auto">
                  {damages.map((dmg, i) => (
                    <motion.div
                      key={dmg.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                        <PackageX className="w-4 h-4 text-orange-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{dmg.productName}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                            {dmg.quantity} unit{dmg.quantity !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            {dmg.reason}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {dmg.reportedAt.toLocaleDateString()} · by {dmg.reportedBy}
                          {dmg.notes ? ` · ${dmg.notes}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <p className="font-black text-orange-500 text-sm">{fmt(dmg.totalCost)}</p>
                        <div className="flex items-center gap-1">
                          {confirmDeleteId === dmg.id ? (
                            <>
                              <button
                                onClick={() => handleDelete(dmg)}
                                disabled={deletingId === dmg.id}
                                className="w-6 h-6 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center disabled:opacity-50"
                              >
                                {deletingId === dmg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(dmg.id)}
                              className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                              title="Delete (restores stock, removes linked expense)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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