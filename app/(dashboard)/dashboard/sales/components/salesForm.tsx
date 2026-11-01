'use client';

import { useState, useMemo, useCallback } from 'react';
import { Product } from '@/lib/types';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import {
  Camera, X, Plus, Minus, Trash2, Loader2, CheckCircle, User, Phone,
  MessageSquare, Package, Search, AlertCircle, Zap, ScanLine, Tag, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CartItem {
  productId:   string;
  productName: string;
  saleType:    'piece' | 'box';
  quantity:    number;
  unitPrice:   number;
  totalPrice:  number;
  boxQty?:     number; // units per box (for box sales)
}

interface SaleFormProps {
  products:       Product[];
  submitting:     boolean;
  successMessage: string;
  errorMessage?:  string;
  /** Resolve true when the sale was recorded. The cart is only cleared on true. */
  onSubmit: (
    cart:     CartItem[],
    customer: { name: string; phone: string; notes: string },
    sendSMS:  boolean
  ) => Promise<boolean>;
}

/* ───────────────────────── tokens & helpers ───────────────────────── */

const LIME  = 'hsl(var(--brand-lime))';
const LEAF  = 'hsl(var(--brand-leaf))';
const AMBER = '#f59e0b';
const tint  = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

// Money / positive numbers: emerald on light, lime on dark (both read well on their surface)
const MONEY = 'text-[hsl(var(--brand-emerald))] dark:text-[hsl(var(--brand-lime))]';

const normaliseSKU = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');
const fmt = (n: number) => `₵${n.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;

const stockMeta = (qty: number, low = 5) =>
  qty <= 0   ? { label: 'Out of stock',  cls: 'text-red-500' }
  : qty <= low ? { label: `${qty} left`, cls: 'text-amber-600 dark:text-amber-400' }
  :              { label: `${qty} in stock`, cls: 'text-muted-foreground' };

// Inputs are 16px on mobile so iOS never zooms the page when a field is focused.
const shell = (error?: boolean) =>
  `flex items-center rounded-xl border bg-muted/40 px-3.5 transition-all focus-within:bg-background focus-within:ring-4 ${
    error
      ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15'
      : 'border-input focus-within:border-[hsl(var(--ring))] focus-within:ring-[hsl(var(--ring)/0.15)]'}`;
const bare = 'h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:h-11 sm:text-sm';
const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Thumb({ src, alt, size = 'h-10 w-10' }: { src?: string; alt: string; size?: string }) {
  return (
    <span className={`flex ${size} flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted`}>
      {src
        ? <img src={src} alt={alt} className="h-full w-full object-cover" />
        : <Package className="h-4 w-4 text-muted-foreground" />}
    </span>
  );
}

/* ───────────────────────── form ───────────────────────── */

export function SaleForm({ products, submitting, successMessage, errorMessage, onSubmit }: SaleFormProps) {
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [selectedId,   setSelectedId]   = useState('');
  const [saleType,     setSaleType]     = useState<'piece' | 'box'>('piece');
  const [qty,          setQty]          = useState('1');
  const [customer,     setCustomer]     = useState({ name: '', phone: '', notes: '' });
  const [sendSMS,      setSendSMS]      = useState(true);
  const [showCustomer, setShowCustomer] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scanMsg,      setScanMsg]      = useState('');
  const [scanError,    setScanError]    = useState('');
  const [formError,    setFormError]    = useState('');

  /* ── scanning ── */
  const matchBarcode = useCallback((raw: string): Product | undefined => {
    const code = normaliseSKU(raw);
    return (
      products.find((p) => normaliseSKU(p.sku) === code) ||
      products.find((p) => normaliseSKU(p.sku).endsWith(code) || code.endsWith(normaliseSKU(p.sku)))
    );
  }, [products]);

  const handleScan = useCallback((raw: string, source: 'camera' | 'external') => {
    setScanMsg(''); setScanError(''); setFormError('');
    const match = matchBarcode(raw);
    if (match) {
      setSelectedId(match.id);
      setSearchQuery(match.name);
      setDropdownOpen(false);
      setSaleType(!match.piecePrice && match.boxEnabled ? 'box' : 'piece');
      setScanMsg(`${source === 'external' ? 'Scanner' : 'Camera'} found ${match.name}`);
    } else {
      setSearchQuery(raw);
      setDropdownOpen(true);
      setScanError(`No product matched “${raw}”. Pick it from the list below.`);
    }
  }, [matchBarcode]);

  const { scannerState, cameraError, videoRef, startCamera, stopCamera, externalEnabled, setExternalEnabled } =
    useBarcodeScanner({ onScan: handleScan });

  const scanning    = scannerState === 'starting' || scannerState === 'active';
  const cameraReady = scannerState === 'active';

  /* ── product selection & pricing ── */
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        normaliseSKU(p.sku).includes(normaliseSKU(q)) ||
        (p.brand ?? '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const selectedProduct = products.find((p) => p.id === selectedId);

  const canSellBox  = !!selectedProduct?.boxEnabled && (selectedProduct?.boxPrice ?? 0) > 0;
  const piecePrice  = selectedProduct?.piecePrice ?? selectedProduct?.sellingPrice ?? 0;
  const activePrice = saleType === 'box' && canSellBox ? (selectedProduct?.boxPrice ?? 0) : piecePrice;

  const qtyNum    = Math.max(1, parseInt(qty) || 1);
  const lineTotal = qtyNum * activePrice;
  const cartTotal = cart.reduce((s, i) => s + i.totalPrice, 0);
  const cartUnits = (productId: string) =>
    cart.filter((i) => i.productId === productId)
        .reduce((s, i) => s + (i.saleType === 'box' ? i.quantity * (i.boxQty ?? 1) : i.quantity), 0);

  const remaining = selectedProduct ? selectedProduct.quantity - cartUnits(selectedProduct.id) : 0;

  const clearSelection = useCallback(() => {
    setSelectedId('');
    setSearchQuery('');
    setScanMsg('');
    setScanError('');
    setQty('1');
    setSaleType('piece');
  }, []);

  const selectProduct = (p: Product) => {
    setSelectedId(p.id);
    setSearchQuery(p.name);
    setScanMsg('');
    setScanError('');
    setFormError('');
    setDropdownOpen(false);
    setSaleType(!p.piecePrice && p.boxEnabled ? 'box' : 'piece');
  };

  /* ── cart ── */
  const addToCart = () => {
    if (!selectedId || !selectedProduct) return;
    const q = qtyNum;

    // Box sales consume boxQty × quantity units
    const unitsConsumed = saleType === 'box' ? q * (selectedProduct.boxQty ?? 1) : q;
    if (cartUnits(selectedId) + unitsConsumed > selectedProduct.quantity) {
      setFormError(
        remaining <= 0
          ? `${selectedProduct.name} is already fully in the cart.`
          : `Not enough stock. Only ${remaining} unit${remaining !== 1 ? 's' : ''} left.`
      );
      return;
    }
    setFormError('');

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === selectedId && i.saleType === saleType);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + q, totalPrice: (item.quantity + q) * item.unitPrice } : item
        );
      }
      return [...prev, {
        productId:   selectedProduct.id,
        productName: selectedProduct.name,
        saleType,
        quantity:    q,
        unitPrice:   activePrice,
        totalPrice:  q * activePrice,
        boxQty:      saleType === 'box' ? selectedProduct.boxQty : undefined,
      }];
    });
    clearSelection();
  };

  const bumpCart = (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    if (delta > 0) {
      const product = products.find((p) => p.id === item.productId);
      const extra   = item.saleType === 'box' ? (item.boxQty ?? 1) : 1;
      if (product && cartUnits(item.productId) + extra > product.quantity) {
        setFormError(`No more stock for ${item.productName}.`);
        return;
      }
    }
    setFormError('');
    setCart((c) => c.map((i) =>
      i.productId === item.productId && i.saleType === item.saleType
        ? { ...i, quantity: newQty, totalPrice: newQty * i.unitPrice }
        : i
    ));
  };

  const removeFromCart = (item: CartItem) =>
    setCart((c) => c.filter((i) => !(i.productId === item.productId && i.saleType === item.saleType)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length || submitting) return;
    const ok = await onSubmit(cart, customer, sendSMS && !!customer.phone.trim());
    // Only clear when the sale really went through, so a failed save never loses the cart
    if (ok) {
      setCart([]);
      setCustomer({ name: '', phone: '', notes: '' });
      setShowCustomer(false);
      setFormError('');
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  /* ─────────────────────── render ─────────────────────── */
  return (
    <>
      {/* Camera overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--brand-deep)/0.92)] p-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.94, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }} className="w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint(LIME, 16) }}>
                    <ScanLine className="h-[18px] w-[18px]" style={{ color: LIME }} />
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-semibold text-white">Scan barcode</h3>
                    <p className="text-xs text-white/50">{cameraReady ? 'Point at the barcode' : 'Starting camera…'}</p>
                  </div>
                </div>
                <button type="button" onClick={stopCamera} aria-label="Close scanner"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[hsl(var(--brand-deep))]">
                    <Loader2 className="mb-2 h-6 w-6 animate-spin" style={{ color: LIME }} />
                    <p className="text-xs text-white/50">Opening camera…</p>
                  </div>
                )}
                {cameraReady && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="relative z-10 h-28 w-4/5">
                      {['top-0 left-0 border-t-2 border-l-2 rounded-tl-xl', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl', 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
                      ].map((cls) => <div key={cls} className={`absolute h-7 w-7 border-[hsl(var(--brand-lime))] ${cls}`} />)}
                      <motion.div className="absolute left-2 right-2 h-[2px]"
                        style={{ background: `linear-gradient(90deg, transparent, ${LIME}, transparent)`, boxShadow: `0 0 12px ${LIME}` }}
                        animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
                    </div>
                  </div>
                )}
              </div>
              {cameraError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/15 px-4 py-3 text-center text-sm text-red-400">{cameraError}</div>
              )}
              <p className="text-center text-xs text-white/40">Detects automatically. No button needed.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>

        {/* Success / error banners */}
        <AnimatePresence>
          {successMessage && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium" style={{ background: tint(LIME, 16) }}>
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />{successMessage}
              </div>
            </motion.div>
          )}
          {(errorMessage || formError) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />{errorMessage || formError}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ADD ITEM ── */}
        <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Add item
          </p>

          <AnimatePresence>
            {scanMsg && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: tint(LIME, 16) }}>
                <span className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-primary" />{scanMsg}</span>
                <button type="button" onClick={clearSelection} aria-label="Dismiss" className="p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </motion.div>
            )}
            {scanError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start justify-between gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
                <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{scanError}</span>
                <button type="button" onClick={clearSelection} aria-label="Dismiss" className="p-1 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search + camera */}
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <div className={shell(false)}>
                <Search className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <input type="text" value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedId(''); setScanMsg(''); setScanError(''); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  placeholder="Search name, brand or barcode"
                  className={bare} />
                {searchQuery && (
                  <button type="button" onClick={clearSelection} aria-label="Clear search"
                    className="-mr-1.5 ml-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                    className="absolute left-0 right-0 top-full z-30 mt-1.5 origin-top overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-5 text-center text-sm text-muted-foreground">
                        Nothing matches <span className="font-semibold text-foreground">“{searchQuery}”</span>
                      </div>
                    ) : (
                      <>
                        <div className="border-b border-border bg-muted/50 px-3.5 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {searchQuery
                              ? `${filteredProducts.length} result${filteredProducts.length !== 1 ? 's' : ''}`
                              : `All products · ${filteredProducts.length}`}
                          </p>
                        </div>
                        <div className="max-h-64 divide-y divide-border overflow-y-auto overscroll-contain">
                          {filteredProducts.map((p) => {
                            const st = stockMeta(p.quantity, p.lowStockAlert ?? 5);
                            return (
                              <button key={p.id} type="button" onMouseDown={() => selectProduct(p)}
                                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent active:bg-accent">
                                <Thumb src={p.imageUrl} alt={p.name} size="h-11 w-11" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">{p.name}</p>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    <p className="truncate font-mono text-[11px] text-muted-foreground">{p.sku}</p>
                                    {p.boxEnabled && (
                                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: tint(AMBER, 14), color: '#d97706' }}>Box</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <p className={`text-sm font-semibold tabular-nums ${MONEY}`}>{fmt(p.piecePrice ?? p.sellingPrice ?? 0)}</p>
                                  <p className={`text-[11px] font-medium ${st.cls}`}>{st.label}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={scanning ? stopCamera : startCamera}
              aria-label={scanning ? 'Close scanner' : 'Scan barcode'}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm transition-[filter] hover:brightness-110 sm:h-11 sm:w-11 ${
                scanning ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}`}>
              {scanning ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            </motion.button>
          </div>

          {/* External scanner */}
          <div className="flex items-center justify-between gap-3 rounded-xl px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className={`h-3.5 w-3.5 ${externalEnabled ? 'text-primary' : ''}`} />
              {externalEnabled ? (
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: LIME }} />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: LEAF }} />
                  </span>
                  Scanner gun listening
                </span>
              ) : 'USB / Bluetooth scanner gun'}
            </div>
            <Switch checked={externalEnabled} onChange={setExternalEnabled} label="External scanner" />
          </div>

          {/* Selected product + piece / box */}
          <AnimatePresence>
            {selectedProduct && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="space-y-2.5 overflow-hidden">
                <div className="flex items-center gap-3 rounded-xl border bg-card p-3" style={{ borderColor: tint(LEAF, 45) }}>
                  <Thumb src={selectedProduct.imageUrl} alt={selectedProduct.name} size="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{selectedProduct.name}</p>
                    <p className={`text-[11px] font-medium ${stockMeta(remaining, selectedProduct.lowStockAlert ?? 5).cls}`}>
                      {remaining <= 0 && selectedProduct.quantity > 0 ? 'All in cart' : stockMeta(remaining, selectedProduct.lowStockAlert ?? 5).label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-heading text-lg font-semibold tabular-nums ${MONEY}`}>{fmt(activePrice)}</p>
                    <p className="text-[11px] text-muted-foreground">{saleType === 'box' && canSellBox ? 'per box' : 'per piece'}</p>
                  </div>
                  <button type="button" onClick={clearSelection} aria-label="Remove selection"
                    className="-mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {canSellBox && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSaleType('piece')}
                      className={`flex h-12 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition-all sm:h-11 ${
                        saleType === 'piece'
                          ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}>
                      <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Per piece</span>
                      <span className="text-[11px] font-medium opacity-80">{fmt(piecePrice)}</span>
                    </button>
                    <button type="button" onClick={() => setSaleType('box')}
                      className={`flex h-12 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition-all sm:h-11 ${
                        saleType === 'box'
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
                      style={saleType === 'box' ? { background: AMBER } : undefined}>
                      <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Per box · {selectedProduct.boxQty} pcs</span>
                      <span className="text-[11px] font-medium opacity-80">{fmt(selectedProduct.boxPrice ?? 0)}</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Qty + add */}
          <div className="flex gap-2">
            <div className="flex h-12 w-[8.5rem] flex-shrink-0 items-stretch overflow-hidden rounded-xl border border-input bg-muted/40 sm:h-11">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                className="flex w-10 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-muted">
                <Minus className="h-4 w-4" />
              </button>
              <input type="number" inputMode="numeric" min="1" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity"
                className={`min-w-0 flex-1 border-x border-input bg-background text-center font-heading text-base font-semibold tabular-nums outline-none ${noSpin}`} />
              <button type="button" aria-label="Increase quantity" onClick={() => setQty(String(qtyNum + 1))}
                className="flex w-10 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-muted">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={addToCart}
              disabled={!selectedId || selectedProduct?.quantity === 0}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 sm:h-11">
              <Plus className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{selectedProduct ? `Add · ${fmt(lineTotal)}` : 'Add to cart'}</span>
            </motion.button>
          </div>
        </div>

        {/* ── CART ── */}
        <AnimatePresence initial={false}>
          {cart.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cart · {cartCount} item{cartCount !== 1 ? 's' : ''}
                </span>
                <button type="button" onClick={() => setCart([])} className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-red-500">
                  Clear all
                </button>
              </div>
              <div className="max-h-72 divide-y divide-border overflow-y-auto overscroll-contain">
                {cart.map((item) => (
                  <motion.div key={`${item.productId}-${item.saleType}`} layout className="flex items-center gap-3 bg-card px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{item.productName}</p>
                        <span className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={item.saleType === 'box'
                            ? { background: tint(AMBER, 16), color: '#d97706' }
                            : { background: tint(LIME, 20) }}>
                          {item.saleType === 'box' ? `BOX×${item.boxQty}` : 'PC'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{fmt(item.unitPrice)} each</p>
                    </div>

                    <div className="flex h-9 flex-shrink-0 items-center overflow-hidden rounded-lg border border-input">
                      <button type="button" aria-label="Decrease" onClick={() => bumpCart(item, -1)} disabled={item.quantity <= 1}
                        className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                      <button type="button" aria-label="Increase" onClick={() => bumpCart(item, 1)}
                        className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className={`w-16 flex-shrink-0 text-right text-sm font-semibold tabular-nums ${MONEY}`}>{fmt(item.totalPrice)}</p>
                    <button type="button" onClick={() => removeFromCart(item)} aria-label={`Remove ${item.productName}`}
                      className="-mr-1.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-3">
                <span className="text-sm font-semibold">Total</span>
                <span className={`font-heading text-xl font-semibold tabular-nums ${MONEY}`}>{fmt(cartTotal)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CUSTOMER (optional, collapsed by default so the till stays fast) ── */}
        <div className="rounded-2xl border border-border">
          <button type="button" onClick={() => setShowCustomer((v) => !v)} aria-expanded={showCustomer}
            className="flex min-h-[3rem] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left">
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
              <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{customer.name.trim() ? customer.name : 'Customer details'}</span>
              <span className="flex-shrink-0 text-[11px] font-normal text-muted-foreground">Optional</span>
            </span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${showCustomer ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence initial={false}>
            {showCustomer && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="space-y-3 border-t border-border p-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium">Name</label>
                      <div className={shell(false)}>
                        <User className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <input type="text" value={customer.name} autoComplete="off"
                          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                          placeholder="Walk-in customer" className={bare} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium">Phone</label>
                      <div className={shell(false)}>
                        <Phone className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <input type="tel" inputMode="tel" value={customer.phone} autoComplete="off"
                          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                          placeholder="024 123 4567" className={bare} />
                      </div>
                    </div>
                  </div>

                  {customer.phone.trim() && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3.5 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">Text the receipt</p>
                          <p className="text-[11px] text-muted-foreground">You’re always notified automatically</p>
                        </div>
                      </div>
                      <Switch checked={sendSMS} onChange={setSendSMS} label="Send SMS to customer" />
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium">Note</label>
                    <div className={`${shell(false)} items-start py-2.5`}>
                      <textarea value={customer.notes} rows={2}
                        onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                        placeholder="Anything worth remembering about this sale"
                        className="min-w-0 flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── SUBMIT (sticks to the bottom of the screen on mobile) ── */}
        <div className="sticky bottom-3 z-10">
          <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={submitting || !cart.length}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-lg transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:text-sm">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Recording sale…</>
            ) : cart.length === 0 ? (
              'Add an item to start a sale'
            ) : (
              <><CheckCircle className="h-4 w-4" /> Record sale · {fmt(cartTotal)}</>
            )}
          </motion.button>
        </div>
      </form>
    </>
  );
}