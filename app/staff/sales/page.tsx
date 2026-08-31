'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, doc, writeBatch,
  query, where, orderBy,
} from 'firebase/firestore';
import { getStaffSession, scheduleStaffLogout, StaffSession } from '@/lib/staff-auth';
import { Product, SalesRecord } from '@/lib/types';
import { ReceiptModal } from '@/app/(dashboard)/dashboard/sales/components/ReceiptModal';
import {
  ShoppingCart, Calendar, TrendingUp,
  Receipt, Package, Loader2, ChevronDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SaleForm } from '@/app/(dashboard)/dashboard/sales/components/salesForm';

interface SaleWithProduct extends SalesRecord { productName: string; }

const genReceiptNo = () => `RCP-${Date.now().toString(36).toUpperCase()}`;
// Admin phone fetched dynamically from business owner's profile

export default function StaffSalesPage() {
  const router = useRouter();

  const [session,    setSession]    = useState<StaffSession | null>(null);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [sales,       setSales]       = useState<SaleWithProduct[]>([]);
  const [allSalesData, setAllSalesData] = useState<SaleWithProduct[]>([]);
  const [lastDoc,      setLastDoc]      = useState<DocumentSnapshot | null>(null);
  const [hasMore,      setHasMore]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [sendingSMS,  setSendingSMS]  = useState(false);
  const [smsSent,     setSmsSent]     = useState(false);

  useEffect(() => {
    const s = getStaffSession();
    if (!s) { router.replace('/login'); return; }
    setSession(s);
    fetchData(s);

    // Auto-logout at 11pm
    const cleanup = scheduleStaffLogout(() => {
      router.replace('/login');
    });
    return cleanup;
  }, []);

  const fetchData = async (s: StaffSession) => {
    setLoading(true);
    try {
      const [prodSnap, salesSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('businessId', '==', s.businessId))),
        getDocs(query(collection(db, 'sales'), where('businessId', '==', s.businessId), orderBy('recordedAt', 'desc'))),
      ]);
      const prods = prodSnap.docs.map((d) => ({
        id: d.id, ...d.data(),
        dateAdded:   d.data().dateAdded?.toDate()   || new Date(),
        lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
      })) as Product[];
      setProducts(prods);
      // Map all docs — salesSnap is already ordered desc, no limit
      const allMapped = salesSnap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, productName: prods.find((p) => p.id === data.productId)?.name || 'Unknown', recordedAt: data.recordedAt?.toDate() || new Date() };
      }) as SaleWithProduct[];

      setAllSalesData(allMapped);               // all records → stats
      setSales(allMapped.slice(0, 50));          // first 50 → table display
      setLastDoc(salesSnap.docs[49] ?? salesSnap.docs[salesSnap.docs.length - 1] ?? null);
      setHasMore(allMapped.length > 50);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };


  const loadMore = () => {
    // All data is already in memory — just show the next 50 from allSalesData
    const currentCount = sales.length;
    const nextSlice    = allSalesData.slice(currentCount, currentCount + 50);
    if (nextSlice.length === 0) { setHasMore(false); return; }
    setSales((prev) => [...prev, ...nextSlice]);
    setHasMore(currentCount + nextSlice.length < allSalesData.length);
  };;

  const handleSendSMS = async (data: any) => {
    setSendingSMS(true);
    try {
      // Fetch admin phone from business owner's profile at send time
      let adminPhone = process.env.NEXT_PUBLIC_ADMIN_PHONE || '';
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const bizDoc = await getDoc(doc(db, 'businesses', data.businessId || session!.businessId));
        if (bizDoc.exists() && bizDoc.data().userId) {
          const userDoc = await getDoc(doc(db, 'users', bizDoc.data().userId));
          if (userDoc.exists()) adminPhone = userDoc.data().phone || adminPhone;
        }
      } catch {}

      await fetch('/api/send-sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName:  data.customerName,
          customerPhone: data.customerPhone,
          adminPhone,
          items:         data.items.map((i: any) => ({
            name:       i.productName,
            quantity:   i.quantity,
            unitPrice:  i.unitPrice,
            totalPrice: i.totalPrice,
          })),
          totalAmount:  data.items.reduce((s: number, i: any) => s + i.totalPrice, 0),
          businessName: data.businessName,
          businessCode: data.businessCode,
          receiptNo:    data.receiptNo,
          recordedBy:   data.recordedBy,
          date:         data.date,
          notes:        data.notes,
        }),
      });
      setSmsSent(true);
    } catch (e) { console.error(e); }
    finally { setSendingSMS(false); }
  };

  const handleSubmit = async (cart: CartItem[], customer: { name: string; phone: string; notes: string }, sendSMS: boolean) => {
    if (!session || !cart.length) return;
    setSubmitting(true);
    try {
      const receiptNo = genReceiptNo();
      const batch     = writeBatch(db);
      for (const item of cart) {
        batch.set(doc(collection(db, 'sales')), {
          productId: item.productId, businessId: session.businessId, quantity: item.quantity,
          price: item.unitPrice, totalAmount: item.totalPrice, customerName: customer.name,
          customerPhone: customer.phone || '', recordedBy: `Staff (${session.businessCode})`,
          recordedAt: new Date(), notes: customer.notes, receiptNo,
        });
        const prod = products.find((p) => p.id === item.productId);
        if (prod) batch.update(doc(db, 'products', item.productId), { quantity: Math.max(0, prod.quantity - item.quantity), lastUpdated: new Date() });
      }
      await batch.commit();

      const receipt = { items: cart, customerName: customer.name, customerPhone: customer.phone || '', notes: customer.notes, businessName: session.businessName, businessCode: session.businessCode, recordedBy: `Staff (${session.businessCode})`, receiptNo, date: new Date() };
      setReceiptData(receipt);
      setSmsSent(false);
      if (sendSMS) handleSendSMS(receipt);
      setReceiptOpen(true);
      setSuccessMsg('Sale recorded!');
      setTimeout(() => setSuccessMsg(''), 3000);
      setLastDoc(null); setHasMore(false);
      fetchData(session);
    } catch (err: any) {
      alert(err.message || 'Failed to record sale');
    } finally { setSubmitting(false); }
  };

  const today        = new Date(); today.setHours(0, 0, 0, 0);
  const todaySales   = allSalesData.filter((s) => s.recordedAt >= today);
  const todayTotal   = todaySales.reduce((s, r) => s + r.totalAmount, 0);
  const totalSales   = allSalesData.length;
  const totalRevenue = allSalesData.reduce((s, r) => s + r.totalAmount, 0);

  if (!session) return null;

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto space-y-5 pb-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-bold text-green-500 uppercase tracking-[0.15em] mb-1">
          Sales · <span className="text-gray-400 font-normal">{session.businessName}</span>
        </p>
        <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Record Sale<span className="text-gray-300 dark:text-gray-600">.</span>
        </h1>
      </motion.div>

      {/* Stat pills */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-3">
        {[
          { label: "Today's Sales",    value: todaySales.length,                   icon: ShoppingCart, color: 'text-green-500',  bg: 'bg-green-500/8  border-green-500/15'  },
          { label: "Today's Revenue",  value: `₵${todayTotal.toLocaleString()}`,   icon: TrendingUp,   color: 'text-blue-500',   bg: 'bg-blue-500/8   border-blue-500/15'   },
          { label: 'Total Sales',      value: totalSales,                           icon: Package,      color: 'text-purple-500', bg: 'bg-purple-500/8 border-purple-500/15' },
          { label: 'All-time Revenue', value: `₵${totalRevenue.toLocaleString()}`, icon: Receipt,      color: 'text-amber-500',  bg: 'bg-amber-500/8  border-amber-500/15'  },
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

      {/* Main grid */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* SaleForm */}
        <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sticky top-4">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <span className="w-1 h-5 bg-green-500 rounded-full" />
              <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">New Sale</h2>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-green-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                LIVE
              </div>
            </div>
            <div className="p-4">
              <SaleForm products={products} submitting={submitting} successMessage={successMsg} onSubmit={handleSubmit} />
            </div>
          </div>
        </motion.div>

        {/* Recent sales */}
        <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-3">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-yellow-400 rounded-full" />
                <h2 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">Recent Sales</h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">{allSalesData.length} total · showing {sales.length}</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
              </div>
            ) : sales.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
                <Receipt className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm font-semibold text-gray-400">No sales yet</p>
                <p className="text-xs text-gray-400">Record your first sale to get started</p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                        {['', 'Product', 'Customer', 'Qty', 'Total', 'Time'].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
                      {sales.map((sale, i) => (
                        <motion.tr key={sale.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-3 w-12">
                            {(() => { const img = products.find((p) => p.id === sale.productId)?.imageUrl; return img
                              ? <img src={img} alt={sale.productName} className="w-8 h-8 rounded-lg object-cover border border-gray-100 dark:border-gray-800" />
                              : <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Package className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" /></div>; })()}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white text-xs">{sale.productName}</td>
                          <td className="py-3 px-4">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{sale.customerName}</p>
                            <p className="text-[10px] text-gray-400">{sale.customerPhone}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black">{sale.quantity}</span>
                          </td>
                          <td className="py-3 px-4 font-black text-green-600 dark:text-green-400 text-xs">₵{sale.totalAmount.toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                              <Calendar className="w-3 h-3" />
                              {sale.recordedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {sales.map((sale, i) => (
                    <motion.div key={sale.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{sale.productName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sale.customerName} · {sale.customerPhone}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {sale.recordedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-auto">
                        <p className="font-black text-green-600 dark:text-green-400 text-sm">₵{sale.totalAmount.toLocaleString()}</p>
                        <span className="text-[10px] text-blue-500 font-bold">{sale.quantity} units</span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800">
                  {hasMore && (
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                      <button
                        onClick={loadMore}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <><ChevronDown className="w-3.5 h-3.5" /> Load next 50 records</>
                      </button>
                    </div>
                  )}
                  <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/60 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Showing <span className="font-bold text-gray-700 dark:text-gray-300">{sales.length}</span> of <span className="font-bold text-gray-700 dark:text-gray-300">{allSalesData.length}</span> records
                    </span>
                    <span className="text-sm font-black text-green-600 dark:text-green-400">
                      ₵{allSalesData.reduce((s, r) => s + r.totalAmount, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <ReceiptModal open={receiptOpen} data={receiptData} onClose={() => setReceiptOpen(false)}
        onSendSMS={handleSendSMS} sendingSMS={sendingSMS} smsSent={smsSent} />
    </div>
  );
}