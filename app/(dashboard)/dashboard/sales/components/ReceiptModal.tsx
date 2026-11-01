'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, MessageSquare, CheckCircle, Loader2, Banknote } from 'lucide-react';

interface CartItem {
  productId:   string;
  productName: string;
  quantity:    number;
  unitPrice:   number;
  totalPrice:  number;
  saleType?:   'piece' | 'box';
  boxQty?:     number;
}

interface ReceiptData {
  items:         CartItem[];
  customerName:  string;
  customerPhone: string;
  notes:         string;
  businessName:  string;
  businessCode:  string;
  businessLogo?: string;
  recordedBy:    string;
  receiptNo:     string;
  date:          Date;
}

interface ReceiptModalProps {
  open:       boolean;
  data:       ReceiptData | null;
  onClose:    () => void;
  onSendSMS:  (data: ReceiptData) => Promise<void>;
  sendingSMS: boolean;
  smsSent:    boolean;
}

const LIME = 'hsl(var(--brand-lime))';
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const MONEY = 'text-[hsl(var(--brand-emerald))] dark:text-[hsl(var(--brand-lime))]';
const fmt = (n: number) => `₵${n.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;

// Everything that goes into the print window is escaped, so a product or customer name can never break the page
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function ReceiptModal({ open, data, onClose, onSendSMS, sendingSMS, smsSent }: ReceiptModalProps) {
  // Amount the customer actually handed over. Defaults to the full total and stays editable
  // so the cashier can record change given or a part payment.
  const [amountPaid, setAmountPaid] = useState('');

  const total = (data?.items ?? []).reduce((s, i) => s + i.totalPrice, 0);

  useEffect(() => {
    if (data) setAmountPaid(String(data.items.reduce((s, i) => s + i.totalPrice, 0)));
  }, [data?.receiptNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick cash buttons: exact, then the next round notes above the total
  const quickAmounts = useMemo(() => {
    if (total <= 0) return [];
    const set = new Set<number>([total]);
    for (const step of [10, 50, 100, 200]) set.add(Math.ceil(total / step) * step);
    return [...set].sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  if (!data) return null;

  const itemQty = data.items.reduce((s, i) => s + i.quantity, 0);
  const date    = data.date instanceof Date ? data.date : new Date(data.date);
  const dateStr = date.toLocaleDateString('en-GH', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', hour12: true });

  const paidNum  = parseFloat(amountPaid) || 0;
  // Positive balance = change owed to the customer. Negative = customer still owes this much.
  const balance  = paidNum - total;
  const isChange = balance >= 0;

  const customerLabel = data.customerName?.trim() || 'Walk-in customer';
  const metaRows: [string, string][] = [
    ['Receipt',   data.receiptNo],
    ['Date',      dateStr],
    ['Time',      timeStr],
    ['Customer',  customerLabel],
    ...(data.customerPhone ? [['Phone', data.customerPhone] as [string, string]] : []),
    ['Served by', data.recordedBy],
  ];

  const unitLabel = (i: CartItem) => (i.saleType === 'box' ? `per box (${i.boxQty ?? '?'} pcs)` : 'each');

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return;

    const itemRows = data.items.map((item) => `
      <tr>
        <td class="item-name">${esc(item.productName)}${item.saleType === 'box' ? `<div class="sub">Box × ${esc(item.boxQty ?? '')}</div>` : ''}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-unit">₵${item.unitPrice.toLocaleString()}</td>
        <td class="item-total">₵${item.totalPrice.toLocaleString()}</td>
      </tr>
    `).join('');

    const logoHtml = data.businessLogo
      ? `<img src="${esc(data.businessLogo)}" alt="" style="max-width:120px;max-height:56px;object-fit:contain;margin:0 auto 4px;display:block" />`
      : '';

    const metaHtml = metaRows.map(([k, v]) => `<tr><td class="dim">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${esc(data.receiptNo)}</title>
  <meta charset="utf-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 11px;
      color: #111;
      background: #fff;
      width: 80mm;
      margin: 0 auto;
      padding: 6mm 5mm;
    }
    .center  { text-align: center; }
    .dim     { color: #666; }
    .dash    { border: none; border-top: 1px dashed #999; margin: 5px 0; }
    .solid   { border: none; border-top: 2px solid #111; margin: 5px 0; }

    .logo    { font-size: 22px; font-weight: 700; letter-spacing: 2px; margin-bottom: 2px; }
    .biz     { font-size: 11px; }

    .meta-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .meta-table td { padding: 1.5px 0; }
    .meta-table td:last-child { text-align: right; font-weight: 600; }

    .items   { width: 100%; border-collapse: collapse; font-size: 10px; }
    .items th { text-align: left; padding: 2px 0; border-bottom: 1px dashed #ccc; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
    .items td { padding: 3px 0; vertical-align: top; }
    .item-name  { width: 50%; }
    .item-qty   { width: 12%; text-align: center; }
    .item-unit  { width: 18%; text-align: right; color: #555; }
    .item-total { width: 20%; text-align: right; font-weight: 600; }
    .sub        { font-size: 9px; color: #777; }

    .total-row  { display: flex; justify-content: space-between; align-items: center; }
    .total-label{ font-size: 13px; font-weight: 700; }
    .total-amt  { font-size: 16px; font-weight: 700; }

    .footer { margin-top: 10px; text-align: center; font-size: 9px; color: #888; line-height: 1.6; }
    .thank  { font-size: 11px; font-weight: 600; color: #333; margin-bottom: 2px; }

    @media print {
      body { padding: 0; }
      @page { margin: 4mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:8px">
    ${logoHtml}
    <div class="logo">${esc(data.businessName.toUpperCase())}</div>
    <div class="biz dim">${esc(data.businessCode)}</div>
  </div>

  <hr class="dash" />

  <table class="meta-table">${metaHtml}</table>

  <hr class="dash" />

  <table class="items">
    <thead>
      <tr>
        <th class="item-name">Item</th>
        <th class="item-qty">Qty</th>
        <th class="item-unit">Price</th>
        <th class="item-total">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="solid" />

  <div class="total-row">
    <span class="total-label">TOTAL (${itemQty} item${itemQty !== 1 ? 's' : ''})</span>
    <span class="total-amt">₵${total.toLocaleString()}</span>
  </div>

  <hr class="dash" />

  <table class="meta-table">
    <tr><td class="dim">Amount Paid</td><td>₵${paidNum.toLocaleString()}</td></tr>
    <tr><td class="dim">${isChange ? 'Change' : 'Balance Due'}</td><td>₵${Math.abs(balance).toLocaleString()}</td></tr>
  </table>

  ${data.notes ? `<hr class="dash" /><div style="font-size:9px;color:#555">Note: ${esc(data.notes)}</div>` : ''}

  <hr class="dash" />

  <div class="footer">
    <div class="thank">Thank you for your purchase!</div>
    <div>${esc(dateStr)} · ${esc(timeStr)}</div>
  </div>
</body>
</html>`);

    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--brand-deep)/0.7)] backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="Sale receipt"
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:max-w-md sm:rounded-3xl"
          >
            {/* Grab handle (mobile) */}
            <div className="flex justify-center pt-2.5 sm:hidden">
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: tint(LIME, 20) }}>
                  <CheckCircle className="h-5 w-5 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-base font-semibold leading-tight">Sale recorded</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{data.receiptNo}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={`font-heading text-xl font-semibold tabular-nums ${MONEY}`}>{fmt(total)}</p>
                <button onClick={onClose} aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto overscroll-contain px-4 pb-3">
              {/* Receipt preview */}
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 font-mono text-xs">
                <div className="mb-3 text-center">
                  {data.businessLogo && (
                    <img src={data.businessLogo} alt={data.businessName} className="mx-auto mb-1.5 max-h-12 object-contain" />
                  )}
                  <p className="font-heading text-sm font-semibold uppercase tracking-widest">{data.businessName}</p>
                  <p className="text-[10px] font-medium tracking-wider text-muted-foreground">{data.businessCode}</p>
                </div>

                <div className="my-2 border-t border-dashed border-border" />

                <div className="space-y-1 text-[11px]">
                  {metaRows.map(([label, val]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <span className="flex-shrink-0 text-muted-foreground">{label}</span>
                      <span className="truncate text-right font-semibold">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="my-2 border-t border-dashed border-border" />

                <div className="flex border-b border-dashed border-border pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex-1">Item</span>
                  <span className="w-8 text-center">Qty</span>
                  <span className="w-20 text-right">Amount</span>
                </div>

                <div className="mt-2 space-y-2">
                  {data.items.map((item) => (
                    <div key={`${item.productId}-${item.saleType ?? 'piece'}`}>
                      <div className="flex items-start gap-1">
                        <span className="flex-1 text-[11px] font-semibold leading-tight">{item.productName}</span>
                        <span className="w-8 text-center text-[11px] text-muted-foreground">{item.quantity}</span>
                        <span className="w-20 text-right text-[11px] font-bold tabular-nums">{fmt(item.totalPrice)}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">@ {fmt(item.unitPrice)} {unitLabel(item)}</div>
                    </div>
                  ))}
                </div>

                <div className="my-2.5 border-t-2 border-border" />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">TOTAL ({itemQty} item{itemQty !== 1 ? 's' : ''})</span>
                  <span className={`text-sm font-bold tabular-nums ${MONEY}`}>{fmt(total)}</span>
                </div>

                {data.notes && <p className="mt-2 text-[10px] italic text-muted-foreground">Note: {data.notes}</p>}

                <div className="mt-2.5 border-t border-dashed border-border pt-2.5 text-center text-[10px] text-muted-foreground">
                  Thank you for your purchase!
                </div>
              </div>

              {/* Amount paid / balance */}
              <div className="space-y-3 rounded-2xl border border-border p-3.5">
                <label htmlFor="amount-paid" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" /> Amount paid
                </label>

                <div className="flex items-center rounded-xl border border-input bg-muted/40 px-3.5 transition-all focus-within:border-[hsl(var(--ring))] focus-within:bg-background focus-within:ring-4 focus-within:ring-[hsl(var(--ring)/0.15)]">
                  <span className="mr-2 text-sm font-semibold text-muted-foreground">₵</span>
                  <input id="amount-paid" type="number" inputMode="decimal" min="0" step="0.01" value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="h-12 min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:h-11" />
                </div>

                {quickAmounts.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((amt, i) => {
                      const active = paidNum === amt;
                      return (
                        <button key={amt} type="button" onClick={() => setAmountPaid(String(amt))}
                          className={`h-9 rounded-full border px-3.5 text-[13px] font-medium tabular-nums transition-colors ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}>
                          {i === 0 ? 'Exact' : fmt(amt)}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${
                  isChange ? '' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}
                  style={isChange ? { background: tint(LIME, 14) } : undefined}>
                  <span className="text-[13px] font-medium">{isChange ? 'Change due' : 'Balance owed'}</span>
                  <span className={`font-heading text-lg font-semibold tabular-nums ${isChange ? MONEY : ''}`}>{fmt(Math.abs(balance))}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 space-y-2 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button onClick={handlePrint}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-110">
                <Printer className="h-4 w-4" /> Print receipt
              </button>

              <button onClick={() => onSendSMS(data)} disabled={sendingSMS || smsSent}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
                {smsSent ? (
                  <><CheckCircle className="h-4 w-4 text-primary" /> SMS sent</>
                ) : sendingSMS ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <><MessageSquare className="h-4 w-4 text-muted-foreground" /> Send SMS invoice</>
                )}
              </button>

              <button onClick={onClose}
                className="h-10 w-full rounded-xl text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}