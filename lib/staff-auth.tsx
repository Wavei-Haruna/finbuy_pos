'use client';

/**
 * Staff session helpers
 * Staff are NOT Firebase users — they authenticate via Business Name + ID.
 * Session lives in sessionStorage (cleared on tab/browser close).
 * Auto-expires at 11:00 PM every day.
 */

export interface StaffSession {
  businessId:   string;
  businessName: string;
  businessCode: string;
  loginTime:    string;
  expiresAt?:   string; // ISO string of 11pm tonight
}

/** Returns midnight of 11pm tonight */
function getTodayExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(0, 0, 0, 0);
  // If already past 11pm, expire immediately (force re-login tomorrow)
  if (new Date() >= expiry) expiry.setDate(expiry.getDate() + 1);
  return expiry;
}

export function getStaffSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('staff_session');
    if (!raw) return null;
    const session: StaffSession = JSON.parse(raw);

    // Check 11pm expiry
    if (session.expiresAt) {
      const expiry = new Date(session.expiresAt);
      if (new Date() >= expiry) {
        clearStaffSession();
        return null;
      }
    }

    return session;
  } catch { return null; }
}

export function saveStaffSession(session: Omit<StaffSession, 'expiresAt'>) {
  if (typeof window === 'undefined') return;
  const withExpiry: StaffSession = {
    ...session,
    expiresAt: getTodayExpiry().toISOString(),
  };
  sessionStorage.setItem('staff_session', JSON.stringify(withExpiry));
}

export function clearStaffSession() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('staff_session');
  }
}

/**
 * Call this once inside the staff page component.
 * Sets a timer to clear the session and redirect at 11pm.
 * Returns a cleanup function for useEffect.
 */
export function scheduleStaffLogout(onExpire: () => void): () => void {
  const now    = new Date();
  const expiry = getTodayExpiry();
  const ms     = expiry.getTime() - now.getTime();

  const timer = setTimeout(() => {
    clearStaffSession();
    onExpire();
  }, ms);

  return () => clearTimeout(timer);
}