'use client';

import { useState, useMemo } from 'react';
import { Service, BusinessType } from '@/lib/types';
import {
  Loader2, Plus, X, Smartphone, Scissors, Sparkles, TrendingUp, TrendingDown,
  Search, Check, CheckCircle, User, Phone, ChevronDown, AlertCircle, Wrench,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ServiceFormProps {
  services: Service[];
  submitting: boolean;
  successMessage: string;
  errorMessage?: string;
  // Defaults to 'general' (no assumptions baked in) so existing callers keep working.
  businessType?: BusinessType;
  /** Resolve true when the job was logged. The form only resets on true. */
  onSubmit: (data: {
    serviceId: string | null;       // null when it's a brand-new service being created
    newService?: { name: string; category: string; defaultPrice: number };
    price: number;
    cost: number;
    customerName: string;
    customerPhone: string;
    notes: string;
  }) => Promise<boolean>;
}

/* ───────────────────────── tokens & helpers ───────────────────────── */

const LIME = 'hsl(var(--brand-lime))';
const LEAF = 'hsl(var(--brand-leaf))';
const RED  = '#ef4444';
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const MONEY = 'text-[hsl(var(--brand-emerald))] dark:text-[hsl(var(--brand-lime))]';
const fmt = (n: number) => `₵${n.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;

const ICON_BY_BUSINESS_TYPE: Record<BusinessType, typeof Smartphone> = {
  'phone-repair':  Smartphone,
  'barbing-salon': Scissors,
  general:         Sparkles,
};

const SUBMIT_LABEL_BY_BUSINESS_TYPE: Record<BusinessType, string> = {
  'phone-repair':  'Log service',
  'barbing-salon': 'Log cut',
  general:         'Log service',
};

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

function MoneyInput({ value, onChange, placeholder = '0.00', strong }: {
  value: string; onChange: (v: string) => void; placeholder?: string; strong?: boolean;
}) {
  return (
    <div className={shell(false)}>
      <span className="mr-2 text-sm font-semibold text-muted-foreground">₵</span>
      <input type="number" inputMode="decimal" min="0" step="0.01" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${bare} ${noSpin} tabular-nums ${strong ? 'font-semibold' : ''}`} />
    </div>
  );
}

/* ───────────────────────── form ───────────────────────── */

