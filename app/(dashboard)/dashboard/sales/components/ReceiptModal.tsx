'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, MessageSquare, CheckCircle, Loader2, Banknote } from 'lucide-react';

interface CartItem {
  productId:   string;
  productName: string;
  quantity:    number;
  unitPrice:   number;
  totalPrice:  number;
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

export function ReceiptModal({ open, data, onClose, onSendSMS, sendingSMS, smsSent }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Amount the customer actually handed over — defaults to the full total,
  // editable so the cashier can record partial payment / change given.
  const [amountPaid, setAmountPaid] = useState('');

  useEffect(() => {
    if (data) {
      const t = data.items.reduce((s, i) => s + i.totalPrice, 0);
      setAmountPaid(String(t));
    }
  }, [data?.receiptNo]);

  if (!data) return null;

  const total    = data.items.reduce((s, i) => s + i.totalPrice, 0);
  const itemQty  = data.items.reduce((s, i) => s + i.quantity, 0);
  const date     = data.date instanceof Date ? data.date : new Date(data.date);
  const dateStr  = date.toLocaleDateString('en-GH', { day: '2-digit', month: 'long',  year: 'numeric' });
  const timeStr  = date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', hour12: true });

  const paidNum  = parseFloat(amountPaid) || 0;
  // Positive balance = change owed back to the customer.
  // Negative balance = customer still owes this much.
  const balance  = paidNum - total;
  const isChange = balance >= 0;

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return;

    const itemRows = data.items.map((item) => `
      <tr>
        <td class="item-name">${item.productName}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-unit">₵${item.unitPrice.toLocaleString()}</td>
        <td class="item-total">₵${item.totalPrice.toLocaleString()}</td>
      </tr>
    `).join('');

    const logoHtml = data.businessLogo
      ? `<img src="${data.businessLogo}" alt="" style="max-width:120px;max-height:56px;object-fit:contain;margin:0 auto 4px;display:block" />`
      : '';

    const balanceHtml = `
      <table class="meta-table">
        <tr><td class="dim">Amount Paid</td><td>₵${paidNum.toLocaleString()}</td></tr>
        <tr><td class="dim">${isChange ? 'Change' : 'Balance Due'}</td><td>₵${Math.abs(balance).toLocaleString()}</td></tr>
      </table>
    `;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${data.receiptNo}</title>
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
    .right   { text-align: right; }
    .bold    { font-weight: 700; }
    .dim     { color: #666; }
    .dash    { border: none; border-top: 1px dashed #999; margin: 5px 0; }
    .solid   { border: none; border-top: 2px solid #111; margin: 5px 0; }

    .logo    { font-size: 22px; font-weight: 700; letter-spacing: 2px; margin-bottom: 2px; }
    .biz     { font-size: 11px; }
    .code    { font-size: 9px; color: #888; letter-spacing: 1px; }

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
    <div class="logo">${data.businessName.toUpperCase()}</div>
    <div class="biz dim">${data.businessCode}</div>
  </div>

  <hr class="dash" />

  <table class="meta-table">
    <tr><td class="dim">Receipt No</td><td>${data.receiptNo}</td></tr>
    <tr><td class="dim">Date</td><td>${dateStr}</td></tr>
    <tr><td class="dim">Time</td><td>${timeStr}</td></tr>
    <tr><td class="dim">Customer</td><td>${data.customerName}</td></tr>
    <tr><td class="dim">Phone</td><td>${data.customerPhone}</td></tr>
    <tr><td class="dim">Served by</td><td>${data.recordedBy}</td></tr>
  </table>

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
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <hr class="solid" />

  <div class="total-row">
    <span class="total-label">TOTAL (${itemQty} item${itemQty !== 1 ? 's' : ''})</span>
    <span class="total-amt">₵${total.toLocaleString()}</span>
  </div>

  <hr class="dash" />

  ${balanceHtml}

  ${data.notes ? `<hr class="dash" /><div style="font-size:9px;color:#555">Note: ${data.notes}</div>` : ''}

  <hr class="dash" />

  <div class="footer">
    <div class="thank">Thank you for your purchase!</div>
    <div>${dateStr} · ${timeStr}</div>
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white dark:bg-gray-900 sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-white text-sm leading-tight">Sale Recorded</p>
                  <p className="text-[10px] text-gray-400 font-mono">{data.receiptNo}</p>
                </div>
              </div>
              <button onClick={onClose}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-y-auto">
              {/* Receipt preview */}
              <div ref={printRef} className="mx-4 mt-4 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 font-mono text-xs">

                {/* Business name / logo */}
                <div className="text-center mb-3">
                  {data.businessLogo && (
                    <img src={data.businessLogo} alt={data.businessName}
                      className="max-h-12 mx-auto mb-1.5 object-contain" />
                  )}
                  <p className="text-sm font-black tracking-widest text-gray-900 dark:text-white uppercase">{data.businessName}</p>
                  <p className="text-[9px] font-bold text-gray-400 tracking-wider">{data.businessCode}</p>
                </div>

                <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2" />

                {/* Meta */}
                <div className="space-y-0.5 text-[10px]">
                  {[
                    ['Receipt',  data.receiptNo],
                    ['Date',     dateStr],
                    ['Time',     timeStr],
                    ['Customer', data.customerName],
                    ['Phone',    data.customerPhone],
                    ['Served by',data.recordedBy],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-gray-400 flex-shrink-0">{label}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300 text-right truncate">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-2" />

                {/* Items header */}
                <div className="flex text-[9px] font-black uppercase tracking-wider text-gray-400 pb-1 border-b border-dashed border-gray-300 dark:border-gray-700">
                  <span className="flex-1">Item</span>
                  <span className="w-8 text-center">Qty</span>
                  <span className="w-16 text-right">Amount</span>
                </div>

                {/* Items */}
                <div className="space-y-1.5 mt-1.5">
                  {data.items.map((item) => (
                    <div key={item.productId}>
                      <div className="flex items-start gap-1">
                        <span className="flex-1 font-semibold text-gray-800 dark:text-gray-200 text-[10px] leading-tight">{item.productName}</span>
                        <span className="w-8 text-center text-[10px] text-gray-500">{item.quantity}</span>
                        <span className="w-16 text-right font-bold text-gray-900 dark:text-white text-[10px]">₵{item.totalPrice.toLocaleString()}</span>
                      </div>
                      <div className="text-[9px] text-gray-400">@ ₵{item.unitPrice.toLocaleString()} each</div>
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-gray-300 dark:border-gray-600 my-2" />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-gray-900 dark:text-white">TOTAL ({itemQty} item{itemQty !== 1 ? 's' : ''})</span>
                  <span className="text-sm font-black text-green-600 dark:text-green-400">₵{total.toLocaleString()}</span>
                </div>

                {data.notes && (
                  <p className="text-[9px] text-gray-400 mt-2 italic">Note: {data.notes}</p>
                )}

                <div className="border-t border-dashed border-gray-300 dark:border-gray-600 mt-2 pt-2 text-center text-[9px] text-gray-400">
                  Thank you for your purchase!
                </div>
              </div>

              {/* Amount paid / balance */}
              <div className="mx-4 mt-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-3.5 space-y-2.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="w-3 h-3" /> Amount Paid (₵)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all"
                />
                <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-xs font-black ${
                  isChange
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}>
                  <span>{isChange ? 'Change Due' : 'Balance Owed'}</span>
                  <span>₵{Math.abs(balance).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 pb-5 pt-3 space-y-2 flex-shrink-0">
              <button onClick={handlePrint}
                className="w-full h-11 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm">
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>

              <button
                onClick={() => onSendSMS(data)}
                disabled={sendingSMS || smsSent}
                className="w-full h-11 rounded-xl border-2 border-green-500/25 bg-green-500/8 text-green-600 dark:text-green-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {smsSent ? (
                  <><CheckCircle className="w-4 h-4" /> SMS Sent!</>
                ) : sendingSMS ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><MessageSquare className="w-4 h-4" /> Send SMS Invoice</>
                )}
              </button>

              <button onClick={onClose}
                className="w-full h-9 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}