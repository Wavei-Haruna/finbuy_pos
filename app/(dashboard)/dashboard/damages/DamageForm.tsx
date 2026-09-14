'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Product, DAMAGE_REASONS } from '@/lib/types';
import {
  PackageX, Loader2, Check, AlertCircle, ChevronDown, Search,
  Package, X, TriangleAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DamageFormProps {
  products: Product[];
  submitting: boolean;
  successMessage: string;
  onSubmit: (data: {
    productId: string;
    quantity: number;
    reason: string;
    notes: string;
  }) => Promise<void>;
}

export function DamageForm({ products, submitting, successMessage, onSubmit }: DamageFormProps) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity]   = useState(1);
  const [reason, setReason]       = useState<string>(DAMAGE_REASONS[0]);
  const [notes, setNotes]         = useState('');
  const [error, setError]         = useState('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const estimatedLoss = selectedProduct ? selectedProduct.costPrice * quantity : 0;
  const exceedsStock = selectedProduct ? quantity > selectedProduct.quantity : false;

  const resetForm = () => {
    setProductId('');
    setQuantity(1);
    setReason(DAMAGE_REASONS[0]);
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!productId) { setError('Select a product'); return; }
    if (!selectedProduct) return;
    if (quantity <= 0) { setError('Quantity must be at least 1'); return; }
    if (quantity > selectedProduct.quantity) {
      setError(`Only ${selectedProduct.quantity} in stock — can't damage more than that`);
      return;
    }

    await onSubmit({ productId, quantity, reason, notes: notes.trim() });
    resetForm();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Product</label>
        <ProductCombobox
          products={products}
          value={productId}
          onChange={(id) => { setProductId(id); setError(''); setQuantity(1); }}
        />
        {products.length === 0 && (
          <p className="text-xs text-gray-400 mt-1.5">No products found for this business.</p>
        )}
      </div>

      {/* Quantity */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
          Quantity Damaged {selectedProduct && <span className="normal-case font-normal text-gray-400">({selectedProduct.quantity} available)</span>}
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-all flex-shrink-0">−</button>
          <input type="number" min="1" value={quantity || ''}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className={`w-full h-11 px-3.5 rounded-xl border-2 text-sm font-black text-center focus:outline-none transition-colors ${
              exceedsStock
                ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/10 text-gray-900 dark:text-white'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-orange-500'
            }`} />
          <button type="button" onClick={() => setQuantity((q) => q + 1)}
            className="w-10 h-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl font-black text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-all flex-shrink-0">+</button>
        </div>
        {exceedsStock && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" />Exceeds available stock ({selectedProduct?.quantity})
          </p>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Reason</label>
        <div className="grid grid-cols-2 gap-1.5">
          {DAMAGE_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-colors text-left ${
                reason === r
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Notes <span className="normal-case font-normal">(optional)</span></label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any extra detail…"
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
        />
      </div>

      {/* Estimated loss preview */}
      <AnimatePresence>
        {selectedProduct && estimatedLoss > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-orange-500/8 border border-orange-500/15 text-sm font-semibold text-orange-600 dark:text-orange-400">
              <span>Estimated loss (logged as expense)</span>
              <span className="font-black text-lg">₵{estimatedLoss.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 font-medium"><AlertCircle className="w-3 h-3" />{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
          : <><PackageX className="w-4 h-4" /> Record Damage</>}
      </button>

      {successMessage && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400">
          <Check className="w-3.5 h-3.5" /> {successMessage}
        </p>
      )}
    </form>
  );
}

// ── Product Combobox ─────────────────────────────────────────────────────────
// Searchable dropdown: type to filter by name/brand/sku/category, shows
// product image + stock badge inline, out-of-stock items are visible but
// disabled (so staff can see "yep, we're out" instead of it just vanishing),
// and low-stock items get a subtle amber flag so a damage report doubles as
// a heads-up.

function ProductCombobox({
  products, value, onChange,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => products.find((p) => p.id === value) ?? null, [products, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q
      ? products
      : products.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
    // In-stock items first, then alphabetical within each group.
    return [...base].sort((a, b) => {
      const aOut = a.quantity <= 0, bOut = b.quantity <= 0;
      if (aOut !== bOut) return aOut ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [products, search]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => { if (open) { setSearch(''); setHighlight(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);
  useEffect(() => { setHighlight(0); }, [search]);

  const pick = (p: Product) => {
    if (p.quantity <= 0) return;
    onChange(p.id);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const p = filtered[highlight]; if (p) pick(p); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
          open
            ? 'border-orange-400 ring-2 ring-orange-500/20 bg-white dark:bg-gray-900'
            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
        }`}
      >
        {selected ? (
          <>
            <ProductThumb product={selected} size={30} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">{selected.name}</p>
              <p className="text-[11px] text-gray-400 truncate">
                {selected.sku ? `${selected.sku} · ` : ''}{selected.quantity} in stock
              </p>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          </>
        ) : (
          <>
            <div className="w-[30px] h-[30px] rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-400">Select a product…</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.97 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute z-30 mt-1.5 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden origin-top"
          >
            {/* Search */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search name, brand, SKU, category…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-center px-4">
                  <Search className="w-6 h-6 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs font-semibold text-gray-400">No products match "{search}"</p>
                </div>
              ) : (
                filtered.map((p, i) => {
                  const isOut = p.quantity <= 0;
                  const isLow = !isOut && p.quantity <= p.lowStockAlert;
                  const isHighlighted = i === highlight;
                  const isSelected = p.id === value;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isOut}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(p)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        isOut
                          ? 'opacity-40 cursor-not-allowed'
                          : isHighlighted || isSelected
                            ? 'bg-orange-500/10'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      }`}
                    >
                      <ProductThumb product={p} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                          {isSelected && <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">
                          {p.brand ? `${p.brand} · ` : ''}{p.sku || 'no SKU'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {isOut ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">Out of stock</span>
                        ) : isLow ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <TriangleAlert className="w-2.5 h-2.5" />{p.quantity} left
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                            {p.quantity} in stock
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductThumb({ product, size }: { product: Product; size: number }) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-lg object-cover flex-shrink-0 border border-gray-100 dark:border-gray-800"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0"
    >
      <Package className="w-3.5 h-3.5 text-gray-400" />
    </div>
  );
}