export function ServiceForm({
  services, submitting, successMessage, errorMessage, businessType = 'general', onSubmit,
}: ServiceFormProps) {
  const Icon = ICON_BY_BUSINESS_TYPE[businessType];

  const [selectedId,   setSelectedId]   = useState('');
  const [query,        setQuery]        = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addingNew,    setAddingNew]    = useState(false);

  const [newName,         setNewName]         = useState('');
  const [newCategory,     setNewCategory]     = useState('');
  const [newDefaultPrice, setNewDefaultPrice] = useState('');

  const [price, setPrice] = useState('');
  const [cost,  setCost]  = useState('');
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes,         setNotes]         = useState('');
  const [showCustomer,  setShowCustomer]  = useState(false);

  const selectedService = useMemo(() => services.find((s) => s.id === selectedId), [services, selectedId]);

  // Categories this business has already typed in. They show as tap-to-fill chips so nobody
  // retypes the same word with different capitalisation. Empty until the first service exists.
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) { const t = s.category?.trim(); if (t && t !== 'Uncategorized') set.add(t); }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [services]);

  // Search + group by category so a catalog of 15+ items reads like a menu
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? services.filter((s) => s.name.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q))
      : services;
    const groups = new Map<string, Service[]>();
    for (const s of list) {
      const key = s.category?.trim() || 'Uncategorized';
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return {
      count: list.length,
      groups: Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => ({ category, items })),
    };
  }, [services, query]);

  const numPrice  = parseFloat(price) || 0;
  const numCost   = parseFloat(cost) || 0;
  const margin    = numPrice - numCost;
  const marginPct = numPrice > 0 ? Math.round((margin / numPrice) * 100) : 0;

  const hasService = addingNew ? !!newName.trim() : !!selectedService;
  const canSubmit  = hasService && numPrice > 0 && !submitting;

  const selectService = (s: Service) => {
    setSelectedId(s.id);
    setQuery(s.name);
    setPrice(String(s.defaultPrice));
    setDropdownOpen(false);
  };

  const clearService = () => { setSelectedId(''); setQuery(''); setPrice(''); };

  const startNew = () => {
    setAddingNew(true);
    setNewName(query.trim());     // carry over what they were typing
    clearService();
    setDropdownOpen(false);
  };

  const cancelNew = () => { setAddingNew(false); setNewName(''); setNewCategory(''); setNewDefaultPrice(''); setPrice(''); };

  const resetForm = () => {
    clearService(); setAddingNew(false);
    setNewName(''); setNewCategory(''); setNewDefaultPrice('');
    setCost(''); setCustomerName(''); setCustomerPhone(''); setNotes(''); setShowCustomer(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const base = {
      price: numPrice, cost: numCost,
      customerName: customerName.trim(), customerPhone: customerPhone.trim(), notes: notes.trim(),
    };

    const ok = addingNew
      ? await onSubmit({
          serviceId: null,
          newService: {
            name: newName.trim(),
            category: newCategory.trim() || 'Uncategorized',
            defaultPrice: parseFloat(newDefaultPrice) || numPrice,
          },
          ...base,
        })
      : await onSubmit({ serviceId: selectedService!.id, ...base });

    // Only reset when the job really saved, so a failed save never loses what was typed
    if (ok) resetForm();
  };

  const submitLabel = SUBMIT_LABEL_BY_BUSINESS_TYPE[businessType];
  const costLabel   = businessType === 'barbing-salon' ? 'Product cost' : 'Parts cost';

  /* ─────────────────────── render ─────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>

      {/* Banners */}
      <AnimatePresence>
        {successMessage && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium" style={{ background: tint(LIME, 16) }}>
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />{successMessage}
            </div>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />{errorMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SERVICE ── */}
      <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" /> Service
        </p>

        {!addingNew ? (
          <>
            <div className="relative">
              <div className={shell(false)}>
                <Search className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <input type="text" value={query} autoComplete="off"
                  onChange={(e) => { setQuery(e.target.value); setSelectedId(''); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  placeholder={services.length ? 'Search your services' : 'No services yet. Add your first.'}
                  className={bare} />
                {query && (
                  <button type="button" onClick={clearService} aria-label="Clear"
                    className="-mr-1.5 ml-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                    className="absolute left-0 right-0 top-full z-30 mt-1.5 origin-top overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                    <div className="max-h-72 overflow-y-auto overscroll-contain">
                      {grouped.count === 0 ? (
                        <div className="px-4 py-5 text-center text-sm text-muted-foreground">
                          {services.length ? <>Nothing matches <span className="font-semibold text-foreground">“{query}”</span></> : 'Your service list is empty.'}
                        </div>
                      ) : grouped.groups.map(({ category, items }) => (
                        <div key={category}>
                          <p className="sticky top-0 border-b border-border bg-muted/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                            {category}
                          </p>
                          <div className="divide-y divide-border">
                            {items.map((s) => (
                              <button key={s.id} type="button" onMouseDown={() => selectService(s)}
                                className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent active:bg-accent">
                                <span className="min-w-0 truncate text-sm font-medium">{s.name}</span>
                                <span className={`flex-shrink-0 text-sm font-semibold tabular-nums ${MONEY}`}>{fmt(s.defaultPrice)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onMouseDown={startNew}
                      className="flex w-full items-center gap-2 border-t border-border bg-muted/40 px-3.5 py-3 text-left text-[13px] font-medium text-primary transition-colors hover:bg-accent">
                      <Plus className="h-4 w-4" />
                      {query.trim() ? `Add “${query.trim()}” as a new service` : 'Add a new service'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Selected card */}
            <AnimatePresence>
              {selectedService && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-center gap-3 rounded-xl border bg-card p-3" style={{ borderColor: tint(LEAF, 45) }}>
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]"
                      style={{ background: tint(LIME, 18) }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{selectedService.name}</p>
                      <p className="text-[11px] text-muted-foreground">{selectedService.category || 'Uncategorized'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Standard price</p>
                      <p className={`font-heading text-base font-semibold tabular-nums ${MONEY}`}>{fmt(selectedService.defaultPrice)}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!services.length && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Build your service list once. Every job after this takes a couple of taps.
              </p>
            )}

            <button type="button" onClick={startNew}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--brand-leaf))] hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> New service type
            </button>
          </>
        ) : (
          <div className="space-y-3 rounded-xl border bg-card p-3.5" style={{ borderColor: tint(LEAF, 45) }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">New service type</span>
              <button type="button" onClick={cancelNew} aria-label="Cancel new service"
                className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <Label>Name</Label>
              <div className={shell(false)}>
                <input type="text" value={newName} autoFocus autoComplete="off" onChange={(e) => setNewName(e.target.value)}
                  placeholder={businessType === 'barbing-salon' ? 'e.g. Fade + line up' : 'e.g. iPhone flash'}
                  className={bare} />
              </div>
            </div>

            <div>
              <Label hint="Optional">Category</Label>
              <div className={shell(false)}>
                <input type="text" value={newCategory} autoComplete="off" onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Repairs" className={bare} />
              </div>
              {existingCategories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {existingCategories.map((c) => {
                    const active = newCategory.trim().toLowerCase() === c.toLowerCase();
                    return (
                      <button key={c} type="button" onClick={() => setNewCategory(c)}
                        className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors ${
                          active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}>
                        {active && <Check className="h-3 w-3" />}{c}
                      </button>
                    );
                  })}
                </div>
              )}
              {!newCategory.trim() && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">Leave it blank and it goes under “Uncategorized”.</p>
              )}
            </div>

            <div>
              <Label hint="Pre-fills next time">Default price</Label>
              <MoneyInput value={newDefaultPrice} onChange={(v) => { setNewDefaultPrice(v); setPrice(v); }} />
            </div>
          </div>
        )}
      </div>

      {/* ── PRICE ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Price charged</Label>
          <MoneyInput value={price} onChange={setPrice} strong />
        </div>
        <div>
          <Label hint="Optional">{costLabel}</Label>
          <MoneyInput value={cost} onChange={setCost} />
        </div>
      </div>

      {/* Margin: only once there's something to show */}
      <AnimatePresence>
        {numPrice > 0 && numCost > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center justify-between rounded-xl border px-3.5 py-2.5"
              style={{ background: tint(margin >= 0 ? LEAF : RED, 8), borderColor: tint(margin >= 0 ? LEAF : RED, 28) }}>
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {margin >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {margin >= 0 ? 'You keep' : 'You lose'}
              </span>
              <span className={`font-heading text-base font-semibold tabular-nums ${margin >= 0 ? MONEY : 'text-red-500'}`}>
                {fmt(Math.abs(margin))}
                <span className="ml-1.5 text-xs font-medium text-muted-foreground">{marginPct}%</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CUSTOMER (optional, collapsed to keep the screen light) ── */}
      <div className="rounded-2xl border border-border">
        <button type="button" onClick={() => setShowCustomer((v) => !v)} aria-expanded={showCustomer}
          className="flex min-h-[3rem] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
            <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="truncate">{customerName.trim() ? customerName : 'Customer details'}</span>
            <span className="flex-shrink-0 text-[11px] font-normal text-muted-foreground">Optional</span>
          </span>
          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${showCustomer ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {showCustomer && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="space-y-3 border-t border-border p-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <div className={shell(false)}>
                      <User className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <input type="text" value={customerName} autoComplete="off" onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Walk-in customer" className={bare} />
                    </div>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <div className={shell(false)}>
                      <Phone className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <input type="tel" inputMode="tel" value={customerPhone} autoComplete="off" onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="024 123 4567" className={bare} />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Note</Label>
                  <div className={shell(false)}>
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder={businessType === 'barbing-salon' ? 'e.g. Regular, every 2 weeks' : 'e.g. IMEI repair needed too'}
                      className={bare} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── SUBMIT (sticks to the bottom on mobile) ── */}
      <div className="sticky bottom-3 z-10">
        <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={!canSubmit}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-lg transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:text-sm">
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : !hasService ? (
            addingNew ? 'Name the new service to continue' : 'Choose a service to continue'
          ) : numPrice <= 0 ? (
            'Enter the price to continue'
          ) : (
            <><Icon className="h-4 w-4" /> {submitLabel} · {fmt(numPrice)}</>
          )}
        </motion.button>
      </div>
    </form>
  );
}