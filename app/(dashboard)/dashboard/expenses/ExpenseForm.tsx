'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Expense, ExpenseCategory, ExpenseFrequency,
  EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORIES,
} from '@/lib/types';
import {
  Loader2, Check, CheckCircle, Calendar, Info, Pencil, X, AlertCircle, Repeat,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpenseFormProps {
  editingExpense?: Expense | null;
  submitting: boolean;
  successMessage: string;
  errorMessage?: string;
  /** Resolve true when saved. A new expense only clears the form on true. */
  onSubmit: (data: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    frequency: ExpenseFrequency;
    startDate: Date;
    endDate: Date | null;
  }) => Promise<boolean>;
  onCancelEdit?: () => void;
}

/* ───────────────────────── tokens & helpers ───────────────────────── */

const LIME = 'hsl(var(--brand-lime))';
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const fmt = (v: number) => `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;

// Nine categories need nine distinct hues, more than the brand tokens offer,
// so these stay as fixed colours. Everything else uses brand tokens.
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  salaries:    '#ef4444',
  damages:     '#f97316',
  rent:        '#f59e0b',
  utilities:   '#06b6d4',
  supplies:    '#3b82f6',
  marketing:   '#a855f7',
  transport:   '#22c55e',
  maintenance: '#eab308',
  other:       '#6b7280',
};

// Local-date helpers so the date never shifts by timezone
const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateInput = (s: string) => new Date(`${s}T00:00:00`);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const FREQUENCIES: { value: ExpenseFrequency; label: string }[] = [
  { value: 'one-time', label: 'Once' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'monthly',  label: 'Monthly' },
  { value: 'yearly',   label: 'Yearly' },
];

// Inputs are 16px on mobile so iOS never zooms the page when a field is focused.
const shell = (error?: boolean) =>
  `flex items-center rounded-xl border bg-muted/40 px-3.5 transition-all focus-within:bg-background focus-within:ring-4 ${
    error
      ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15'
      : 'border-input focus-within:border-[hsl(var(--ring))] focus-within:ring-[hsl(var(--ring)/0.15)]'}`;
const bare = 'h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:h-11 sm:text-sm';
const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

function Label({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">{children}</label>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/* ───────────────────────── form ───────────────────────── */

export function ExpenseForm({
  editingExpense, submitting, successMessage, errorMessage, onSubmit, onCancelEdit,
}: ExpenseFormProps) {
  const [category, setCategory]       = useState<ExpenseCategory>('salaries');
  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [frequency, setFrequency]     = useState<ExpenseFrequency>('one-time');
  const [startDate, setStartDate]     = useState(toDateInput(new Date()));
  const [hasEndDate, setHasEndDate]   = useState(false);
  const [endDate, setEndDate]         = useState(toDateInput(new Date()));

  const resetForm = () => {
    setCategory('salaries');
    setDescription('');
    setAmount('');
    setFrequency('one-time');
    setStartDate(toDateInput(new Date()));
    setHasEndDate(false);
    setEndDate(toDateInput(new Date()));
  };

  useEffect(() => {
    if (!editingExpense) { resetForm(); return; }
    setCategory(editingExpense.category);
    setDescription(editingExpense.description);
    setAmount(String(editingExpense.amount));
    setFrequency(editingExpense.frequency);
    setStartDate(toDateInput(editingExpense.startDate));
    setHasEndDate(!!editingExpense.endDate);
    if (editingExpense.endDate) setEndDate(toDateInput(editingExpense.endDate));
  }, [editingExpense]);

  const isRecurring = frequency !== 'one-time';
  const numAmount   = parseFloat(amount);
  const validAmount = !!numAmount && numAmount > 0;
  const endBeforeStart = isRecurring && hasEndDate && endDate < startDate; // YYYY-MM-DD compares correctly as text
  const canSubmit = !submitting && description.trim().length > 0 && validAmount && !endBeforeStart;

  // Plain-language cost preview for recurring expenses
  const hint =
    !validAmount ? null
    : frequency === 'weekly'  ? `About ${fmt((numAmount * 52) / 12)} every month`
    : frequency === 'yearly'  ? `About ${fmt(numAmount / 12)} every month`
    : frequency === 'monthly' ? `About ${fmt(numAmount * 12)} a year`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const ok = await onSubmit({
      category,
      description: description.trim(),
      amount: numAmount,
      frequency,
      startDate: fromDateInput(startDate),
      endDate: isRecurring && hasEndDate ? fromDateInput(endDate) : null,
    });

    // Only clear when it really saved, so a failed save never loses what was typed.
    // (After an edit, the page clears editingExpense and the effect above resets the form.)
    if (ok && !editingExpense) resetForm();
  };

  const todayStr     = toDateInput(new Date());
  const yesterdayStr = toDateInput(daysAgo(1));

  const submitLabel =
    submitting ? null
    : !description.trim() ? 'Describe the expense to continue'
    : !validAmount ? 'Enter the amount to continue'
    : endBeforeStart ? 'End date is before the start date'
    : null;

  /* ─────────────────────── render ─────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>

      {/* Banners */}
      <AnimatePresence>
        {editingExpense && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: tint(LIME, 16) }}>
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <Pencil className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="truncate">Editing “{editingExpense.description}”</span>
              </span>
              {onCancelEdit && (
                <button type="button" onClick={onCancelEdit} aria-label="Stop editing"
                  className="-mr-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
        {successMessage && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div role="status" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium" style={{ background: tint(LIME, 16) }}>
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

      {/* Category */}
      <div>
        <Label>Category</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
          {EXPENSE_CATEGORIES.map((c) => {
            const active = category === c;
            const color  = CATEGORY_COLORS[c];
            return (
              <button key={c} type="button" role="radio" aria-checked={active} onClick={() => setCategory(c)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all ${
                  active ? 'text-foreground' : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
                style={active ? { background: tint(color, 14), borderColor: color } : undefined}>
                {active
                  ? <Check className="h-3.5 w-3.5" style={{ color }} />
                  : <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
                {EXPENSE_CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>

        {category === 'damages' && (
          <div className="mt-2.5 flex gap-2 rounded-xl bg-accent px-3.5 py-3 text-xs text-accent-foreground">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Damaged or missing stock? Log it on the{' '}
              <Link href="/dashboard/damages" className="font-semibold underline underline-offset-2">Damages page</Link>{' '}
              so your stock count updates too.
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="exp-desc">Description</Label>
        <div className={shell(false)}>
          <input id="exp-desc" type="text" value={description} autoComplete="off"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Kwame’s monthly salary" className={bare} />
        </div>
      </div>

      {/* Amount */}
      <div>
        <Label htmlFor="exp-amount">Amount</Label>
        <div className={shell(false)}>
          <span className="mr-2 text-sm font-semibold text-muted-foreground">₵</span>
          <input id="exp-amount" type="number" inputMode="decimal" step="0.01" min="0" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            className={`${bare} ${noSpin} font-heading font-semibold tabular-nums`} />
        </div>
        {hint && <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>

      {/* Frequency */}
      <div>
        <Label>
          <span className="inline-flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5 text-muted-foreground" /> How often</span>
        </Label>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Frequency">
          {FREQUENCIES.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={frequency === f.value} onClick={() => setFrequency(f.value)}
              className={`h-10 rounded-lg text-[13px] font-medium transition-all ${
                frequency === f.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <Label htmlFor="exp-date">{isRecurring ? 'Starts on' : 'Date'}</Label>
        <div className={shell(false)}>
          <Calendar className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <input id="exp-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={bare} />
        </div>
        <div className="mt-2 flex gap-2">
          {[['Today', todayStr], ['Yesterday', yesterdayStr]].map(([label, val]) => (
            <button key={label} type="button" onClick={() => setStartDate(val)}
              className={`h-8 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                startDate === val ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* End date: recurring only */}
      <AnimatePresence initial={false}>
        {isRecurring && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">This expense has ended</p>
                  <p className="text-[11px] text-muted-foreground">For example: staff left, contract ended</p>
                </div>
                <Switch checked={hasEndDate} onChange={setHasEndDate} label="Expense has ended" />
              </div>
              <AnimatePresence initial={false}>
                {hasEndDate && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="pt-3">
                      <Label htmlFor="exp-end">Ended on</Label>
                      <div className={shell(endBeforeStart)}>
                        <Calendar className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <input id="exp-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={bare} />
                      </div>
                      {endBeforeStart && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
                          <AlertCircle className="h-3.5 w-3.5" /> The end date can’t be before the start date.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit (sticks to the bottom on mobile) */}
      <div className="sticky bottom-3 z-10 flex gap-2">
        {editingExpense && onCancelEdit && (
          <button type="button" onClick={onCancelEdit}
            className="h-14 flex-1 rounded-2xl border border-border bg-card px-4 text-[15px] font-medium shadow-lg transition-colors hover:bg-accent sm:h-12 sm:text-sm">
            Cancel
          </button>
        )}
        <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={!canSubmit}
          className="inline-flex h-14 flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-lg transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:text-sm">
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : submitLabel ? (
            submitLabel
          ) : (
            <>{editingExpense ? 'Update expense' : 'Add expense'} · {fmt(numAmount)}</>
          )}
        </motion.button>
      </div>
    </form>
  );
}