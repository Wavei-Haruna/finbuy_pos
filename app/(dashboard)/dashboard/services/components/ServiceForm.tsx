'use client';

import { useState, useEffect, useMemo } from 'react';
import { Service, BusinessType } from '@/lib/types';
import { Loader2, Check, Plus, X, Smartphone, Scissors, Sparkles, TrendingUp } from 'lucide-react';

interface ServiceFormProps {
  services: Service[];
  submitting: boolean;
  successMessage: string;
  // Defaults to 'general' (no assumptions baked in) so existing callers that
  // haven't been updated yet keep working exactly as before.
  businessType?: BusinessType;
  onSubmit: (data: {
    serviceId: string | null;       // null when it's a brand-new service being created
    newService?: { name: string; category: string; defaultPrice: number };
    price: number;
    cost: number;
    customerName: string;
    customerPhone: string;
    notes: string;
  }) => Promise<void>;
}

const ICON_BY_BUSINESS_TYPE: Record<BusinessType, typeof Smartphone> = {
  'phone-repair':  Smartphone,
  'barbing-salon': Scissors,
  general:         Sparkles,
};

const SUBMIT_LABEL_BY_BUSINESS_TYPE: Record<BusinessType, string> = {
  'phone-repair':  'Log Service',
  'barbing-salon': 'Log Cut',
  general:         'Log Service',
};

// One accent per vertical so the same shell doesn't feel identical across
// industries. Kept to Tailwind's built-in palette — no arbitrary hex values.
const ACCENT_BY_BUSINESS_TYPE: Record<BusinessType, {
  text: string; bg: string; bgSoft: string; border: string; ring: string; gradient: string;
}> = {
  'phone-repair': {
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500',
    bgSoft: 'bg-sky-50/60 dark:bg-sky-500/5',
    border: 'border-sky-200 dark:border-sky-900',
    ring: 'focus:ring-sky-500/20 focus:border-sky-400',
    gradient: 'from-sky-500 to-sky-600',
  },
  'barbing-salon': {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-50/60 dark:bg-amber-500/5',
    border: 'border-amber-200 dark:border-amber-900',
    ring: 'focus:ring-amber-500/20 focus:border-amber-400',
    gradient: 'from-amber-500 to-amber-600',
  },
  general: {
    text: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500',
    bgSoft: 'bg-indigo-50/60 dark:bg-indigo-500/5',
    border: 'border-indigo-200 dark:border-indigo-900',
    ring: 'focus:ring-indigo-500/20 focus:border-indigo-400',
    gradient: 'from-indigo-500 to-indigo-600',
  },
};

const inputBase =
  'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ' +
  'text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-colors';

