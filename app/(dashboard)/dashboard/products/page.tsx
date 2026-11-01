'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Plus, Trash2, Pencil, Search, Package, AlertTriangle, Loader2, Barcode,
  Wallet, Boxes, X, ChevronLeft, ChevronRight, ScanLine, ScanBarcode, ArrowUpDown, Check, ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ───────────────────────── tokens & helpers ───────────────────────── */

const LIME = 'hsl(var(--brand-lime))';
const LEAF = 'hsl(var(--brand-leaf))';
const EMER = 'hsl(var(--brand-emerald))';
const AMBER = '#f59e0b';
const RED = '#ef4444';
// Where the dedicated stock alerts page lives. Change if your route differs.
const STOCK_ALERTS_HREF = '/dashboard/stock-alerts';

// Colors are inline (not Tailwind palette classes) so they always render
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  'home-appliances':          { label: 'Home Appliances',  color: '#0ea5e9' },
  'sneakers':                 { label: 'Sneakers',         color: '#8b5cf6' },
  'phone-laptop-accessories': { label: 'Tech Accessories', color: '#f59e0b' },
  'clothing':                 { label: 'Clothing',         color: '#f43f5e' },
  'food-beverages':           { label: 'Food & Beverages', color: 'hsl(var(--brand-leaf))' },
  'other':                    { label: 'Other',            color: '#94a3b8' },
};
const getCat = (cat: string) => CATEGORY_META[cat] ?? { label: cat, color: '#94a3b8' };
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

type StockStatus = 'all' | 'in' | 'low' | 'out';
type SortKey = 'name' | 'stock-asc' | 'value-desc' | 'newest';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name',       label: 'Name (A–Z)' },
  { key: 'newest',     label: 'Recently added' },
  { key: 'stock-asc',  label: 'Lowest stock' },
  { key: 'value-desc', label: 'Highest value' },
];

