'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { supabase } from '@/lib/supabase';
import {
  User, Phone, Lock, Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader2,
  ShieldCheck, KeyRound, Bell, Building2, Hash, Pencil, X, ImageIcon,
  Trash2, AlertTriangle, ArrowLeftRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ───────────────────────── tokens & helpers ───────────────────────── */

type Tab = 'profile' | 'businesses' | 'security';

const LIME  = 'hsl(var(--brand-lime))';
const LEAF  = 'hsl(var(--brand-leaf))';
const AMBER = '#f59e0b';
const tint  = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const CHIP  = 'text-[hsl(var(--brand-forest))] dark:text-[hsl(var(--brand-lime))]';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

// Inputs are 16px on mobile so iOS never zooms the page when a field is focused.
const shell = (error?: boolean) =>
  `flex items-center rounded-xl border bg-muted/40 px-3.5 transition-all focus-within:bg-background focus-within:ring-4 ${
    error
      ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15'
      : 'border-input focus-within:border-[hsl(var(--ring))] focus-within:ring-[hsl(var(--ring)/0.15)]'}`;
const bare = 'h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:text-sm';

function Section({ icon: Icon, title, desc, children }: {
  icon: React.ElementType; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${CHIP}`} style={{ background: tint(LIME, 18) }}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[15px] font-semibold leading-tight">{title}</h2>
          {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Banner({ tone, children, onClose }: { tone: 'success' | 'error'; children: React.ReactNode; onClose?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div role={tone === 'error' ? 'alert' : 'status'}
        className={`flex items-start justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
          tone === 'success' ? '' : 'border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'}`}
        style={tone === 'success' ? { background: tint(LIME, 16) } : undefined}>
        <span className="flex items-start gap-2">
          {tone === 'success'
            ? <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          {children}
        </span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Dismiss" className="-mr-1 p-1 hover:opacity-70"><X className="h-4 w-4" /></button>
        )}
      </div>
    </motion.div>
  );
}

function TextField({
  id, label, value, onChange, type = 'text', placeholder, icon: Icon, disabled, hint, error, inputMode, autoComplete, right,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; icon: React.ElementType; disabled?: boolean;
  hint?: string; error?: boolean; inputMode?: 'text' | 'tel' | 'numeric'; autoComplete?: string; right?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">{label}</label>
      <div className={shell(error)}>
        <Icon className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <input id={id} type={type} value={value} disabled={disabled} placeholder={placeholder}
          inputMode={inputMode} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} className={bare} />
        {right}
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, placeholder, disabled, autoComplete, error }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; autoComplete?: string; error?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <TextField id={id} label={label} value={value} onChange={onChange} type={show ? 'text' : 'password'}
      placeholder={placeholder} icon={Lock} disabled={disabled} autoComplete={autoComplete} error={error}
      right={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          className="-mr-1.5 ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      } />
  );
}

/* ───────────────────────── logo uploader ───────────────────────── */

function LogoUploader({ bizId, bizName, logoUrl, onUploaded, onRemoved }: {
  bizId: string; bizName: string; logoUrl: string | null;
  onUploaded: (url: string) => Promise<void>;
  onRemoved: () => Promise<void>;
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'removing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const preview = localPreview || logoUrl;
  const busy = status !== 'idle';

  const clearLocal = () => {
    setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const validate = (file: File) => {
    if (!file.type.startsWith('image/')) return 'Please choose an image file (PNG or JPG).';
    if (file.size > MAX_LOGO_BYTES) return 'That file is too big. Logos must be under 2MB.';
    return null;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const err = validate(file);
    if (err) { setError(err); return; }

    setError(null);
    setLocalPreview(URL.createObjectURL(file));
    setStatus('uploading');
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${bizId}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('business-logos')
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(filePath);
      await onUploaded(urlData.publicUrl); // writes Firestore + updates shared business-context state
      clearLocal();                        // the saved URL takes over from the local preview
    } catch (err: any) {
      // Log the real error: the on-screen message alone often can't tell a Storage
      // RLS rejection from a missing bucket.
      console.error('Logo upload failed:', err);
      setError(err?.message || 'Upload failed. Please try again.');
      clearLocal();
    } finally {
      setStatus('idle');
    }
  };

  const handleRemove = async () => {
    setStatus('removing');
    setError(null);
    try {
      await onRemoved();
      clearLocal();
    } catch (err: any) {
      console.error('Logo remove failed:', err);
      setError(err?.message || 'Could not remove the logo. Please try again.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) handleFile(e.dataTransfer.files?.[0]); }}
      className={`border-t border-border px-4 py-3.5 transition-colors ${dragOver ? 'bg-[hsl(var(--brand-lime)/0.10)]' : 'bg-muted/30'}`}>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

      <div className="flex items-center gap-3">
        <span className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
          {preview
            ? <img src={preview} alt={`${bizName} logo`} className="h-full w-full object-contain p-1" />
            : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Receipt logo</p>
          <p className="text-[11px] text-muted-foreground">Printed at the top of every receipt. PNG or JPG, up to 2MB.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-[13px] font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          {status === 'uploading' ? 'Uploading…' : preview ? 'Replace logo' : 'Upload logo'}
        </button>
        {preview && (
          <button type="button" onClick={handleRemove} disabled={busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> {status === 'removing' ? 'Removing…' : 'Remove'}
          </button>
        )}
        <span className="hidden text-[11px] text-muted-foreground sm:inline">or drop an image here</span>
      </div>

      {error && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs font-medium text-red-500">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── delete business sheet ─────────────────────────
   Type-to-confirm, because this is destructive and can't be undone from the UI. */

function DeleteBusinessModal({ biz, onCancel, onConfirm, deleting, error }: {
  biz: { id: string; name: string; businessId: string };
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState('');
  const matches = input.trim().toLowerCase() === biz.name.trim().toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[hsl(var(--brand-deep)/0.7)] backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onCancel(); }}>
      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        role="dialog" aria-modal="true" aria-label={`Delete ${biz.name}`}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex justify-center pt-2.5 sm:hidden"><span className="h-1 w-10 rounded-full bg-border" /></div>

        <div className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </span>
            <div className="min-w-0">
              <h3 className="font-heading text-base font-semibold leading-tight">Delete “{biz.name}”?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This permanently removes the business and can’t be undone. Its products, sales history and staff access will be affected too.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-biz" className="mb-1.5 block text-[13px] font-medium">
              Type <span className="font-semibold">{biz.name}</span> to confirm
            </label>
            <div className={shell(false)}>
              <input id="confirm-biz" autoFocus type="text" value={input} disabled={deleting} autoComplete="off"
                onChange={(e) => setInput(e.target.value)} placeholder={biz.name} className={bare} />
            </div>
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-xs font-medium text-red-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={onCancel} disabled={deleting}
              className="h-12 flex-1 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50">
              Cancel
            </button>
            <motion.button whileTap={matches ? { scale: 0.97 } : undefined} onClick={() => matches && onConfirm()}
              disabled={!matches || deleting}
              className="inline-flex h-12 flex-[1.3] items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? 'Deleting…' : 'Delete business'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const { businesses, activeBusiness, setActiveBusiness, updateBusiness, updateBusinessLogo, deleteBusiness } = useBusiness();

  const [tab, setTab] = useState<Tab>('profile');

  // Profile
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg]         = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savingPwd, setSavingPwd]   = useState(false);

  // Business editing
  const [editingBizId, setEditingBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState('');
  const [bizCode, setBizCode] = useState('');
  const [bizMsg, setBizMsg]   = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingBiz, setSavingBiz] = useState(false);

  // Business deletion
  const [deletingBiz, setDeletingBiz] = useState<{ id: string; name: string; businessId: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingNow, setDeletingNow] = useState(false);

  useEffect(() => {
    if (user) { setName(user.name || ''); setPhone(user.phone || ''); }
  }, [user]);

  const flash = (
    setter: (v: any) => void, value: any, ms = 4000,
  ) => { setter(value); setTimeout(() => setter(null), ms); };

  /* ── profile ── */
  const profileDirty = name.trim() !== (user?.name || '') || phone.trim() !== (user?.phone || '');

  const handleSaveProfile = async () => {
    if (!name.trim()) { flash(setProfileMsg, { text: 'Your name can’t be empty.', type: 'error' }); return; }
    if (phone.trim() && phone.replace(/\D/g, '').length < 9) {
      flash(setProfileMsg, { text: 'Enter a valid phone number, for example 0551837449.', type: 'error' });
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      flash(setProfileMsg, { text: 'Profile updated.', type: 'success' });
    } catch (err: any) {
      flash(setProfileMsg, { text: err.message || 'Could not update your profile.', type: 'error' });
    } finally { setSavingProfile(false); }
  };

  /* ── password ── */
  const handleChangePassword = async () => {
    if (!currentPwd)           { flash(setPwdMsg, { text: 'Enter your current password.', type: 'error' }); return; }
    if (newPwd.length < 6)     { flash(setPwdMsg, { text: 'The new password must be at least 6 characters.', type: 'error' }); return; }
    if (newPwd !== confirmPwd) { flash(setPwdMsg, { text: 'The new passwords don’t match.', type: 'error' }); return; }
    if (newPwd === currentPwd) { flash(setPwdMsg, { text: 'The new password must be different from the current one.', type: 'error' }); return; }
    setSavingPwd(true);
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      flash(setPwdMsg, { text: 'Password changed.', type: 'success' });
    } catch (err: any) {
      flash(setPwdMsg, { text: err.message || 'Could not change your password.', type: 'error' });
    } finally { setSavingPwd(false); }
  };

  const strength = (() => {
    if (!newPwd) return null;
    if (newPwd.length < 6) return { label: 'Too short', score: 1, color: '#ef4444' };
    if (newPwd.length < 8) return { label: 'Weak',      score: 2, color: '#f97316' };
    if (!/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) return { label: 'Fair', score: 3, color: '#eab308' };
    return { label: 'Strong', score: 4, color: LEAF };
  })();

  /* ── business edit ── */
  const startEditBiz = (biz: { id: string; name: string; businessId: string }) => {
    setEditingBizId(biz.id); setBizName(biz.name); setBizCode(biz.businessId);
    setEditError(null); setBizMsg(null);
  };
  const cancelEditBiz = () => { setEditingBizId(null); setBizName(''); setBizCode(''); setEditError(null); };

  const handleSaveBiz = async () => {
    if (!bizName.trim()) { setEditError('Business name can’t be empty.'); return; }
    if (!bizCode.trim()) { setEditError('Business ID can’t be empty.'); return; }
    if (!editingBizId) return;

    const isDupe = businesses.some(
      (b) => b.id !== editingBizId && b.businessId.toLowerCase() === bizCode.trim().toLowerCase(),
    );
    if (isDupe) { setEditError('Another business already uses this ID.'); return; }

    setSavingBiz(true);
    setEditError(null);
    try {
      await updateBusiness(editingBizId, bizName.trim(), bizCode.trim().toUpperCase());
      flash(setBizMsg, 'Business updated.');
      setEditingBizId(null);
    } catch (err: any) {
      setEditError(err.message || 'Could not update this business.');
    } finally { setSavingBiz(false); }
  };

  /* ── business delete ── */
  const handleConfirmDelete = async () => {
    if (!deletingBiz) return;
    setDeletingNow(true);
    setDeleteError(null);
    try {
      await deleteBusiness(deletingBiz.id);

      // If the deleted business was the active one, hand off to whatever's left
      if (activeBusiness?.id === deletingBiz.id) {
        setActiveBusiness(businesses.find((b) => b.id !== deletingBiz.id) ?? null);
      }
      if (editingBizId === deletingBiz.id) cancelEditBiz();

      flash(setBizMsg, `“${deletingBiz.name}” was deleted.`);
      setDeletingBiz(null);
    } catch (err: any) {
      console.error('Delete business failed:', err);
      setDeleteError(err?.message || 'Could not delete this business. Please try again.');
    } finally {
      setDeletingNow(false);
    }
  };

  const savedPhone = user?.phone?.trim();

  const TABS: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'profile',    label: 'Profile',    icon: User },
    { key: 'businesses', label: 'Businesses', icon: Building2, count: businesses.length },
    { key: 'security',   label: 'Security',   icon: KeyRound },
  ];

  /* ─────────────────────── render ─────────────────────── */
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4 lg:px-6">

        {/* Account hero */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm sm:p-6"
          style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)), hsl(var(--brand-forest)))' }}>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: LIME }} />

          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl font-heading text-2xl font-semibold text-[hsl(var(--brand-deep))]"
              style={{ background: LIME }}>
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-xl font-semibold leading-tight">{user?.name || 'Your account'}</p>
              <p className="truncate text-sm text-white/60">{user?.email}</p>
            </div>
            <span className="hidden flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold capitalize sm:inline-flex"
              style={{ background: tint(LIME, 18), color: LIME }}>
              <ShieldCheck className="h-3.5 w-3.5" /> {user?.role || 'admin'}
            </span>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
            {[
              { label: 'Role',          value: <span className="capitalize">{user?.role || 'admin'}</span> },
              { label: 'Sale alerts',   value: savedPhone || 'Not set' },
              { label: 'Active business', value: activeBusiness?.name || '—' },
            ].map((s) => (
              <div key={s.label} className="min-w-0">
                <p className="truncate text-[11px] text-white/55">{s.label}</p>
                <p className="mt-0.5 truncate font-heading text-base font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">

          {/* Section nav: segmented on mobile, vertical rail on desktop */}
          <nav aria-label="Settings sections" className="lg:sticky lg:top-4">
            <div role="tablist"
              className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-muted/50 p-1 lg:grid-cols-1 lg:gap-0.5 lg:bg-card lg:p-1.5 lg:shadow-sm">
              {TABS.map(({ key, label, icon: Icon, count }) => {
                const active = tab === key;
                return (
                  <button key={key} role="tab" aria-selected={active} onClick={() => setTab(key)}
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-medium transition-all lg:justify-start ${
                      active ? 'bg-card text-foreground shadow-sm lg:bg-accent lg:shadow-none' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
                    {label}
                    {typeof count === 'number' && (
                      <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground lg:ml-auto">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Panels */}
          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>

              {/* ── PROFILE ── */}
              {tab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <Section icon={User} title="Profile" desc="Your name and the number that gets sale alerts.">
                    <div className="space-y-3.5 p-4">
                      <TextField id="profile-name" label="Full name" value={name} onChange={setName}
                        placeholder="Your full name" icon={User} disabled={savingProfile} autoComplete="name" />
                      <TextField id="profile-phone" label="Phone number" value={phone} onChange={setPhone} type="tel" inputMode="tel"
                        placeholder="e.g. 0551837449" icon={Phone} disabled={savingProfile} autoComplete="tel"
                        hint="You get an SMS copy of every sale recorded by you or your staff." />

                      <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs"
                        style={savedPhone ? { background: tint(LIME, 14) } : { background: tint(AMBER, 12) }}>
                        <Bell className={`mt-0.5 h-4 w-4 flex-shrink-0 ${savedPhone ? 'text-primary' : 'text-amber-600 dark:text-amber-400'}`} />
                        <p className="leading-relaxed">
                          {savedPhone
                            ? <>Sale alerts go to <span className="font-semibold">{savedPhone}</span>.</>
                            : <>No number saved yet. Add one above to get an SMS for every sale.</>}
                        </p>
                      </div>

                      <AnimatePresence>
                        {profileMsg && <Banner tone={profileMsg.type}>{profileMsg.text}</Banner>}
                      </AnimatePresence>

                      <div className="flex justify-end pt-1">
                        <motion.button onClick={handleSaveProfile} disabled={savingProfile || !profileDirty} whileTap={{ scale: 0.98 }}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto">
                          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {savingProfile ? 'Saving…' : profileDirty ? 'Save changes' : 'Saved'}
                        </motion.button>
                      </div>
                    </div>
                  </Section>
                </motion.div>
              )}

              {/* ── BUSINESSES ── */}
              {tab === 'businesses' && (
                <motion.div key="businesses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <AnimatePresence>{bizMsg && <Banner tone="success" onClose={() => setBizMsg(null)}>{bizMsg}</Banner>}</AnimatePresence>

                  {businesses.length === 0 ? (
                    <Section icon={Building2} title="Your businesses" desc="Edit the name, ID or receipt logo of any business.">
                      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${CHIP}`} style={{ background: tint(LIME, 18) }}>
                          <Building2 className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="font-heading text-[15px] font-semibold">No businesses yet</p>
                          <p className="mt-1 text-sm text-muted-foreground">Add one from the Businesses page.</p>
                        </div>
                      </div>
                    </Section>
                  ) : (
                    <>
                      {businesses.map((biz) => {
                        const isActive  = activeBusiness?.id === biz.id;
                        const isEditing = editingBizId === biz.id;
                        return (
                          <motion.section key={biz.id} layout
                            className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${isActive ? 'border-[hsl(var(--brand-leaf)/0.55)]' : 'border-border'}`}>

                            {/* Identity row */}
                            <div className="flex items-center gap-3 p-4">
                              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl font-heading text-lg font-semibold text-white"
                                style={{ background: 'linear-gradient(140deg, hsl(var(--brand-deep)), hsl(var(--brand-forest)))' }}>
                                {biz.logoUrl
                                  ? <img src={biz.logoUrl} alt={`${biz.name} logo`} className="h-full w-full bg-white object-contain p-1" />
                                  : biz.name.charAt(0)}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <p className="truncate text-[15px] font-semibold">{biz.name}</p>
                                  {isActive && (
                                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: tint(LIME, 22) }}>Active</span>
                                  )}
                                </div>
                                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{biz.businessId}</p>
                              </div>

                              <div className="flex flex-shrink-0 items-center gap-1.5">
                                <button onClick={() => (isEditing ? cancelEditBiz() : startEditBiz(biz))}
                                  aria-label={isEditing ? 'Cancel editing' : `Edit ${biz.name}`}
                                  className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition-colors ${
                                    isEditing ? 'border-border bg-muted text-muted-foreground hover:text-foreground' : 'border-border bg-background hover:bg-accent'}`}>
                                  {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4 text-muted-foreground" />}
                                  <span className="hidden sm:inline">{isEditing ? 'Cancel' : 'Edit'}</span>
                                </button>
                                <button onClick={() => { setDeleteError(null); setDeletingBiz(biz); }}
                                  disabled={businesses.length <= 1}
                                  aria-label={`Delete ${biz.name}`}
                                  title={businesses.length <= 1 ? 'You need at least one business' : 'Delete business'}
                                  className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {!isActive && (
                              <div className="border-t border-border px-4 py-2.5">
                                <button onClick={() => setActiveBusiness(biz)}
                                  className="inline-flex h-9 items-center gap-2 rounded-lg px-1 text-[13px] font-medium text-primary transition-opacity hover:opacity-80">
                                  <ArrowLeftRight className="h-4 w-4" /> Switch to this business
                                </button>
                              </div>
                            )}

                            {/* Edit panel */}
                            <AnimatePresence initial={false}>
                              {isEditing && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                  <div className="space-y-3.5 border-t border-border bg-muted/30 p-4">
                                    <TextField id={`biz-name-${biz.id}`} label="Business name" value={bizName} onChange={setBizName}
                                      placeholder="e.g. Kumasi Main Branch" icon={Building2} disabled={savingBiz} />
                                    <TextField id={`biz-code-${biz.id}`} label="Business ID" value={bizCode}
                                      onChange={(v) => setBizCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16))}
                                      placeholder="e.g. KSI-001" icon={Hash} disabled={savingBiz}
                                      hint="Up to 16 characters. Staff use this to log in." />
                                    <AnimatePresence>{editError && <Banner tone="error">{editError}</Banner>}</AnimatePresence>
                                    <div className="flex gap-2">
                                      <button onClick={cancelEditBiz} disabled={savingBiz}
                                        className="h-12 flex-1 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 sm:h-11 sm:flex-none sm:px-5">
                                        Cancel
                                      </button>
                                      <motion.button onClick={handleSaveBiz} disabled={savingBiz} whileTap={{ scale: 0.98 }}
                                        className="inline-flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-110 disabled:opacity-50 sm:h-11 sm:flex-none">
                                        {savingBiz ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        {savingBiz ? 'Saving…' : 'Save changes'}
                                      </motion.button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <LogoUploader
                              bizId={biz.id}
                              bizName={biz.name}
                              logoUrl={biz.logoUrl}
                              onUploaded={(url) => updateBusinessLogo(biz.id, url)}
                              onRemoved={() => updateBusinessLogo(biz.id, null)}
                            />
                          </motion.section>
                        );
                      })}

                      {businesses.length <= 1 && (
                        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                          You need at least one business. Add another before deleting this one.
                        </p>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* ── SECURITY ── */}
              {tab === 'security' && (
                <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <Section icon={KeyRound} title="Change password" desc="You’ll need your current password to confirm it’s you.">
                    <div className="space-y-3.5 p-4">
                      <PasswordField id="pwd-current" label="Current password" value={currentPwd} onChange={setCurrentPwd}
                        placeholder="Your current password" disabled={savingPwd} autoComplete="current-password" />

                      <div>
                        <PasswordField id="pwd-new" label="New password" value={newPwd} onChange={setNewPwd}
                          placeholder="At least 6 characters" disabled={savingPwd} autoComplete="new-password" />
                        {strength && (
                          <div className="mt-2.5">
                            <div className="grid grid-cols-4 gap-1.5">
                              {[1, 2, 3, 4].map((i) => (
                                <span key={i} className="h-1.5 rounded-full transition-colors"
                                  style={{ background: i <= strength.score ? strength.color : 'hsl(var(--muted))' }} />
                              ))}
                            </div>
                            <p className="mt-1.5 text-[11px] font-medium" style={{ color: strength.color }}>{strength.label}</p>
                            {strength.score < 4 && (
                              <p className="text-[11px] text-muted-foreground">Use 8+ characters with a capital letter and a number to make it strong.</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <PasswordField id="pwd-confirm" label="Confirm new password" value={confirmPwd} onChange={setConfirmPwd}
                          placeholder="Repeat the new password" disabled={savingPwd} autoComplete="new-password"
                          error={!!confirmPwd && newPwd !== confirmPwd} />
                        {confirmPwd && (
                          <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${newPwd === confirmPwd ? 'text-primary' : 'text-red-500'}`}>
                            {newPwd === confirmPwd
                              ? <><CheckCircle className="h-3.5 w-3.5" /> Passwords match</>
                              : <><AlertCircle className="h-3.5 w-3.5" /> Passwords don’t match yet</>}
                          </p>
                        )}
                      </div>

                      <AnimatePresence>
                        {pwdMsg && <Banner tone={pwdMsg.type}>{pwdMsg.text}</Banner>}
                      </AnimatePresence>

                      <div className="flex justify-end pt-1">
                        <motion.button onClick={handleChangePassword} disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd} whileTap={{ scale: 0.98 }}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto">
                          {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                          {savingPwd ? 'Updating…' : 'Update password'}
                        </motion.button>
                      </div>
                    </div>
                  </Section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deletingBiz && (
          <DeleteBusinessModal
            biz={deletingBiz}
            onCancel={() => { if (!deletingNow) { setDeletingBiz(null); setDeleteError(null); } }}
            onConfirm={handleConfirmDelete}
            deleting={deletingNow}
            error={deleteError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}