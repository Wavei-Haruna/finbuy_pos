'use client';

import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useBusiness } from '@/lib/business-context';

export type Cat = { value: string; label: string; color: string; custom?: boolean };

// Built-in categories. Colours match the products page.
export const DEFAULT_CATEGORIES: Cat[] = [
  { value: 'home-appliances',          label: 'Home Appliances',  color: '#0ea5e9' },
  { value: 'sneakers',                 label: 'Sneakers',         color: '#8b5cf6' },
  { value: 'phone-laptop-accessories', label: 'Tech Accessories', color: '#f59e0b' },
  { value: 'clothing',                 label: 'Clothing',         color: '#f43f5e' },
  { value: 'food-beverages',           label: 'Food & Beverages', color: 'hsl(var(--brand-leaf))' },
  { value: 'other',                    label: 'Other',            color: '#94a3b8' },
];

export const EXTRA_COLORS = ['#14b8a6', '#ec4899', '#6366f1', '#84cc16', '#f97316'];

export const humanize = (v: string) => v.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Default categories + the custom ones this business has saved.
 * Custom categories live in the Firestore `categories` collection:
 *   { businessId, value, label, color, createdAt }
 */
export function useCategories() {
  const { activeBusiness } = useBusiness();
  const [custom, setCustom]   = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!activeBusiness) { setCustom([]); setLoading(false); return; }
    setLoading(true);
    getDocs(query(collection(db, 'categories'), where('businessId', '==', activeBusiness.id)))
      .then((snap) => {
        if (!alive) return;
        const rows = snap.docs
          .map((d) => d.data() as any)
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
          .map((r) => ({ value: r.value, label: r.label, color: r.color, custom: true } as Cat));
        setCustom(rows);
      })
      .catch((e) => console.error('Failed to load categories', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeBusiness?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = [...DEFAULT_CATEGORIES, ...custom];

  /** Saves a new category and returns it. If it already exists, returns the existing one. */
  const addCategory = useCallback(async (rawLabel: string): Promise<Cat | null> => {
    const label = rawLabel.trim();
    if (!label || !activeBusiness) return null;
    const value = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!value) return null;

    const existing = [...DEFAULT_CATEGORIES, ...custom].find((c) => c.value === value);
    if (existing) return existing;

    const cat: Cat = { value, label, color: EXTRA_COLORS[custom.length % EXTRA_COLORS.length], custom: true };
    setCustom((prev) => [...prev, cat]);                       // show it immediately
    try {
      await addDoc(collection(db, 'categories'), {
        businessId: activeBusiness.id,
        value: cat.value,
        label: cat.label,
        color: cat.color,
        createdAt: Date.now(),
      });
    } catch (e) {
      setCustom((prev) => prev.filter((c) => c.value !== value)); // roll back if the save failed
      throw e;
    }
    return cat;
  }, [activeBusiness, custom]);

  return { categories, loading, addCategory };
}