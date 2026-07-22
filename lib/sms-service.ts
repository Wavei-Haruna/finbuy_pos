// lib/sms-service.ts — Africa's Talking SMS Integration

interface SendSMSParams {
  phoneNumber: string;
  message:     string;
}

interface SMSResponse {
  success: boolean;
  message: string;
  data?:   any;
}

export async function sendSMS({ phoneNumber, message }: SendSMSParams): Promise<SMSResponse> {
  try {
    const API_KEY  = process.env.AFRICASTALKING_API_KEY;
    const USERNAME = process.env.AFRICASTALKING_USERNAME;
    const API_URL  = process.env.AFRICASTALKING_SMS_ENDPOINT || 'https://api.africastalking.com/version1/messaging';
    const SENDER   = process.env.AFRICASTALKING_SENDER_ID || '';

    if (!API_KEY || !USERNAME) throw new Error("Africa's Talking credentials not configured");

    // Normalise to E.164 — Ghana (+233)
    let phone = phoneNumber.replace(/[\s\-()]/g, '');
    if (phone.startsWith('0'))  phone = '+233' + phone.slice(1);
    if (!phone.startsWith('+')) phone = '+' + phone;

    const params: Record<string, string> = { username: USERNAME, to: phone, message };
    if (SENDER) params.from = SENDER;

    const res  = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'apiKey': API_KEY, 'Accept': 'application/json' },
      body:    new URLSearchParams(params),
    });

    const data = await res.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];

    if (recipient && recipient.status !== 'Success') throw new Error(recipient.status || 'Send failed');
    return { success: true, message: 'SMS sent', data };
  } catch (err: any) {
    console.error('[SMS]', err.message);
    return { success: false, message: err.message };
  }
}

// ── Message templates ──────────────────────────────────────────────────────

export interface InvoiceParams {
  customerName:  string;
  customerPhone: string;
  items:         { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  totalAmount:   number;
  businessName:  string;
  businessPhone?: string;
  receiptNo:     string;
  recordedBy?:   string;
  date?:         Date;
  notes?:        string;
}

/** Production-level customer invoice SMS */
export function buildCustomerSMS(p: InvoiceParams): string {
  const d    = p.date ?? new Date();
  const fmt  = d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });

  const itemLines = p.items
    .map((i) => `  ${i.name} x${i.quantity}  GH₵${i.totalPrice.toLocaleString()}`)
    .join('\n');

  return `SALES RECEIPT - ${p.businessName}
================================
Date: ${fmt}, ${time}
Receipt: ${p.receiptNo}
--------------------------------
Customer: ${p.customerName}
Phone: ${p.customerPhone}
--------------------------------
ITEMS:
${itemLines}
--------------------------------
TOTAL: GH₵${p.totalAmount.toLocaleString()}
================================
${p.notes ? `Note: ${p.notes}\n` : ''}Served by: ${p.recordedBy ?? 'Staff'}
${p.businessPhone ? `Contact: ${p.businessPhone}` : ''}

Thank you for your business!
${p.businessName}`;
}

/** Admin copy — concise alert format */
export function buildAdminSMS(p: InvoiceParams): string {
  const d    = p.date ?? new Date();
  const fmt  = d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });

  const summary = p.items
    .map((i) => `${i.name} x${i.quantity}`)
    .join(', ');

  return `[SALE ALERT] ${p.businessName}
${fmt} at ${time}
Receipt: ${p.receiptNo}
Customer: ${p.customerName} (${p.customerPhone})
Items: ${summary}
TOTAL: GH₵${p.totalAmount.toLocaleString()}
By: ${p.recordedBy ?? 'Staff'}`;
}