const money = (n: number) => `₵${Math.round(n).toLocaleString()}`;
const units = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'unit' : 'units'}`;
const hasBarcode = (sku?: string) => !!sku && !['NA', 'N/A', '-', '—'].includes(sku.trim().toUpperCase());

const piecePriceOf = (p: any): number => p.piecePrice ?? p.sellingPrice ?? 0;

const productValue = (p: any): number => {
  const piece = piecePriceOf(p);
  if (p.boxEnabled && p.boxPrice && p.boxQty && p.boxQty > 1) {
    const boxes = Math.floor(p.quantity / p.boxQty);
    const rest  = p.quantity % p.boxQty;
    return boxes * p.boxPrice + rest * piece;
  }
  return piece * p.quantity;
};

const statusOf = (p: any): Exclude<StockStatus, 'all'> =>
  p.quantity === 0 ? 'out' : p.quantity <= (p.lowStockAlert ?? 5) ? 'low' : 'in';

const marginOf = (p: any): number | null => {
  const price = piecePriceOf(p);
  if (!p.pieceCost || !price) return null;
  return Math.round(((price - p.pieceCost) / price) * 100);
};

/* ───────────────────────── page ───────────────────────── */

export default function ProductsPage() {
  const { user }           = useAuth();
  const { activeBusiness } = useBusiness();
  const router             = useRouter();

  const [products, setProducts]             = useState<Product[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchTerm, setSearchTerm]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState<StockStatus>('all');
  const [sortKey, setSortKey]               = useState<SortKey>('name');
  const [sortOpen, setSortOpen]             = useState(false);
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [toDelete, setToDelete]             = useState<Product | null>(null);
  const [isDeleting, setIsDeleting]         = useState(false);
  const [scanFeedback, setScanFeedback]     = useState('');

  const searchRef  = useRef<HTMLInputElement>(null);
  const stopCamRef = useRef<() => void>(() => {});
  const canEdit    = user?.role === 'admin' || user?.role === 'sales';
  const isAdmin    = user?.role === 'admin';

  /* barcode scanner */
  const handleScan = useCallback((code: string) => {
    const normalised = code.trim().toUpperCase();
    setSearchTerm(normalised);
    setScanFeedback(normalised);
    setTimeout(() => setScanFeedback(''), 3500);
    stopCamRef.current();
  }, []);

  const { scannerState, cameraError, videoRef, startCamera, stopCamera } =
    useBarcodeScanner({ onScan: handleScan, disableExternal: true });
  stopCamRef.current = stopCamera;

  const scanning    = scannerState === 'starting' || scannerState === 'active';
  const cameraReady = scannerState === 'active';

  /* "/" focuses search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(t.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* data */
  const fetchProducts = useCallback(async () => {
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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeBusiness]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', toDelete.id));
      setDeleteOpen(false); setToDelete(null); fetchProducts();
    } catch { alert('Failed to delete.'); }
    finally { setIsDeleting(false); }
  };

  /* derived */
  const stats = useMemo(() => {
    let low = 0, out = 0, inStock = 0, value = 0;
    for (const p of products) {
      const s = statusOf(p);
      if (s === 'low') low++; else if (s === 'out') out++; else inStock++;
      value += productValue(p);
    }
    return { total: products.length, low, out, inStock, value };
  }, [products]);

  const catBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach((p) => { m[p.category] = (m[p.category] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [products]);
  const categories = useMemo(() => catBreakdown.map(([c]) => c), [catBreakdown]);
  const catCounts  = useMemo(() => ({ all: products.length, ...Object.fromEntries(catBreakdown) } as Record<string, number>), [catBreakdown, products.length]);

  const filtered = useMemo(() => {
    let out = products;
    const s = searchTerm.trim().toLowerCase();
    if (s) {
      out = out.filter((p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s)
      );
    }
    if (categoryFilter !== 'all') out = out.filter((p) => p.category === categoryFilter);
    if (statusFilter !== 'all')   out = out.filter((p) => statusOf(p) === statusFilter);

    const sorted = [...out];
    switch (sortKey) {
      case 'name':       sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'stock-asc':  sorted.sort((a, b) => a.quantity - b.quantity); break;
      case 'value-desc': sorted.sort((a, b) => productValue(b) - productValue(a)); break;
      case 'newest':     sorted.sort((a: any, b: any) => +new Date(b.dateAdded) - +new Date(a.dateAdded)); break;
    }
    return sorted;
  }, [products, searchTerm, categoryFilter, statusFilter, sortKey]);

  const filteredValue = useMemo(() => filtered.reduce((s, p) => s + productValue(p), 0), [filtered]);
  const hasFilters = !!searchTerm || categoryFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => { setSearchTerm(''); setCategoryFilter('all'); setStatusFilter('all'); };

  const askDelete = (p: Product) => { setToDelete(p); setDeleteOpen(true); };
  const goEdit    = (p: Product) => router.push(`/dashboard/products/${p.id}/edit`);
  const pctFully  = stats.total ? Math.round((stats.inStock / stats.total) * 100) : 0;

  const listRef = useRef<HTMLElement>(null);
  const attention = useMemo(
    () =>
      products
        .filter((p) => statusOf(p) !== 'in')
        .sort((a, b) =>
          (statusOf(a) === 'out' ? 0 : 1) - (statusOf(b) === 'out' ? 0 : 1) || a.quantity - b.quantity),
    [products]
  );
  const reviewStatus = (st: StockStatus) => {
    setStatusFilter(st);
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  /* ─────────────────────── render ─────────────────────── */
  return (
    <div className="relative min-h-full bg-background text-foreground">

      {/* ── SCANNER OVERLAY ── */}
      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--brand-deep)/0.92)] p-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }} className="w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint(LIME, 16) }}>
                    <ScanBarcode className="h-[18px] w-[18px]" style={{ color: LIME }} />
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-semibold text-white">Scan to search</h3>
                    <p className="text-xs text-white/50">Point the camera at a barcode</p>
                  </div>
                </div>
                <button onClick={stopCamera} aria-label="Close scanner"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[hsl(var(--brand-deep))]">
                    <Loader2 className="mb-2 h-6 w-6 animate-spin" style={{ color: LIME }} />
                    <p className="text-xs text-white/50">Starting camera…</p>
                  </div>
                )}
                {cameraReady && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="relative z-10 h-28 w-4/5">
                      {['top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
                        'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
                        'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl'].map((c) => (
                        <div key={c} className={`absolute h-7 w-7 border-[hsl(var(--brand-lime))] ${c}`} />
                      ))}
                      <motion.div className="absolute left-2 right-2 h-[2px]"
                        style={{ background: `linear-gradient(90deg, transparent, ${LIME}, transparent)`, boxShadow: `0 0 12px ${LIME}` }}
                        animate={{ top: ['8%', '88%', '8%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
                    </div>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/15 px-4 py-3 text-center text-sm text-red-400">
                  {cameraError}
                </div>
              )}
              <p className="text-center text-xs text-white/40">The scanned code is used to search your inventory</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6 lg:p-8">

        {/* ── ACTION BAR (title already lives in the app shell) ── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: LIME }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: LEAF }} />
            </span>
            <span>
              <span className="font-semibold text-foreground">{activeBusiness?.name ?? '—'}</span>
              <span className="mx-2 text-border">•</span>
              {stats.total.toLocaleString()} products across {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={scanning ? stopCamera : startCamera}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent">
              <ScanLine className="h-4 w-4 text-muted-foreground" />
              {scanning ? 'Stop scanning' : 'Scan barcode'}
            </button>
            {canEdit && activeBusiness && (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => router.push('/dashboard/products/add')}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-[filter,box-shadow] hover:brightness-110 hover:shadow-md">
                <Plus className="h-4 w-4" /> Add product
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* ── OVERVIEW: one hero + three supporting cards ── */}
        <section className="grid gap-3 lg:grid-cols-12">

          {/* HERO — stock value + inventory health, grouped together */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 p-5 text-white shadow-lg sm:p-6 lg:col-span-5"
            style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)) 0%, hsl(var(--brand-forest)) 115%)' }}>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: LIME }} />
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '18px 18px' }} />

            <div className="relative flex h-full flex-col justify-between gap-6">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/60">Total stock value</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: tint(LIME, 18) }}>
                    <Wallet className="h-4 w-4" style={{ color: LIME }} />
                  </span>
                </div>
                <p className="mt-3 font-heading text-4xl font-semibold tabular-nums tracking-tight sm:text-[2.75rem]">
                  <span className="mr-0.5 text-2xl font-medium text-white/60 sm:text-3xl">₵</span>
                  {Math.round(stats.value).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-white/50">Valued at selling price, box pricing included</p>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between text-xs">
                  <span className="text-white/60">Inventory health</span>
                  <span className="font-semibold" style={{ color: LIME }}>{pctFully}% fully stocked</span>
                </div>
                <div className="flex h-2 w-full gap-[3px] overflow-hidden rounded-full bg-white/10">
                  {stats.inStock > 0 && <div className="rounded-full" style={{ flex: stats.inStock, background: `linear-gradient(90deg, ${LEAF}, ${LIME})` }} />}
                  {stats.low > 0 && <div className="rounded-full" style={{ flex: stats.low, background: AMBER }} />}
                  {stats.out > 0 && <div className="rounded-full" style={{ flex: stats.out, background: RED }} />}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                  {([
                    ['in', 'In stock', stats.inStock, LIME], ['low', 'Low', stats.low, AMBER], ['out', 'Out', stats.out, RED],
                  ] as [StockStatus, string, number, string][]).map(([k, l, n, c]) => (
                    <button key={k} onClick={() => reviewStatus(k)}
                      className="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-white">
                      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                      {l} <span className="font-semibold text-white">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right column: catalogue + needs attention */}
          <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-5 lg:col-span-7">

            {/* Catalogue */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 min-[560px]:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Catalogue</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: tint(EMER, 16), color: EMER }}>
                  <Boxes className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 font-heading text-3xl font-semibold tabular-nums">{stats.total.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">
                products · {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </p>
              <div className="mt-4 flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
                {catBreakdown.map(([c, n]) => (
                  <div key={c} title={`${getCat(c).label}: ${n}`} className="rounded-full" style={{ flex: n, background: getCat(c).color }} />
                ))}
              </div>
              <ul className="mt-4 hidden space-y-1 min-[560px]:block">
                {catBreakdown.slice(0, 4).map(([c, n]) => (
                  <li key={c}>
                    <button onClick={() => { setCategoryFilter(c); setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}
                      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: getCat(c).color }} />
                      <span className="flex-1 truncate text-left">{getCat(c).label}</span>
                      <span className="font-semibold tabular-nums text-foreground">{n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Needs attention */}
            <NeedsAttention className="min-[560px]:col-span-3"
              items={attention} low={stats.low} out={stats.out}
              onReview={reviewStatus} onOpen={goEdit}
              onViewAll={() => router.push(STOCK_ALERTS_HREF)} />
          </div>
        </section>

        {/* ── LIST CARD ── */}
        <motion.section ref={listRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">

          {/* toolbar */}
          <div className="space-y-3.5 border-b border-border p-4 sm:p-5">
            {/* row 1: search + sort */}
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <label className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-input bg-muted/50 px-3.5 transition-all focus-within:border-[hsl(var(--ring))] focus-within:bg-background focus-within:ring-4 focus-within:ring-[hsl(var(--ring)/0.15)]">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input ref={searchRef} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, SKU or brand"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                {searchTerm ? (
                  <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear search"
                    className="rounded-md p-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <kbd className="hidden rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">/</kbd>
                )}
              </label>

              <div className="relative">
                <button onClick={() => setSortOpen((o) => !o)}
                  className="inline-flex h-11 w-full items-center gap-2 rounded-xl border border-input bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent sm:w-auto">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Sort:</span>
                  {SORTS.find((s) => s.key === sortKey)?.label}
                </button>
                <AnimatePresence>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setSortOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                        className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
                        {SORTS.map((s) => (
                          <button key={s.key} onClick={() => { setSortKey(s.key); setSortOpen(false); }}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent">
                            {s.label}
                            {sortKey === s.key && <Check className="h-3.5 w-3.5 text-primary" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* row 2: status segmented + category chips */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <div className="inline-flex w-fit rounded-xl bg-muted p-1">
                {([
                  ['all', 'All', stats.total, null],
                  ['in', 'In stock', stats.inStock, LEAF],
                  ['low', 'Low', stats.low, AMBER],
                  ['out', 'Out', stats.out, RED],
                ] as [StockStatus, string, number, string | null][]).map(([key, label, n, c]) => {
                  const active = statusFilter === key;
                  return (
                    <button key={key} onClick={() => setStatusFilter(key)}
                      className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${
                        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      {active && (
                        <motion.span layoutId="status-pill" className="absolute inset-0 rounded-lg border border-border bg-card shadow-sm"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                      )}
                      <span className="relative inline-flex items-center gap-1.5">
                        {c && <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />}
                        {label}
                        <span className={`rounded-md px-1.5 text-[10px] tabular-nums ${active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{n}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <span className="hidden h-6 w-px bg-border lg:block" />

              <div className="flex flex-wrap items-center gap-1.5">
                {['all', ...categories].map((cat) => {
                  const active = categoryFilter === cat;
                  const meta = getCat(cat);
                  return (
                    <button key={cat} onClick={() => setCategoryFilter(cat)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
                      style={active || cat === 'all' ? undefined : undefined}>
                      {cat !== 'all' && <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />}
                      {cat === 'all' ? 'All categories' : meta.label}
                      <span className="tabular-nums opacity-60">{catCounts[cat] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* scan feedback */}
          <AnimatePresence>
            {scanFeedback && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-5 py-2.5 text-sm" style={{ background: tint(LIME, 14) }}>
                  <ScanBarcode className="h-4 w-4 text-primary" />
                  <span className="font-medium">Scanned</span>
                  <code className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-xs">{scanFeedback}</code>
                  <span className="text-muted-foreground">· showing matches</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* content */}
          {!activeBusiness ? (
            <EmptyState icon={<Package className="h-6 w-6" />} title="No business selected"
              sub="Pick a business from the sidebar to manage its products." />
          ) : loading ? (
            <SkeletonRows />
          ) : filtered.length === 0 ? (
            <EmptyState icon={hasFilters ? <Search className="h-6 w-6" /> : <Package className="h-6 w-6" />}
              title={hasFilters ? 'No products match' : 'No products yet'}
              sub={hasFilters ? 'Try a different search, or clear your filters.' : 'Add your first product to start tracking stock.'}
              action={hasFilters
                ? { label: 'Clear filters', onClick: clearFilters }
                : canEdit ? { label: 'Add product', onClick: () => router.push('/dashboard/products/add') } : undefined} />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {[
                        ['Product', 'text-left'], ['Category', 'text-left'], ['Barcode / SKU', 'text-left'],
                        ['Stock', 'text-left'], ['Per piece', 'text-right'], ['Per box', 'text-right'], ['', 'text-right'],
                      ].map(([h, a], i) => (
                        <th key={i} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${a}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((p, i) => {
                      const cat = getCat(p.category);
                      const st  = statusOf(p);
                      const mg  = marginOf(p);
                      const accent = st === 'out' ? RED : st === 'low' ? AMBER : 'transparent';
                      return (
                        <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i, 15) * 0.015 }}
                          className="group transition-colors hover:bg-accent/50">
                          <td className="px-5 py-3.5" style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>
                            <div className="flex items-center gap-3">
                              <Thumb p={p} color={cat.color} size="md" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{p.name}</p>
                                {p.brand && <p className="truncate text-xs text-muted-foreground">{p.brand}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                              style={{ background: tint(cat.color, 12) }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
                              {cat.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {hasBarcode(p.sku) ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium">
                                <Barcode className="h-3 w-3 text-muted-foreground" />{p.sku}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">No barcode</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5"><StockCell p={p} status={st} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <p className="font-semibold tabular-nums">{money(piecePriceOf(p))}</p>
                            <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                              {(p as any).pieceCost ? <>cost {money((p as any).pieceCost)}</> : <>—</>}
                              {mg !== null && (
                                <span className="rounded px-1 font-semibold"
                                  style={{ background: tint(mg >= 0 ? LEAF : RED, 16), color: mg >= 0 ? EMER : RED }}>
                                  {mg}%
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {(p as any).boxEnabled && (p as any).boxPrice ? (
                              <>
                                <p className="font-semibold tabular-nums">{money((p as any).boxPrice)}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{(p as any).boxQty} pcs / box</p>
                              </>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <IconBtn label="Edit" onClick={() => goEdit(p)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                              {isAdmin && <IconBtn label="Delete" danger onClick={() => askDelete(p)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-border md:hidden">
                {filtered.map((p, i) => {
                  const cat = getCat(p.category);
                  const st  = statusOf(p);
                  const accent = st === 'out' ? RED : st === 'low' ? AMBER : 'transparent';
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i, 10) * 0.02 }} className="p-4" style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>
                      <div className="flex items-start gap-3">
                        <Thumb p={p} color={cat.color} size="lg" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />{cat.label}</span>
                            {hasBarcode(p.sku) && <span className="inline-flex items-center gap-1 font-mono"><Barcode className="h-3 w-3" />{p.sku}</span>}
                          </div>
                          <div className="mt-2.5"><StockCell p={p} status={st} /></div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">{money(piecePriceOf(p))}<span className="text-[10px] font-normal text-muted-foreground">/pc</span></p>
                          {(p as any).boxEnabled && (p as any).boxPrice ? (
                            <p className="text-[11px] text-muted-foreground tabular-nums">{money((p as any).boxPrice)}/box</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => goEdit(p)}
                          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-semibold transition-colors hover:bg-accent">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        {isAdmin && (
                          <button onClick={() => askDelete(p)}
                            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10">
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* footer */}
              <div className="flex flex-col items-start justify-between gap-2 border-t border-border bg-muted/30 px-5 py-3.5 text-xs text-muted-foreground sm:flex-row sm:items-center">
                <p>
                  Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{' '}
                  <span className="font-semibold text-foreground">{products.length}</span> products
                </p>
                <p>
                  {hasFilters ? 'Filtered value' : 'Total value'}{' '}
                  <span className="font-semibold text-foreground tabular-nums">{money(filteredValue)}</span>
                </p>
              </div>
            </>
          )}
        </motion.section>
      </div>

      {/* ── DELETE DIALOG ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <AlertDialogTitle className="font-heading text-xl font-semibold">Delete product?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm">
              <span className="font-semibold text-foreground">{toDelete?.name}</span> will be permanently removed. This can’t be undone.
            </AlertDialogDescription>
            {toDelete && toDelete.quantity > 0 && (
              <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  This product still has {units(toDelete.quantity)} in stock.
                </p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}
              className="rounded-xl bg-red-500 font-semibold text-white hover:bg-red-600">
              {isDeleting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
                : <><Trash2 className="mr-2 h-4 w-4" />Delete</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────────────────── subcomponents ───────────────────────── */

function Thumb({ p, color, size }: { p: any; color: string; size: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-9 w-9 rounded-lg' : size === 'md' ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-xl';
  return p.imageUrl ? (
    <img src={p.imageUrl} alt={p.name} className={`${dim} flex-shrink-0 border border-border object-cover`} />
  ) : (
    <div className={`${dim} flex flex-shrink-0 items-center justify-center`} style={{ background: tint(color, 14), color }}>
      <Package className="h-4 w-4" />
    </div>
  );
}

function StockCell({ p, status }: { p: any; status: 'in' | 'low' | 'out' }) {
  const cap = Math.max((p.lowStockAlert ?? 5) * 4, 1);
  const pct = Math.min(100, Math.round((p.quantity / cap) * 100));
  const c = status === 'out' ? RED : status === 'low' ? AMBER : LEAF;
  const bar = status === 'in' ? `linear-gradient(90deg, ${EMER}, ${LEAF})` : c;
  return (
    <div className="w-40">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold tabular-nums">{units(p.quantity)}</span>
        {status !== 'in' && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: tint(c, 16), color: c }}>
            {status === 'out' ? 'Out' : 'Low'}
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all"
          style={{ width: status === 'out' ? '0%' : `${Math.max(pct, 6)}%`, background: bar }} />
      </div>
    </div>
  );
}

function IconBtn({ children, label, danger, onClick }: {
  children: React.ReactNode; label: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <motion.button whileTap={{ scale: 0.92 }} onClick={onClick} title={label} aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        danger ? 'text-muted-foreground hover:bg-red-500/10 hover:text-red-500'
               : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
      {children}
    </motion.button>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-2.5 w-1/5 rounded bg-muted" />
          </div>
          <div className="hidden h-3 w-24 rounded bg-muted sm:block" />
          <div className="hidden h-3 w-16 rounded bg-muted md:block" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, sub, action }: {
  icon: React.ReactNode; title: string; sub: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary" style={{ background: tint(LIME, 16) }}>
        {icon}
      </div>
      <p className="font-heading text-base font-semibold">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{sub}</p>
      {action && (
        <button onClick={action.onClick}
          className="mt-1 inline-flex h-9 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent">
          {action.label}
        </button>
      )}
    </div>
  );
}

function NeedsAttention({
  items, low, out, onReview, onOpen, onViewAll, className = '',
}: {
  items: Product[]; low: number; out: number;
  onReview: (s: StockStatus) => void; onOpen: (p: Product) => void; onViewAll: () => void;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const total = low + out;
  const ok = total === 0;

  useEffect(() => { if (idx >= items.length) setIdx(0); }, [items.length, idx]);
  const step = (d: number) => setIdx((x) => (x + d + items.length) % items.length);
  const p: any = items[idx];
  const st = p ? statusOf(p) : 'in';
  const c  = st === 'out' ? RED : AMBER;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card ${className}`}
      style={{ backgroundImage: `linear-gradient(180deg, ${tint(ok ? LEAF : AMBER, 8)}, transparent 55%)` }}>

      {/* severity strip, proportional to out vs low */}
      <div className="flex h-[3px] w-full">
        {ok ? <div className="flex-1" style={{ background: `linear-gradient(90deg, ${LEAF}, ${LIME})` }} /> : (
          <>
            {out > 0 && <div style={{ flex: out, background: RED }} />}
            {low > 0 && <div style={{ flex: low, background: AMBER }} />}
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: tint(ok ? LEAF : AMBER, 18), color: ok ? EMER : AMBER }}>
              {ok ? <Check className="h-[18px] w-[18px]" /> : <AlertTriangle className="h-[18px] w-[18px]" />}
            </span>
            <div>
              <p className="font-heading text-sm font-semibold">{ok ? 'All stocked up' : 'Needs attention'}</p>
              <p className="text-[11px] text-muted-foreground">
                {ok ? 'Nothing is running low right now' : `${total} ${total === 1 ? 'product' : 'products'} to restock`}
              </p>
            </div>
          </div>

          {!ok && (
            <div className="flex flex-shrink-0 gap-1.5">
              {out > 0 && (
                <button onClick={() => onReview('out')}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-[filter] hover:brightness-95"
                  style={{ background: tint(RED, 14), color: RED }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} />{out} out
                </button>
              )}
              {low > 0 && (
                <button onClick={() => onReview('low')}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-[filter] hover:brightness-95"
                  style={{ background: tint(AMBER, 16), color: '#d97706' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />{low} low
                </button>
              )}
            </div>
          )}
        </div>

        {/* one item at a time */}
        {!ok && p && (
          <>
            <div className="relative min-h-[64px] overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.button key={p.id} onClick={() => onOpen(p)}
                  initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.16 }}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-background/70 px-3.5 py-3 text-left transition-colors hover:bg-background">
                  <span className="h-8 w-1 flex-shrink-0 rounded-full" style={{ background: c }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{getCat(p.category).label}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums"
                    style={{ background: tint(c, 16), color: st === 'out' ? RED : '#d97706' }}>
                    {st === 'out' ? 'Out of stock' : `${p.quantity} left`}
                  </span>
                </motion.button>
              </AnimatePresence>
            </div>

            {/* pager + link out */}
            <div className="mt-auto flex items-center justify-between gap-3">
              {items.length > 1 ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => step(-1)} aria-label="Previous"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[44px] text-center text-xs font-medium tabular-nums text-muted-foreground">
                    {idx + 1} <span className="opacity-50">/</span> {items.length}
                  </span>
                  <button onClick={() => step(1)} aria-label="Next"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : <span />}

              <button onClick={onViewAll}
                className="group inline-flex items-center gap-1 text-xs font-semibold text-primary transition-opacity hover:opacity-80">
                Stock alerts
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}