'use client';

import { useState, useEffect, useMemo } from 'react';
import { Service, ServiceCategory, SERVICE_CATEGORY_LABELS, SERVICE_CATEGORIES } from '@/lib/types';
import { Loader2, Check, Plus, X, Smartphone } from 'lucide-react';

interface ServiceFormProps {
  services: Service[];
  submitting: boolean;
  successMessage: string;
  onSubmit: (data: {
    serviceId: string | null;       // null when it's a brand-new service being created
    newService?: { name: string; category: ServiceCategory; defaultPrice: number };
    price: number;
    cost: number;
    customerName: string;
    customerPhone: string;
    notes: string;
  }) => Promise<void>;
}

export function ServiceForm({ services, submitting, successMessage, onSubmit }: ServiceFormProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [addingNew, setAddingNew]   = useState(false);

  const [newName, setNewName]         = useState('');
  const [newCategory, setNewCategory] = useState<ServiceCategory>('flashing');
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

  const resetForm = () => {
    setSelectedId(''); setAddingNew(false);
    setNewName(''); setNewCategory('flashing'); setNewDefaultPrice('');
    setPrice(''); setCost(''); setCustomerName(''); setCustomerPhone(''); setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    const numCost = parseFloat(cost) || 0;
    if (!numPrice || numPrice <= 0) return;

    if (addingNew) {
      if (!newName.trim()) return;
      await onSubmit({
        serviceId: null,
        newService: { name: newName.trim(), category: newCategory, defaultPrice: parseFloat(newDefaultPrice) || numPrice },
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Service picker */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Service</label>

        {!addingNew ? (
          <div className="space-y-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            >
              <option value="">{services.length ? 'Select a service…' : 'No saved services yet'}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · ₵{s.defaultPrice.toLocaleString()}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setAddingNew(true); setSelectedId(''); }}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600"
            >
              <Plus className="w-3.5 h-3.5" /> Add a new service type
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-500/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">New Service Type</span>
              <button type="button" onClick={() => setAddingNew(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. iPhone Flash"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ServiceCategory)}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={newDefaultPrice}
                onChange={(e) => { setNewDefaultPrice(e.target.value); setPrice(e.target.value); }}
                placeholder="Default price ₵"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
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
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            required
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Parts Cost (₵)</label>
          <input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00 (optional)"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Customer */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Customer Name (optional)</label>
        <input
          type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Walk-in customer"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Customer Phone (optional)</label>
        <input
          type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="024xxxxxxx"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Notes (optional)</label>
        <input
          type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. IMEI repair needed too"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || (!addingNew && !selectedId) || (addingNew && !newName.trim())}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          : <><Smartphone className="w-4 h-4" /> Log Service</>}
      </button>

      {successMessage && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400">
          <Check className="w-3.5 h-3.5" /> {successMessage}
        </p>
      )}
    </form>
  );
}