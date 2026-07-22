'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { Product } from '@/lib/types';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Edit2, Search, Package, AlertTriangle,
  Loader2, Barcode, TrendingUp, Layers, Filter, X,
  Camera, ScanLine, ZoomIn,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_META: Record<string, { label: string; color: string; dot: string }> = {
  'home-appliances':          { label: 'Home Appliances', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',      dot: 'bg-blue-500'   },
  'sneakers':                  { label: 'Sneakers',        color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  'phone-laptop-accessories': { label: 'Tech Accessories', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',dot: 'bg-orange-500' },
  'clothing':                  { label: 'Clothing',        color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',      dot: 'bg-pink-500'   },
  'food-beverages':            { label: 'Food & Beverages',color: 'bg-green-500/10 text-green-600 dark:text-green-400',   dot: 'bg-green-500'  },
  'other':                     { label: 'Other',           color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',      dot: 'bg-gray-400'   },
};
const getCat = (cat: string) =>
  CATEGORY_META[cat] ?? { label: cat, color: 'bg-gray-500/10 text-gray-500', dot: 'bg-gray-400' };

export default function ProductsPage() {
  const { user }           = useAuth();
  const { activeBusiness } = useBusiness();
  const router             = useRouter();

  const [products, setProducts]             = useState<Product[]>([]);
  const [filtered, setFiltered]             = useState<Product[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchTerm, setSearchTerm]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [toDelete, setToDelete]             = useState<Product | null>(null);
  const [isDeleting, setIsDeleting]         = useState(false);
  const [scanFeedback, setScanFeedback]     = useState('');

  // ── Barcode scanner for search ──────────────────────────────────────────
  const handleScan = useCallback((code: string) => {
    const normalised = code.trim().toUpperCase();
    setSearchTerm(normalised);
    setFiltered((prev) => {
      // apply against current products
      return prev; // will be updated via useEffect below
    });
    setScanFeedback(`Scanned: ${normalised}`);
    setTimeout(() => setScanFeedback(''), 3000);
    stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { scannerState, cameraError, videoRef, startCamera, stopCamera } =
    useBarcodeScanner({ onScan: handleScan, disableExternal: true });

  const scanning    = scannerState === 'starting' || scannerState === 'active';
  const cameraReady = scannerState === 'active';

  // re-apply filters whenever searchTerm changes (including after scan)
  useEffect(() => {
    applyFilters(products, searchTerm, categoryFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  useEffect(() => { if (activeBusiness) fetchProducts(); }, [activeBusiness]);

  const fetchProducts = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'products'), where('businessId', '==', activeBusiness.id))
      );
      const data = snap.docs.map((d) => ({
        id: d.id, ...d.data(),
        dateAdded:   d.data().dateAdded?.toDate()   || new Date(),
        lastUpdated: d.data().lastUpdated?.toDate() || new Date(),
      })) as Product[];
      setProducts(data);
      applyFilters(data, searchTerm, categoryFilter);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const applyFilters = (items: Product[], search: string, cat: string) => {
    let out = items;
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s)
      );
    }
    if (cat !== 'all') out = out.filter((p) => p.category === cat);
    setFiltered(out);
  };

  const onSearch = (v: string) => { setSearchTerm(v); applyFilters(products, v, categoryFilter); };
  const onCat    = (v: string) => { setCategoryFilter(v); applyFilters(products, searchTerm, v); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', toDelete.id));
      setDeleteOpen(false); setToDelete(null); fetchProducts();
    } catch { alert('Failed to delete.'); }
    finally { setIsDeleting(false); }
  };

  const calcProductValue = (p: any) => {
    const piecePrice = p.piecePrice ?? p.sellingPrice ?? 0;
    if (p.boxEnabled && p.boxPrice && p.boxQty && p.boxQty > 1) {
      const fullBoxes     = Math.floor(p.quantity / p.boxQty);
      const remainingPcs  = p.quantity % p.boxQty;
      return fullBoxes * p.boxPrice + remainingPcs * piecePrice;
    }
    return piecePrice * p.quantity;
  };
  const totalValue    = products.reduce((s, p) => s + calcProductValue(p), 0);
  const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= (p.lowStockAlert ?? 5)).length;
  const outOfStock    = products.filter((p) => p.quantity === 0).length;
  const categories    = [...new Set(products.map((p) => p.category))];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent" />

      {/* ── SCANNER OVERLAY ── */}
      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }} className="w-full max-w-sm space-y-4">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <ScanLine className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-sm">Scan to Search</h3>
                    <p className="text-gray-500 text-xs">Point at a product barcode</p>
                  </div>
                </div>
                <button onClick={stopCamera}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950">
                    <Loader2 className="w-7 h-7 text-green-400 animate-spin mb-2" />
                    <p className="text-gray-400 text-xs">Starting camera…</p>
                  </div>
                )}
                {cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/25" />
                    <div className="relative z-10 w-4/5 h-28">
                      <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-green-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-green-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-green-400 rounded-br-lg" />
                      <motion.div
                        className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-green-400 to-transparent"
                        animate={{ top: ['8%', '88%', '8%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-sm text-center">
                  {cameraError}
                </div>
              )}
              <p className="text-center text-gray-500 text-xs">Scanned barcode will search your inventory</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto">

        {/* ── HEADER ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-green-500 uppercase tracking-[0.15em] mb-1">
              Inventory · <span className="text-gray-400 font-normal">{activeBusiness?.name ?? '—'}</span>
            </p>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
              Products<span className="text-gray-300 dark:text-gray-600">.</span>
            </h1>
          </div>
          {(user?.role === 'admin' || user?.role === 'sales') && activeBusiness && (
            <motion.button whileTap={{ scale: 0.96 }}
              onClick={() => router.push('/dashboard/products/add')}
              className="flex items-center gap-2 px-5 h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors shadow-lg shadow-green-500/25 self-start sm:self-auto">
              <Plus className="w-4 h-4" /> Add Product
            </motion.button>
          )}
        </motion.div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Products', value: products.length,                   icon: Package,       color: 'text-blue-500',   border: 'border-blue-500/15',   bg: 'bg-blue-500/5'   },
            { label: 'Stock Value',    value: `₵${totalValue.toLocaleString()}`, icon: TrendingUp,    color: 'text-green-500',  border: 'border-green-500/15',  bg: 'bg-green-500/5'  },
            { label: 'Low Stock',      value: lowStockCount,                      icon: AlertTriangle, color: 'text-yellow-500', border: 'border-yellow-500/15', bg: 'bg-yellow-500/5' },
            { label: 'Out of Stock',   value: outOfStock,                         icon: Layers,        color: 'text-red-500',    border: 'border-red-500/15',    bg: 'bg-red-500/5'    },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}
              className={`rounded-2xl border ${s.border} ${s.bg} bg-white dark:bg-gray-900 p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{s.label}</p>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* ── TABLE CARD ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">

          {/* Search + scan + filter bar */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex gap-2 flex-1 min-w-[200px]">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={searchTerm}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search name, SKU, brand…"
                  className="w-full h-10 pl-9 pr-9 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 transition-colors"
                />
                <AnimatePresence>
                  {searchTerm && (
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => onSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Scan button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={scanning ? stopCamera : startCamera}
                title="Scan barcode to search"
                className={`flex items-center gap-1.5 px-3.5 h-10 rounded-xl border-2 font-bold text-sm transition-all flex-shrink-0 ${
                  scanning
                    ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400'
                }`}
              >
                {scanning
                  ? <><ScanLine className="w-4 h-4 animate-pulse" /><span className="hidden sm:inline text-xs">Stop</span></>
                  : <><Camera className="w-4 h-4" /><span className="hidden sm:inline text-xs">Scan</span></>
                }
              </motion.button>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {['all', ...categories].map((cat) => (
                <button key={cat} onClick={() => onCat(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    categoryFilter === cat
                      ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {cat === 'all' ? 'All' : getCat(cat).label}
                </button>
              ))}
            </div>
          </div>

          {/* Scan feedback banner */}
          <AnimatePresence>
            {scanFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 px-5 py-2.5 bg-green-500/8 border-b border-green-500/15 text-green-600 dark:text-green-400 text-sm font-semibold">
                  <ZoomIn className="w-3.5 h-3.5" />
                  {scanFeedback} — showing matching products
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          {!activeBusiness ? (
            <EmptyState icon={<Package className="w-12 h-12" />}
              title="No business selected"
              sub="Select a business from the sidebar to manage its products" />
          ) : loading ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
              <p className="text-sm text-gray-400">Loading products…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Package className="w-12 h-12" />}
              title={searchTerm || categoryFilter !== 'all' ? 'No results' : 'No products yet'}
              sub={searchTerm || categoryFilter !== 'all' ? 'Try adjusting filters or scan a different barcode' : 'Click "Add Product" to get started'} />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                      {['', 'Product', 'Category', 'Barcode / SKU', 'Stock', 'Per Piece', 'Per Box', ''].map((h, i) => (
                        <th key={i} className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-900/60">
                    {filtered.map((p, i) => {
                      const cat   = getCat(p.category);
                      const isLow = p.quantity > 0 && p.quantity <= (p.lowStockAlert ?? 5);
                      return (
                        <motion.tr key={p.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                          {/* Thumbnail */}
                          <td className="py-3 px-4 w-14">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name}
                                className="w-9 h-9 rounded-lg object-cover border border-gray-100 dark:border-gray-800" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <Package className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                            {p.brand && <p className="text-xs text-gray-400 mt-0.5">{p.brand}</p>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cat.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                              {cat.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Barcode className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                              <span className="font-mono text-xs font-bold text-gray-600 dark:text-gray-300">{p.sku}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              p.quantity === 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : isLow         ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                              :                 'bg-green-500/10 text-green-600 dark:text-green-400'
                            }`}>
                              {p.quantity === 0 ? 'Out of stock' : `${p.quantity} units`}{isLow ? ' ⚠' : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-black text-gray-900 dark:text-white text-xs">₵{(p.piecePrice ?? p.sellingPrice).toLocaleString()}</p>
                            {p.pieceCost ? <p className="text-[10px] text-gray-400 mt-0.5">cost ₵{p.pieceCost.toLocaleString()}</p> : null}
                          </td>
                          <td className="py-3.5 px-4">
                            {p.boxEnabled && p.boxPrice ? (
                              <div>
                                <p className="font-black text-amber-600 dark:text-amber-400 text-xs">₵{p.boxPrice.toLocaleString()}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{p.boxQty} pcs/box</p>
                              </div>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-700 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => router.push(`/dashboard/products/${p.id}/edit`)}
                                className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 flex items-center justify-center transition-colors" title="Edit">
                                <Edit2 className="w-3.5 h-3.5" />
                              </motion.button>
                              {user?.role === 'admin' && (
                                <motion.button whileTap={{ scale: 0.9 }}
                                  onClick={() => { setToDelete(p); setDeleteOpen(true); }}
                                  className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 flex items-center justify-center transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </motion.button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((p, i) => {
                  const cat   = getCat(p.category);
                  const isLow = p.quantity > 0 && p.quantity <= (p.lowStockAlert ?? 5);
                  return (
                    <motion.div key={p.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name}
                            className="w-12 h-12 rounded-xl object-cover border border-gray-100 dark:border-gray-800 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cat.color}`}>
                              {cat.label}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                              <Barcode className="w-3 h-3" />{p.sku}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-black text-gray-900 dark:text-white text-sm">₵{(p.piecePrice ?? p.sellingPrice).toLocaleString()}<span className="text-[10px] font-normal text-gray-400">/pc</span></p>
                          {p.boxEnabled && p.boxPrice ? (
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">₵{p.boxPrice.toLocaleString()}/box</p>
                          ) : null}
                          <span className={`text-[11px] font-bold ${
                            p.quantity === 0 ? 'text-red-500' : isLow ? 'text-yellow-500' : 'text-green-500'
                          }`}>
                            {p.quantity === 0 ? 'Out of stock' : `${p.quantity} units`}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => router.push(`/dashboard/products/${p.id}/edit`)}
                          className="flex-1 h-8 rounded-lg bg-blue-500/10 text-blue-600 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-500/20 transition-colors">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        {user?.role === 'admin' && (
                          <button onClick={() => { setToDelete(p); setDeleteOpen(true); }}
                            className="flex-1 h-8 rounded-lg bg-red-500/10 text-red-600 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-bold text-gray-700 dark:text-gray-300">{filtered.length}</span> of <span className="font-bold text-gray-700 dark:text-gray-300">{products.length}</span> products
                </p>
                <p className="text-xs text-gray-400">
                  Filtered value: <span className="font-black text-green-600 dark:text-green-400">
                    ₵{filtered.reduce((s, p) => s + calcProductValue(p), 0).toLocaleString()}
                  </span>
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── DELETE DIALOG ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl border-2 border-gray-200 dark:border-gray-800">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <AlertDialogTitle className="text-xl font-black">Delete Product?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm">
              Permanently delete <span className="font-bold text-gray-900 dark:text-white">{toDelete?.name}</span>. This cannot be undone.
            </AlertDialogDescription>
            {toDelete && toDelete.quantity > 0 && (
              <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-yellow-500/8 border border-yellow-500/15">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-semibold">
                  ⚠ This product still has {toDelete.quantity} units in stock
                </p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold">
              {isDeleting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</>
                : <><Trash2 className="w-4 h-4 mr-2" />Delete</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="py-20 flex flex-col items-center gap-3 text-center px-4">
      <div className="text-gray-200 dark:text-gray-700">{icon}</div>
      <p className="font-bold text-gray-500">{title}</p>
      <p className="text-sm text-gray-400 max-w-xs">{sub}</p>
    </div>
  );
}