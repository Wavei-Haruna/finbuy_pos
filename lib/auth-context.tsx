'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { auth, db } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User, UserRole } from './types';

interface AuthContextType {
  user:         User | null;
  firebaseUser: FirebaseUser | null;
  loading:      boolean;
  error:        string | null;
  login:        (email: string, password: string) => Promise<void>;
  register:     (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout:         () => Promise<void>;
  updateProfile:  (data: { name?: string; phone?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,         setUser]         = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── Auto-logout at 11:00 PM every day ────────────────────────────────
  useEffect(() => {
    const scheduleLogout = () => {
      const now    = new Date();
      const logout = new Date();
      logout.setHours(23, 0, 0, 0); // 11:00 PM today
      // If it's already past 11pm, schedule for tomorrow
      if (now >= logout) logout.setDate(logout.getDate() + 1);
      const msUntilLogout = logout.getTime() - now.getTime();

      const timer = setTimeout(async () => {
        try { await signOut(auth); } catch (_) {}
        // Re-schedule for next day
        scheduleLogout();
      }, msUntilLogout);

      return timer;
    };

    const timer = scheduleLogout();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userDoc    = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const d = userDoc.data();
            setUser({
              id:        fbUser.uid,
              email:     fbUser.email || '',
              name:      d.name,
              role:      d.role,
              phone:     d.phone || '',
              createdAt: d.createdAt?.toDate() || new Date(),
            });
          } else {
            // First login ever — create user doc then set user
            const newUser = {
              name:      fbUser.displayName || fbUser.email?.split('@')[0] || 'Admin',
              email:     fbUser.email || '',
              role:      'admin' as UserRole,
              createdAt: new Date(),
            };
            await setDoc(userDocRef, newUser);
            setUser({ id: fbUser.uid, ...newUser });
          }
        } catch {
          // Firestore unavailable — still authenticate so user isn't stuck
          setUser({
            id:        fbUser.uid,
            email:     fbUser.email || '',
            name:      fbUser.displayName || fbUser.email?.split('@')[0] || 'Admin',
            role:      'admin' as UserRole,
            createdAt: new Date(),
          });
        } finally {
          // setLoading AFTER setUser so the dashboard layout never sees
          // user=null while loading=false at the same time
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    // Do NOT touch loading here — onAuthStateChanged owns it.
    // Do NOT router.push here — the login page watches `user` via useEffect.
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', result.user.uid), { name, email, role, createdAt: new Date() });
      setUser({ id: result.user.uid, email, name, role, createdAt: new Date() });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateProfile = async (data: { name?: string; phone?: string }) => {
    if (!firebaseUser) throw new Error('Not authenticated');
    setError(null);
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), data);
      setUser((prev) => prev ? { ...prev, ...data } : prev);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!firebaseUser || !firebaseUser.email) throw new Error('Not authenticated');
    setError(null);
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
    } catch (err: any) {
      const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Current password is incorrect.'
        : err.code === 'auth/weak-password'
          ? 'New password must be at least 6 characters.'
          : err.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, error, login, register, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}