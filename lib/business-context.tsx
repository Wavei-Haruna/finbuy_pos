'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';

export interface Business {
  id:         string;   // Firestore doc ID
  name:       string;
  businessId: string;   // human-readable code e.g. "finbuy-main"
  createdAt:  Date;
  logoUrl:    string | null; // receipt logo, set from Settings
}

interface BusinessContextType {
  businesses:         Business[];
  activeBusiness:     Business | null;
  setActiveBusiness:  (b: Business) => void;
  addBusiness:        (name: string, businessId: string) => Promise<void>;
  updateBusiness:     (id: string, name: string, businessId: string) => Promise<void>;
  updateBusinessLogo: (id: string, logoUrl: string | null) => Promise<void>;
  loading:            boolean;
}

const BusinessContext = createContext<BusinessContextType | null>(null);
const STORAGE_KEY = 'finbuy_active_business_id';

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businesses,          setBusinesses]        = useState<Business[]>([]);
  const [activeBusiness,      setActiveState]       = useState<Business | null>(null);
  const [loading,             setLoading]           = useState(true);

  // undefined = Firebase auth hasn't fired yet (stay in loading)
  // null      = auth resolved, no user logged in
  // string    = auth resolved, this is the logged-in uid
  const [uid, setUid] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUid(firebaseUser?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (uid === undefined) return; // still waiting — keep spinner
    if (uid === null) {
      // confirmed not logged in
      setBusinesses([]);
      setLoading(false);
      return;
    }
    fetchBusinesses(uid);
  }, [uid]);

  const fetchBusinesses = async (userId: string) => {
    try {
      const snap  = await getDocs(query(collection(db, 'businesses'), where('userId', '==', userId)));
      const data  = snap.docs
        .map((d) => ({
          id:         d.id,
          name:       (d.data().name       ?? '') as string,
          businessId: (d.data().businessId ?? '') as string,
          createdAt:  d.data().createdAt?.toDate() || new Date(),
          logoUrl:    (d.data().logoUrl ?? null) as string | null,
        }))
        .filter((b) => b.id && b.name && b.businessId); // drop broken docs

      setBusinesses(data);

      if (data.length > 0) {
        const saved    = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        const restored = saved ? data.find((b) => b.id === saved) : null;
        setActiveState(restored ?? data[0]);
      } else {
        setActiveState(null);
      }
    } catch (e) {
      console.error('BusinessProvider:', e);
    } finally {
      setLoading(false);
    }
  };

  const setActiveBusiness = (b: Business) => {
    setActiveState(b);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, b.id);
  };

  const updateBusiness = async (id: string, name: string, businessId: string) => {
    await updateDoc(doc(db, 'businesses', id), { name, businessId });
    setBusinesses((prev) =>
      prev.map((b) => b.id === id ? { ...b, name, businessId } : b)
    );
    // If the updated biz is the active one, update that too
    setActiveState((prev) => prev?.id === id ? { ...prev, name, businessId } : prev);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('finbuy_active_business_id');
      if (stored === id) localStorage.setItem('finbuy_active_business_id', id);
    }
  };

  // Dedicated updater so the logo lives in the same shared state as everything
  // else — no more component-local "override" maps that reset on reload.
  const updateBusinessLogo = async (id: string, logoUrl: string | null) => {
    await updateDoc(doc(db, 'businesses', id), { logoUrl });
    setBusinesses((prev) =>
      prev.map((b) => b.id === id ? { ...b, logoUrl } : b)
    );
    setActiveState((prev) => prev?.id === id ? { ...prev, logoUrl } : prev);
  };

  const addBusiness = async (name: string, businessId: string) => {
    if (!uid) throw new Error('Not authenticated');
    const ref    = await addDoc(collection(db, 'businesses'), { name, businessId, createdAt: new Date(), userId: uid, logoUrl: null });
    const newBiz: Business = { id: ref.id, name, businessId, createdAt: new Date(), logoUrl: null };
    setBusinesses((prev) => [...prev, newBiz]);
    setActiveBusiness(newBiz); // always activate the newly created business
  };

  return (
    <BusinessContext.Provider value={{ businesses, activeBusiness, setActiveBusiness, addBusiness, updateBusiness, updateBusinessLogo, loading }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}