'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase'; // assumes you export Firebase Auth as `auth`
import { useBusiness } from '@/lib/business-context';
import { useAuth } from '@/lib/auth-context';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'How much did we spend this month?',
  'What are our biggest expenses?',
  'Which products are running low?',
  'Who owes us money?',
];

export function AskPanel() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Only Firebase-authed admins/managers can use it (staff have no ID token).
  if (!user || !activeBusiness || (user.role !== 'admin' && user.role !== 'manager')) return null;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next); setInput(''); setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId: activeBusiness.id, businessName: activeBusiness.name, messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: 'assistant', content: res.ok ? data.reply : 'Sorry, I could not answer that right now.' }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Network problem. Please try again.' }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      {/* Icon tab pinned to the far right edge of the whole app */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask about your business"
          title="Ask about your business"
          className="group fixed right-0 top-1/2 z-40 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-l-2xl bg-primary text-primary-foreground shadow-lg transition-all hover:w-14 hover:opacity-95"
        >
          <Sparkles className="h-5 w-5" />
          <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-lime ring-2 ring-background" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-extrabold text-foreground">Ask about {activeBusiness.name}</h2>
                <p className="text-xs text-muted-foreground">Answers come from your own data</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="block w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-accent">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
                  <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    {m.content}
                  </p>
                </div>
              ))}
              {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <div ref={endRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-border p-4">
              <input
                value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about sales, stock, expenses…"
                className="flex-1 rounded-xl border border-input bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button disabled={busy || !input.trim()} aria-label="Send"
                className="rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}