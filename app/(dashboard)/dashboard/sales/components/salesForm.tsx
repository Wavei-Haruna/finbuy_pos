'use client';

import { useState, useMemo, useCallback } from 'react';
import { Product } from '@/lib/types';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import {
  Camera, X, Plus, Trash2, Loader2, CheckCircle,
  User, Phone, MessageSquare, Package, Search,
  AlertCircle, Zap, ScanLine, Tag,
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
  onSubmit: (
    cart:     CartItem[],
    customer: { name: string; phone: string; notes: string },
    sendSMS:  boolean
  ) => Promise<void>;
}

const normaliseSKU = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');

export function SaleForm({ products, submitting, successMessage, onSubmit }: SaleFormProps) {
  const [cart,         setCart]        = useState<CartItem[]>([]);
  const [selectedId,   setSelectedId]  = useState('');
  const [saleType,     setSaleType]    = useState<'piece' | 'box'>('piece');
  const [qty,          setQty]         = useState('1');
  const [customer,     setCustomer]    = useState({ name: '', phone: '', notes: '' });
  const [sendSMS,      setSendSMS]     = useState(true);
  const [searchQuery,  setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen]= useState(false);
  const [scanMsg,      setScanMsg]     = useState('');
  const [scanError,    setScanError]   = useState('');

  const matchBarcode = useCallback((raw: string): Product | undefined => {
    const code = normaliseSKU(raw);
    return (
      products.find((p) => normaliseSKU(p.sku) === code) ||
      products.find((p) => normaliseSKU(p.sku).endsWith(code) || code.endsWith(normaliseSKU(p.sku)))
    );
  }, [products]);

  const handleScan = useCallback((raw: string, source: 'camera' | 'external') => {
    setScanMsg(''); setScanError('');
    const match = matchBarcode(raw);
    if (match) {
      setSelectedId(match.id);
      setSearchQuery(match.name);
      setDropdownOpen(false);
      setScanMsg(`${source === 'external' ? '🔌' : '📷'} Found: ${match.name}`);
    } else {
      setSearchQuery(raw);
      setDropdownOpen(true);
      setScanError(`No product matched "${raw}" — select manually below.`);
    }
  }, [matchBarcode]);

  const { scannerState, cameraError, videoRef, startCamera, stopCamera, externalEnabled, setExternalEnabled } =
    useBarcodeScanner({ onScan: handleScan });

  const scanning    = scannerState === 'starting' || scannerState === 'active';
  const cameraReady = scannerState === 'active';

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

  // Determine pricing based on sale type
  const canSellBox  = selectedProduct?.boxEnabled && (selectedProduct?.boxPrice ?? 0) > 0;
  const activePrice = saleType === 'box' && canSellBox
    ? (selectedProduct?.boxPrice ?? 0)
    : (selectedProduct?.piecePrice ?? selectedProduct?.sellingPrice ?? 0);

  const cartTotal = cart.reduce((s, i) => s + i.totalPrice, 0);

  const clearSelection = useCallback(() => {
    setSelectedId('');
    setSearchQuery('');
    setScanMsg('');
    setScanError('');
    setQty('1');
    setSaleType('piece');
  }, []);

  // When product changes, reset to piece if box not available
  const selectProduct = (p: Product) => {
    setSelectedId(p.id);
    setSearchQuery(p.name);
    setScanMsg('');
    setScanError('');
    setDropdownOpen(false);
    // Auto-select piece; if only box available, switch
    if (!p.piecePrice && p.boxEnabled) setSaleType('box');
    else setSaleType('piece');
  };

  const addToCart = () => {
    if (!selectedId || !selectedProduct) return;
    const q = parseInt(qty) || 1;

    // Stock check: box sales consume boxQty * quantity units
    const unitsConsumed = saleType === 'box' ? q * (selectedProduct.boxQty ?? 1) : q;
    const inCartUnits   = cart
      .filter((i) => i.productId === selectedId)
      .reduce((s, i) => s + (i.saleType === 'box' ? i.quantity * (i.boxQty ?? 1) : i.quantity), 0);

    if (inCartUnits + unitsConsumed > selectedProduct.quantity) {
      alert(`Not enough stock. Only ${selectedProduct.quantity - inCartUnits} units left.`);
      return;
    }

    const cartKey = `${selectedId}-${saleType}`;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === selectedId && i.saleType === saleType);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? {
            ...item,
            quantity:   item.quantity + q,
            totalPrice: (item.quantity + q) * item.unitPrice,
          } : item
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length || !customer.name) return;
    await onSubmit(cart, customer, sendSMS);
    setCart([]);
    setCustomer({ name: '', phone: '', notes: '' });
  };

  return (
    <>
      {/* Camera overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.93 }} animate={{ scale: 1 }} exit={{ scale: 0.93 }}
              className="w-full max-w-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <ScanLine className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-sm">Scan Barcode</p>
                    <p className="text-gray-500 text-xs">{cameraReady ? 'Point at barcode' : 'Starting…'}</p>
                  </div>
                </div>
                <button onClick={stopCamera}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950">
                    <Loader2 className="w-7 h-7 text-green-400 animate-spin mb-2" />
                    <p className="text-gray-400 text-xs">Opening camera…</p>
                  </div>
                )}
                {cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/25" />
                    <div className="relative z-10 w-4/5 h-24">
                      {['top-0 left-0 border-t-2 border-l-2 rounded-tl-lg','top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg','bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                      ].map((cls, i) => <div key={i} className={`absolute w-6 h-6 border-green-400 ${cls}`} />)}
                      <motion.div className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-green-400 to-transparent"
                        animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                    </div>
                  </div>
                )}
              </div>
              {cameraError && <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-xs text-center">{cameraError}</div>}
              <p className="text-center text-gray-600 text-xs">EAN, UPC, QR, Code128 — auto-detects</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Success */}
        <AnimatePresence>
          {successMessage && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-bold">{successMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* External scanner toggle */}
        <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-colors ${
          externalEnabled ? 'bg-blue-500/5 border-blue-500/20' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-center gap-2">
            <Zap className={`w-3.5 h-3.5 ${externalEnabled ? 'text-blue-500' : 'text-gray-400'}`} />
            <div>
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">External Scanner</p>
              <p className="text-[10px] text-gray-400">USB / Bluetooth HID device</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {externalEnabled && (
              <span className="flex items-center gap-1 text-[10px] font-black text-blue-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                </span>LISTENING
              </span>
            )}
            <button type="button" onClick={() => setExternalEnabled(!externalEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${externalEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${externalEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* ── ADD PRODUCT ── */}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/40 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <Package className="w-3 h-3" /> Add Product
          </p>

          {/* Scan / error feedback */}
          <AnimatePresence>
            {scanMsg && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-semibold">
                <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />{scanMsg}</div>
                <button type="button" onClick={clearSelection}><X className="w-3.5 h-3.5" /></button>
              </motion.div>
            )}
            {scanError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                <div className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{scanError}</div>
                <button type="button" onClick={clearSelection}><X className="w-3.5 h-3.5" /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input type="text" value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedId(''); setScanMsg(''); setScanError(''); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                placeholder="Search or scan a product…"
                className="w-full h-11 pl-9 pr-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-400" />
              <AnimatePresence>
                {searchQuery && (
                  <motion.button type="button" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }} onClick={clearSelection}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Dropdown — all products or filtered */}
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -6, scaleY: 0.95 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: -6, scaleY: 0.95 }} transition={{ duration: 0.1 }}
                    className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl z-30 overflow-hidden origin-top">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">
                        No products match "<span className="font-bold text-gray-600 dark:text-gray-300">{searchQuery}</span>"
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {searchQuery ? `${filteredProducts.length} result${filteredProducts.length !== 1 ? 's' : ''}` : `All products · ${filteredProducts.length}`}
                          </p>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                          {filteredProducts.map((p) => (
                            <button key={p.id} type="button"
                              onMouseDown={() => selectProduct(p)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                              <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {p.imageUrl
                                  ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                  : <Package className="w-3.5 h-3.5 text-gray-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[10px] font-mono text-gray-400">{p.sku}</p>
                                  {p.boxEnabled && <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Box ✓</span>}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 space-y-0.5">
                                <p className="text-xs font-black text-green-600 dark:text-green-400">₵{(p.piecePrice ?? p.sellingPrice ?? 0).toLocaleString()}/pc</p>
                                {p.boxEnabled && p.boxPrice && (
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">₵{p.boxPrice.toLocaleString()}/box</p>
                                )}
                                <p className={`text-[10px] font-bold ${p.quantity === 0 ? 'text-red-500' : p.quantity < 5 ? 'text-yellow-500' : 'text-gray-400'}`}>
                                  {p.quantity === 0 ? 'Out' : `${p.quantity} left`}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Camera button */}
            <motion.button type="button" whileTap={{ scale: 0.92 }}
              onClick={scanning ? stopCamera : startCamera}
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-white transition-colors flex-shrink-0 shadow-md ${
                scanning ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-green-500 hover:bg-green-600 shadow-green-500/20'
              }`}>
              {scanning ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </motion.button>
          </div>

          {/* Selected product + piece/box toggle */}
          <AnimatePresence>
            {selectedProduct && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">

                {/* Product card */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-gray-900 border-2 border-green-500/20">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {selectedProduct.imageUrl
                      ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                      : <Package className="w-3.5 h-3.5 text-green-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{selectedProduct.name}</p>
                    <p className="text-[10px] font-mono text-gray-400">{selectedProduct.sku}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-green-600 dark:text-green-400">₵{activePrice.toLocaleString()}</p>
                    <p className={`text-[10px] font-bold ${selectedProduct.quantity === 0 ? 'text-red-500' : selectedProduct.quantity < 10 ? 'text-yellow-500' : 'text-gray-400'}`}>
                      {selectedProduct.quantity === 0 ? 'Out of stock' : `${selectedProduct.quantity} in stock`}
                    </p>
                  </div>
                  <button type="button" onClick={clearSelection} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Piece / Box toggle — only show if box pricing exists */}
                {canSellBox && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSaleType('piece')}
                      className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border-2 text-xs font-bold transition-all ${
                        saleType === 'piece'
                          ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-green-400 hover:text-green-600'
                      }`}>
                      <Tag className="w-3.5 h-3.5" />
                      Per Piece · ₵{(selectedProduct.piecePrice ?? selectedProduct.sellingPrice ?? 0).toLocaleString()}
                    </button>
                    <button type="button" onClick={() => setSaleType('box')}
                      className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border-2 text-xs font-bold transition-all ${
                        saleType === 'box'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-400 hover:text-amber-600'
                      }`}>
                      <Package className="w-3.5 h-3.5" />
                      Per Box ({selectedProduct.boxQty} pcs) · ₵{(selectedProduct.boxPrice ?? 0).toLocaleString()}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Qty + Add */}
          <div className="flex gap-2">
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" min="1"
              className="w-20 h-11 px-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-black text-center focus:outline-none focus:border-green-500 transition-colors flex-shrink-0" />
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={addToCart}
              disabled={!selectedId || selectedProduct?.quantity === 0}
              className="flex-1 h-11 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-sm flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-all">
              <Plus className="w-4 h-4" /> Add to Cart
            </motion.button>
          </div>
        </div>

        {/* Cart */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cart · {cart.length} item{cart.length !== 1 ? 's' : ''}</span>
                <span className="text-xs font-black text-green-600 dark:text-green-400">₵{cartTotal.toLocaleString()}</span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {cart.map((item) => (
                  <motion.div key={`${item.productId}-${item.saleType}`} layout
                    className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-950">
                    {/* Piece/box badge */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                      item.saleType === 'box'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400'
                    }`}>
                      {item.saleType === 'box' ? `BOX×${item.boxQty}` : 'PC'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.productName}</p>
                      <p className="text-[10px] text-gray-400">{item.quantity} × ₵{item.unitPrice.toLocaleString()}</p>
                    </div>
                    <p className="text-xs font-black text-green-600 dark:text-green-400 flex-shrink-0">₵{item.totalPrice.toLocaleString()}</p>
                    <button type="button"
                      onClick={() => setCart((c) => c.filter((i) => !(i.productId === item.productId && i.saleType === item.saleType)))}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-black text-gray-700 dark:text-gray-300">Total</span>
                <span className="text-base font-black text-green-600 dark:text-green-400">₵{cartTotal.toLocaleString()}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><User className="w-3 h-3" /> Name *</label>
            <input type="text" value={customer.name} required onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Customer name"
              className="w-full h-11 px-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-400" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><Phone className="w-3 h-3" /> Phone <span className="text-[9px] font-normal normal-case ml-1 text-gray-400">optional</span></label>
            <input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="0241234567 (optional)"
              className="w-full h-11 px-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-400" />
          </div>
        </div>

        {/* SMS toggle — only show if customer phone is entered */}
        {customer.phone && <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Send SMS to Customer</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Admin notification is sent automatically</p>
            </div>
          </div>
          <button type="button" onClick={() => setSendSMS(!sendSMS)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sendSMS ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${sendSMS ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>}

        <textarea value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
          placeholder="Notes (optional)" rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 transition-colors resize-none placeholder:text-gray-400" />

        <motion.button type="submit" whileTap={{ scale: 0.97 }}
          disabled={submitting || !cart.length || !customer.name}
          className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-500/20">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
            : <><CheckCircle className="w-4 h-4" /> Record Sale {cart.length > 0 && `· ${cart.length} item${cart.length > 1 ? 's' : ''}`}</>}
        </motion.button>
      </form>
    </>
  );
}