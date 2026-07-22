'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import {
  User, Phone, Lock, Save, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2, ShieldCheck,
  KeyRound, Bell, Building2, Hash, Edit2, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

function InputField({
  label, value, onChange, type = 'text', placeholder, icon, disabled, hint, rightElement,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; icon: React.ReactNode;
  disabled?: boolean; hint?: string; rightElement?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        {icon} {label}
      </label>
      <div className="relative">
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className="w-full h-11 px-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400 placeholder:font-normal"
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
        type === 'success'
          ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
          : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
      }`}>
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const { businesses, updateBusiness } = useBusiness();

  // ── Profile ────────────────────────────────────────────────────────────
  const [name,          setName]          = useState('');
  const [phone,         setPhone]         = useState('');
  const [profileMsg,    setProfileMsg]    = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Password ───────────────────────────────────────────────────────────
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdMsg,      setPwdMsg]      = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savingPwd,   setSavingPwd]   = useState(false);

  // ── Business editing ───────────────────────────────────────────────────
  const [editingBizId, setEditingBizId] = useState<string | null>(null); // Firestore doc id being edited
  const [bizName,      setBizName]      = useState('');
  const [bizCode,      setBizCode]      = useState('');
  const [bizMsg,       setBizMsg]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savingBiz,    setSavingBiz]    = useState(false);

  useEffect(() => {
    if (user) { setName(user.name || ''); setPhone(user.phone || ''); }
  }, [user]);

  const flash = (
    setter: (v: { text: string; type: 'success' | 'error' } | null) => void,
    text: string, type: 'success' | 'error'
  ) => { setter({ text, type }); setTimeout(() => setter(null), 4000); };

  // ── Profile save ───────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!name.trim()) { flash(setProfileMsg, 'Name cannot be empty.', 'error'); return; }
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      flash(setProfileMsg, 'Profile updated successfully.', 'success');
    } catch (err: any) {
      flash(setProfileMsg, err.message || 'Failed to update profile.', 'error');
    } finally { setSavingProfile(false); }
  };

  // ── Password change ────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPwd)           { flash(setPwdMsg, 'Enter your current password.', 'error'); return; }
    if (newPwd.length < 6)     { flash(setPwdMsg, 'New password must be at least 6 characters.', 'error'); return; }
    if (newPwd !== confirmPwd) { flash(setPwdMsg, 'Passwords do not match.', 'error'); return; }
    if (newPwd === currentPwd) { flash(setPwdMsg, 'New password must differ from current.', 'error'); return; }
    setSavingPwd(true);
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      flash(setPwdMsg, 'Password changed successfully.', 'success');
    } catch (err: any) {
      flash(setPwdMsg, err.message || 'Failed to change password.', 'error');
    } finally { setSavingPwd(false); }
  };

  // ── Business edit ──────────────────────────────────────────────────────
  const startEditBiz = (biz: { id: string; name: string; businessId: string }) => {
    setEditingBizId(biz.id);
    setBizName(biz.name);
    setBizCode(biz.businessId);
    setBizMsg(null);
  };

  const cancelEditBiz = () => { setEditingBizId(null); setBizName(''); setBizCode(''); };

  const handleSaveBiz = async () => {
    if (!bizName.trim()) { flash(setBizMsg, 'Business name cannot be empty.', 'error'); return; }
    if (!bizCode.trim()) { flash(setBizMsg, 'Business ID cannot be empty.', 'error'); return; }
    if (!editingBizId)   return;

    // Check for duplicate businessId (excluding current)
    const isDupe = businesses.some(
      (b) => b.id !== editingBizId && b.businessId.toLowerCase() === bizCode.trim().toLowerCase()
    );
    if (isDupe) { flash(setBizMsg, 'Another business already uses this ID.', 'error'); return; }

    setSavingBiz(true);
    try {
      await updateBusiness(editingBizId, bizName.trim(), bizCode.trim().toUpperCase());
      flash(setBizMsg, 'Business updated successfully.', 'success');
      setEditingBizId(null);
    } catch (err: any) {
      flash(setBizMsg, err.message || 'Failed to update business.', 'error');
    } finally { setSavingBiz(false); }
  };

  const pwdStrength = (pwd: string) => {
    if (!pwd) return null;
    if (pwd.length < 6) return { label: 'Too short', color: 'bg-red-500',    w: 'w-1/4' };
    if (pwd.length < 8) return { label: 'Weak',      color: 'bg-orange-500', w: 'w-2/4' };
    if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd))
                        return { label: 'Fair',       color: 'bg-yellow-500', w: 'w-3/4' };
    return              { label: 'Strong',    color: 'bg-green-500',  w: 'w-full' };
  };

  const strength = pwdStrength(newPwd);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="h-[2px] w-full bg-gradient-to-r from-green-500 via-green-400 to-transparent" />

      <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-6 pb-12">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-bold text-green-500 uppercase tracking-[0.15em] mb-1">Account</p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Settings<span className="text-gray-300 dark:text-gray-600">.</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage your profile, businesses and account security</p>
        </motion.div>

        {/* Account info badge */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-green-500/20 flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-900 dark:text-white truncate">{user?.name || '—'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <ShieldCheck className="w-3 h-3 text-green-500" />
              <span className="text-xs font-bold text-green-600 dark:text-green-400 capitalize">{user?.role || 'admin'}</span>
            </div>
          </div>
        </motion.div>

        {/* ── Profile Card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader icon={<User className="w-4 h-4" />} title="Profile" sub="Update your name and SMS notification number" />
            <div className="p-5 space-y-4">
              <InputField
                label="Full Name" value={name} onChange={setName}
                placeholder="Your full name" icon={<User className="w-3 h-3" />}
                disabled={savingProfile}
              />
              <InputField
                label="Phone Number (SMS Notifications)"
                value={phone} onChange={setPhone} type="tel"
                placeholder="e.g. 0551837449"
                icon={<Phone className="w-3 h-3" />}
                disabled={savingProfile}
                hint="Admin copy of every sale SMS will be sent to this number"
              />
              <AnimatePresence>{profileMsg && <Toast msg={profileMsg.text} type={profileMsg.type} />}</AnimatePresence>
              <div className="flex justify-end pt-1">
                <motion.button onClick={handleSaveProfile} disabled={savingProfile} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-lg shadow-green-500/20">
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingProfile ? 'Saving…' : 'Save Profile'}
                </motion.button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* SMS info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <Bell className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">SMS Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Every sale recorded by admin or staff sends an SMS copy to the phone number above.
                {user?.phone
                  ? <> Currently set to <span className="font-bold text-gray-700 dark:text-gray-300">{user.phone}</span>.</>
                  : <span className="text-orange-500 font-semibold"> No number set yet — add one above to receive sale alerts.</span>
                }
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Businesses Card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card>
            <CardHeader
              icon={<Building2 className="w-4 h-4" />}
              title="Your Businesses"
              sub="Edit the name or ID of any registered business"
            />
            <div className="p-5 space-y-3">

              {businesses.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-center">
                  <Building2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm font-bold text-gray-400">No businesses yet</p>
                  <p className="text-xs text-gray-400">Add one from the Businesses page</p>
                </div>
              ) : (
                <>
                  <AnimatePresence>{bizMsg && <Toast msg={bizMsg.text} type={bizMsg.type} />}</AnimatePresence>

                  {businesses.map((biz) => (
                    <motion.div key={biz.id} layout
                      className="rounded-xl border-2 border-gray-100 dark:border-gray-800 overflow-hidden">

                      {/* Business row */}
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                          {biz.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{biz.name}</p>
                          <p className="text-[11px] font-mono text-gray-400">{biz.businessId}</p>
                        </div>
                        <button
                          onClick={() => editingBizId === biz.id ? cancelEditBiz() : startEditBiz(biz)}
                          className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all ${
                            editingBizId === biz.id
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                          }`}>
                          {editingBizId === biz.id
                            ? <><X className="w-3.5 h-3.5" /> Cancel</>
                            : <><Edit2 className="w-3.5 h-3.5" /> Edit</>}
                        </button>
                      </div>

                      {/* Inline edit form */}
                      <AnimatePresence>
                        {editingBizId === biz.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-3 bg-gray-50 dark:bg-gray-800/40">
                              <InputField
                                label="Business Name" value={bizName} onChange={setBizName}
                                placeholder="e.g. Kumasi Main Branch"
                                icon={<Building2 className="w-3 h-3" />} disabled={savingBiz}
                              />
                              <InputField
                                label="Business ID" value={bizCode}
                                onChange={(v) => setBizCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16))}
                                placeholder="e.g. KSI-001"
                                icon={<Hash className="w-3 h-3" />} disabled={savingBiz}
                                hint="Max 16 chars · used by staff to log in"
                              />
                              <div className="flex justify-end">
                                <motion.button onClick={handleSaveBiz} disabled={savingBiz} whileTap={{ scale: 0.97 }}
                                  className="flex items-center gap-2 px-4 h-9 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors shadow-md shadow-green-500/20">
                                  {savingBiz ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                  {savingBiz ? 'Saving…' : 'Save Changes'}
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── Change Password Card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }}>
          <Card>
            <CardHeader icon={<KeyRound className="w-4 h-4" />} title="Change Password" sub="Re-authentication required for security" />
            <div className="p-5 space-y-4">

              <InputField
                label="Current Password" value={currentPwd} onChange={setCurrentPwd}
                type={showCurrent ? 'text' : 'password'} placeholder="••••••••"
                icon={<Lock className="w-3 h-3" />} disabled={savingPwd}
                rightElement={
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} tabIndex={-1}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <div className="space-y-1.5">
                <InputField
                  label="New Password" value={newPwd} onChange={setNewPwd}
                  type={showNew ? 'text' : 'password'} placeholder="Min. 6 characters"
                  icon={<Lock className="w-3 h-3" />} disabled={savingPwd}
                  rightElement={
                    <button type="button" onClick={() => setShowNew(!showNew)} tabIndex={-1}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                {strength && (
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.w}`} />
                    </div>
                    <p className={`text-[10px] font-bold ${
                      strength.label === 'Strong' ? 'text-green-500' :
                      strength.label === 'Fair'   ? 'text-yellow-500' : 'text-red-500'
                    }`}>{strength.label}</p>
                  </div>
                )}
              </div>

              <InputField
                label="Confirm New Password" value={confirmPwd} onChange={setConfirmPwd}
                type={showConfirm ? 'text' : 'password'} placeholder="Repeat new password"
                icon={<Lock className="w-3 h-3" />} disabled={savingPwd}
                rightElement={
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {confirmPwd && (
                <p className={`text-xs font-semibold flex items-center gap-1.5 ${
                  newPwd === confirmPwd ? 'text-green-500' : 'text-red-400'
                }`}>
                  {newPwd === confirmPwd
                    ? <><CheckCircle className="w-3.5 h-3.5" /> Passwords match</>
                    : <><AlertCircle className="w-3.5 h-3.5" /> Passwords do not match</>}
                </p>
              )}

              <AnimatePresence>{pwdMsg && <Toast msg={pwdMsg.text} type={pwdMsg.type} />}</AnimatePresence>

              <div className="flex justify-end pt-1">
                <motion.button onClick={handleChangePassword} disabled={savingPwd} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-lg shadow-green-500/20">
                  {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {savingPwd ? 'Updating…' : 'Update Password'}
                </motion.button>
              </div>
            </div>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}