export function ServiceForm({ services, submitting, successMessage, businessType = 'general', onSubmit }: ServiceFormProps) {
  const Icon = ICON_BY_BUSINESS_TYPE[businessType];
  const accent = ACCENT_BY_BUSINESS_TYPE[businessType];

  const [selectedId, setSelectedId] = useState<string>('');
  const [addingNew, setAddingNew]   = useState(false);

  const [newName, setNewName]         = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDefaultPrice, setNewDefaultPrice] = useState('');

  const [price, setPrice] = useState('');
  const [cost, setCost]   = useState('');
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const selectedService = useMemo(() => services.find((s) => s.id === selectedId), [services, selectedId]);

  useEffect(() => {
    if (selectedService) setPrice(String(selectedService.defaultPrice));
  }, [selectedService]);

  // Existing category names this business has already typed in, so the
  // "new category" field can suggest them instead of the user retyping the
  // same word with different capitalization every time. Nothing is preset —
  // this list is empty until the business has logged at least one service.
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      const trimmed = s.category?.trim();
      if (trimmed) set.add(trimmed);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [services]);

  // Group services by category so a catalog of 15+ items reads as a menu,
  // not a flat alphabetical dump. Categories are whatever the business has
  // typed in themselves — there's no fixed list to filter against.
  const groupedServices = useMemo(() => {
    const groups = new Map<string, Service[]>();
    for (const s of services) {
      const key = s.category?.trim() || 'Uncategorized';
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({ category, items }));
  }, [services]);

  const numPrice = parseFloat(price) || 0;
  const numCost  = parseFloat(cost) || 0;
  const margin   = numPrice - numCost;
  const marginPct = numPrice > 0 ? Math.round((margin / numPrice) * 100) : null;

  const resetForm = () => {
    setSelectedId(''); setAddingNew(false);
    setNewName(''); setNewCategory(''); setNewDefaultPrice('');
    setPrice(''); setCost(''); setCustomerName(''); setCustomerPhone(''); setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numPrice || numPrice <= 0) return;

    if (addingNew) {
      if (!newName.trim()) return;
      await onSubmit({
        serviceId: null,
        newService: {
          name: newName.trim(),
          category: newCategory.trim() || 'Uncategorized',
          defaultPrice: parseFloat(newDefaultPrice) || numPrice,
        },
        price: numPrice, cost: numCost,
        customerName: customerName.trim(), customerPhone: customerPhone.trim(), notes: notes.trim(),
      });
    } else {
      if (!selectedService) return;
      await onSubmit({
        serviceId: selectedService.id,
        price: numPrice, cost: numCost,
        customerName: customerName.trim(), customerPhone: customerPhone.trim(), notes: notes.trim(),
      });
    }
    resetForm();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Service picker */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Service</label>

        {!addingNew ? (
          <div className="space-y-2">
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={`${inputBase} ${accent.ring} font-medium appearance-none pr-9`}
              >
                <option value="">
                  {services.length ? 'Select a service…' : 'No services yet for this business'}
                </option>
                {groupedServices.map(({ category, items }) => (
                  <optgroup key={category} label={category}>
                    {items.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} · ₵{s.defaultPrice.toLocaleString()}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedService && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${accent.bg}`} />
              )}
            </div>

            {!services.length && (
              <p className="text-xs text-gray-400 leading-relaxed">
                Build your service list once — every job after this is a couple of taps.
              </p>
            )}

            <button
              type="button"
              onClick={() => { setAddingNew(true); setSelectedId(''); }}
              className={`flex items-center gap-1.5 text-xs font-bold ${accent.text} hover:opacity-80 transition-opacity`}
            >
              <Plus className="w-3.5 h-3.5" /> Add a new service type
            </button>
          </div>
        ) : (
          <div className={`space-y-2.5 p-3.5 rounded-2xl border ${accent.border} ${accent.bgSoft}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black ${accent.text} uppercase tracking-wider`}>New Service Type</span>
              <button type="button" onClick={() => setAddingNew(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={businessType === 'barbing-salon' ? 'e.g. Fade + Line Up' : 'e.g. iPhone Flash'}
              className={`${inputBase} ${accent.ring}`}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                list="service-category-suggestions"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category (e.g. Repairs)"
                className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 ${accent.ring}`}
              />
              {/* Suggests categories this business has already typed before —
                  purely a convenience autocomplete, nothing is preset or forced. */}
              <datalist id="service-category-suggestions">
                {existingCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={newDefaultPrice}
                onChange={(e) => { setNewDefaultPrice(e.target.value); setPrice(e.target.value); }}
                placeholder="Default price ₵"
                className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 ${accent.ring}`}
              />
            </div>
            {!newCategory.trim() && (
              <p className="text-[10px] text-gray-400">Leave blank and it'll be filed under "Uncategorized".</p>
            )}
          </div>
        )}
      </div>

      {/* Price charged this time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Price Charged (₵)</label>
          <input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className={`${inputBase} ${accent.ring} font-bold`}
            required
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
            {businessType === 'barbing-salon' ? 'Product Cost (₵)' : 'Parts Cost (₵)'}
          </label>
          <input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00 (optional)"
            className={`${inputBase} ${accent.ring}`}
          />
        </div>
      </div>

      {/* Margin preview — only appears once there's something to show */}
      {numPrice > 0 && numCost > 0 && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <TrendingUp className="w-3.5 h-3.5" /> You keep
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            ₵{margin.toLocaleString()} <span className="text-gray-400 font-medium">({marginPct}%)</span>
          </span>
        </div>
      )}

      {/* Customer */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Customer Name</label>
          <input
            type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Walk-in customer"
            className={`${inputBase} ${accent.ring}`}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Customer Phone</label>
          <input
            type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="024xxxxxxx"
            className={`${inputBase} ${accent.ring}`}
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Notes</label>
        <input
          type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={businessType === 'barbing-salon' ? 'e.g. Regular, every 2 weeks' : 'e.g. IMEI repair needed too'}
          className={`${inputBase} ${accent.ring}`}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || (!addingNew && !selectedId) || (addingNew && !newName.trim())}
        className={`w-full py-3 rounded-xl bg-gradient-to-r ${accent.gradient} text-white text-sm font-bold shadow-sm hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2`}
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          : <><Icon className="w-4 h-4" /> {SUBMIT_LABEL_BY_BUSINESS_TYPE[businessType]}</>}
      </button>

      {successMessage && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400">
          <Check className="w-3.5 h-3.5" /> {successMessage}
        </p>
      )}
    </form>
  );
}