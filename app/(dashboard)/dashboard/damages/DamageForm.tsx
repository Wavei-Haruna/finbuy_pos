'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Product, DAMAGE_REASONS } from '@/lib/types';
import {
  PackageX, Loader2, Check, CheckCircle, AlertCircle, ChevronDown, Search,
  Package, X, TriangleAlert, Plus, Minus, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DamageFormProps {
  products: Product[];
  submitting: boolean;
  successMessage: string;
  errorMessage?: string;
  /** Resolve true when the damage was recorded. The form only clears on true. */
  onSubmit: (data: {
    productId: string;
    quantity: number;
    reason: string;
    notes: string;
  }) => Promise<boolean>;
}

/* ───────────────────────── tokens & helpers ───────────────────────── */

const LIME   = 'hsl(var(--brand-lime))';
const ORANGE = '#f97316'; // damages colour, same as the "damages" category on the Expenses page
const tint   = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const fmt    = (n: number) => `₵${n.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;

// Inputs are 16px on mobile so iOS never zooms the page when a field is focused.
const shell = (error?: boolean) =>
  `flex items-center rounded-xl border bg-muted/40 px-3.5 transition-all focus-within:bg-background focus-within:ring-4 ${
    error
      ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15'
      : 'border-input focus-within:border-[hsl(var(--ring))] focus-within:ring-[hsl(var(--ring)/0.15)]'}`;
const bare = 'h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:h-11 sm:text-sm';
const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label className="text-[13px] font-medium">{children}</label>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ProductThumb({ product, size = 'h-10 w-10' }: { product: Product; size?: string }) {
  return (
    <span className={`flex ${size} flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted`}>
      {product.imageUrl
        ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        : <Package className="h-4 w-4 text-muted-foreground" />}
    </span>
  );
}

/* ───────────────────────── form ───────────────────────── */

export function DamageForm({ products, submitting, successMessage, errorMessage, onSubmit }: DamageFormProps) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity]   = useState(1);
  const [reason, setReason]       = useState<string>(DAMAGE_REASONS[0]);
  const [notes, setNotes]         = useState('');
  const [error, setError]         = useState('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const stock         = selectedProduct?.quantity ?? 0;
  const unitCost      = selectedProduct?.costPrice || 0;
  const estimatedLoss = unitCost * quantity;
  const exceedsStock  = !!selectedProduct && quantity > stock;
  const noCostPrice   = !!selectedProduct && unitCost <= 0;

  const canSubmit = !!selectedProduct && quantity >= 1 && !exceedsStock && !submitting;

  const resetForm = () => {
    setProductId('');
    setQuantity(1);
    setReason(DAMAGE_REASONS[0]);
    setNotes('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!productId || !selectedProduct) { setError('Select a product first.'); return; }
    if (quantity <= 0) { setError('Quantity must be at least 1.'); return; }
    if (quantity > stock) { setError(`Only ${stock} in stock, so you can’t record more damaged than that.`); return; }

    const ok = await onSubmit({ productId, quantity, reason, notes: notes.trim() });
    // Only clear when it really saved, so a failed save never loses what was typed
    if (ok) resetForm();
  };

  const submitLabel =
    !selectedProduct ? 'Choose a product to continue'
    : exceedsStock ? `Only ${stock} in stock`
    : null;

  /* ─────────────────────── render ─────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>

      {/* Banners */}
      <AnimatePresence>
        {successMessage && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div role="status" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium" style={{ background: tint(LIME, 16) }}>
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />{successMessage}
            </div>
          </motion.div>
        )}
        {(errorMessage || error) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />{errorMessage || error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product */}
      <div>
        <Label>Product</Label>
        <ProductCombobox
          products={products}
          value={productId}
          onChange={(id) => { setProductId(id); setError(''); setQuantity(1); }}
        />
        {products.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">No products found for this business.</p>
        )}
      </div>

      {/* Quantity */}
      <div>
        <Label hint={selectedProduct ? `${stock} available` : undefined}>Quantity damaged</Label>
        <div className="flex gap-2">
          <div className={`flex h-12 min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border bg-muted/40 transition-all focus-within:ring-4 sm:h-11 ${
            exceedsStock
              ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15'
              : 'border-input focus-within:border-[hsl(var(--ring))] focus-within:ring-[hsl(var(--ring)/0.15)]'}`}>
            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex w-11 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-muted">
              <Minus className="h-4 w-4" />
            </button>
            <input type="number" inputMode="numeric" min="1" value={quantity || ''} aria-label="Quantity damaged"
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className={`min-w-0 flex-1 border-x border-input bg-background text-center font-heading text-base font-semibold tabular-nums outline-none ${noSpin}`} />
            <button type="button" aria-label="Increase quantity" disabled={!!selectedProduct && quantity >= stock}
              onClick={() => setQuantity((q) => (selectedProduct ? Math.min(stock, q + 1) : q + 1))}
              className="flex w-11 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-muted disabled:opacity-30">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {selectedProduct && stock > 1 && (
            <button type="button" onClick={() => setQuantity(stock)}
              className="h-12 flex-shrink-0 rounded-xl border border-border bg-background px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:h-11">
              All {stock}
            </button>
          )}
        </div>
        {exceedsStock && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
            <AlertCircle className="h-3.5 w-3.5" /> Exceeds available stock ({stock})
          </p>
        )}
      </div>

      {/* Reason */}
      <div>
        <Label>Reason</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
          {DAMAGE_REASONS.map((r) => {
            const active = reason === r;
            return (
              <button key={r} type="button" role="radio" aria-checked={active} onClick={() => setReason(r)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all ${
                  active ? 'text-foreground' : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
                style={active ? { background: tint(ORANGE, 14), borderColor: ORANGE } : undefined}>
                {active && <Check className="h-3.5 w-3.5" style={{ color: ORANGE }} />}
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label hint="Optional">Notes</Label>
        <div className={`${shell(false)} items-start py-2.5`}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Anything worth remembering about this loss"
            className="min-w-0 flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm" />
        </div>
      </div>

      {/* Loss preview */}
      <AnimatePresence initial={false}>
        {selectedProduct && estimatedLoss > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl border px-3.5 py-3" style={{ background: tint(ORANGE, 8), borderColor: tint(ORANGE, 28) }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">Estimated loss</span>
                <span className="font-heading text-xl font-semibold tabular-nums" style={{ color: '#ea580c' }}>{fmt(estimatedLoss)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {quantity} × {fmt(unitCost)} cost. This is logged as an expense and taken off your stock.
              </p>
            </div>
          </motion.div>
        )}
        {noCostPrice && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex gap-2 rounded-xl bg-accent px-3.5 py-3 text-xs text-accent-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                This product has no cost price, so the loss will be recorded as ₵0. Stock will still go down.
                Set its cost price on the product to track the loss properly.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit (sticks to the bottom on mobile) */}
      <div className="sticky bottom-3 z-10">
        <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={!canSubmit}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-lg transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:text-sm">
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Recording…</>
          ) : submitLabel ? (
            submitLabel
          ) : (
            <><PackageX className="h-4 w-4" /> Record damage{estimatedLoss > 0 ? ` · ${fmt(estimatedLoss)} loss` : ''}</>
          )}
        </motion.button>
      </div>
    </form>
  );
}

/* ───────────────────────── product combobox ─────────────────────────
   Searchable picker: type to filter by name / brand / SKU / category, with the
   product image and a stock badge inline. Out-of-stock items stay visible but
   disabled (so staff can see "yep, we're out" instead of it just vanishing), and
   low-stock items get an amber flag so a damage report doubles as a heads-up. */

function ProductCombobox({ products, value, onChange }: {
  products: Product[]; value: string; onChange: (id: string) => void;
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
          p.category?.toLowerCase().includes(q));
    // In-stock first, then alphabetical within each group
    return [...base].sort((a, b) => {
      const aOut = a.quantity <= 0, bOut = b.quantity <= 0;
      if (aOut !== bOut) return aOut ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [products, search]);

  useEffect(() => {
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
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
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox"
        className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-left transition-all ${
          open
            ? 'border-[hsl(var(--ring))] bg-background ring-4 ring-[hsl(var(--ring)/0.15)]'
            : 'border-input bg-muted/40 hover:border-foreground/30'}`}>
        {selected ? (
          <>
            <ProductThumb product={selected} size="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{selected.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {selected.sku ? `${selected.sku} · ` : ''}{selected.quantity} in stock
              </p>
            </div>
            <span role="button" tabIndex={0} aria-label="Clear selection"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
              <X className="h-4 w-4" />
            </span>
          </>
        ) : (
          <>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
              <Package className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="flex-1 text-base text-muted-foreground sm:text-sm">Select a product</span>
          </>
        )}
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-30 mt-1.5 origin-top overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
            <div className="border-b border-border p-2">
              <div className={shell(false)}>
                <Search className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Search name, brand, SKU or category" className={bare} />
              </div>
            </div>

            <div className="max-h-72 divide-y divide-border overflow-y-auto overscroll-contain" role="listbox">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Search className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Nothing matches <span className="font-semibold text-foreground">“{search}”</span>
                  </p>
                </div>
              ) : filtered.map((p, i) => {
                const isOut = p.quantity <= 0;
                const isLow = !isOut && p.quantity <= (p.lowStockAlert ?? 5);
                const isSelected = p.id === value;
                return (
                  <button key={p.id} type="button" role="option" aria-selected={isSelected} disabled={isOut}
                    onMouseEnter={() => setHighlight(i)} onClick={() => pick(p)}
                    className={`flex min-h-[3.5rem] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                      isOut ? 'cursor-not-allowed opacity-45'
                      : i === highlight || isSelected ? 'bg-accent' : 'hover:bg-accent'}`}>
                    <ProductThumb product={p} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.brand ? `${p.brand} · ` : ''}{p.sku || 'No barcode'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {isOut ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">Out of stock</span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <TriangleAlert className="h-2.5 w-2.5" />{p.quantity} left
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {p.quantity} in stock
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}