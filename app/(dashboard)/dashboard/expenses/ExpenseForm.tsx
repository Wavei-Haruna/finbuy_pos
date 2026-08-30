'use client';

import { useState, useEffect } from 'react';
import { Expense, ExpenseCategory, ExpenseFrequency, EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/types';
import { Loader2, Check, Repeat, Calendar } from 'lucide-react';

interface ExpenseFormProps {
  editingExpense?: Expense | null;
  submitting: boolean;
  successMessage: string;
  onSubmit: (data: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    frequency: ExpenseFrequency;
    startDate: Date;
    endDate: Date | null;
  }) => Promise<void>;
  onCancelEdit?: () => void;
}

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

export function ExpenseForm({ editingExpense, submitting, successMessage, onSubmit, onCancelEdit }: ExpenseFormProps) {
  const [category, setCategory]     = useState<ExpenseCategory>('salaries');
  const [description, setDescription] = useState('');
  const [amount, setAmount]         = useState('');
  const [frequency, setFrequency]   = useState<ExpenseFrequency>('one-time');
  const [startDate, setStartDate]   = useState(toDateInput(new Date()));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate]       = useState(toDateInput(new Date()));

  useEffect(() => {
    if (!editingExpense) return;
    setCategory(editingExpense.category);
    setDescription(editingExpense.description);
    setAmount(String(editingExpense.amount));
    setFrequency(editingExpense.frequency);
    setStartDate(toDateInput(editingExpense.startDate));
    setHasEndDate(!!editingExpense.endDate);
    if (editingExpense.endDate) setEndDate(toDateInput(editingExpense.endDate));
  }, [editingExpense]);

  const resetForm = () => {
    setCategory('salaries');
    setDescription('');
    setAmount('');
    setFrequency('one-time');
    setStartDate(toDateInput(new Date()));
    setHasEndDate(false);
    setEndDate(toDateInput(new Date()));
  };

  const isRecurring = frequency !== 'one-time';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || !numAmount || numAmount <= 0) return;

    await onSubmit({
      category,
      description: description.trim(),
      amount: numAmount,
      frequency,
      startDate: new Date(startDate),
      endDate: isRecurring && hasEndDate ? new Date(endDate) : null,
    });

    if (!editingExpense) resetForm();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Kwame's monthly salary"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
          required
        />
      </div>

      {/* Amount */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Amount (₵)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
          required
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Repeat className="w-3 h-3" /> Frequency
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {(['one-time', 'weekly', 'monthly', 'yearly'] as ExpenseFrequency[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={`py-2 rounded-lg text-[11px] font-bold capitalize transition-colors ${
                frequency === f
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f === 'one-time' ? 'Once' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Start date */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Calendar className="w-3 h-3" /> {isRecurring ? 'Starts on' : 'Date'}
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
          required
        />
      </div>

      {/* End date — recurring only */}
      {isRecurring && (
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hasEndDate}
              onChange={(e) => setHasEndDate(e.target.checked)}
              className="rounded border-gray-300 text-red-500 focus:ring-red-500/30"
            />
            This expense has ended (e.g. staff left, contract ended)
          </label>
          {hasEndDate && (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
            />
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {editingExpense && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : editingExpense ? 'Update Expense' : 'Add Expense'}
        </button>
      </div>

      {successMessage && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400">
          <Check className="w-3.5 h-3.5" /> {successMessage}
        </p>
      )}
    </form>
  );
}
