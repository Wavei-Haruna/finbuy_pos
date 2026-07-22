import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, buildCustomerSMS, buildAdminSMS, InvoiceParams } from '@/lib/sms-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      customerName,
      customerPhone,
      sendCustomerSMS = true,
      adminPhone,       // admin's saved phone number from their profile
      items,            // CartItem[] — preferred
      // legacy flat fields (fallback)
      productName,
      totalAmount,
      businessName,
      businessPhone,
      businessCode,
      receiptNo,
      recordedBy,
      date,
      notes,
      isAdminCopy,      // true → send admin alert format
    } = body;

    if (!customerPhone && !adminPhone) {
      return NextResponse.json({ error: 'No phone number provided' }, { status: 400 });
    }

    // Normalise items — support both new array format and legacy flat format
    const normalised = items ?? [{
      name:       productName ?? 'Item',
      quantity:   1,
      unitPrice:  totalAmount ?? 0,
      totalPrice: totalAmount ?? 0,
    }];

    const params: InvoiceParams = {
      customerName:  customerName ?? 'Customer',
      customerPhone: customerPhone ?? '',
      items:         normalised,
      totalAmount:   totalAmount ?? normalised.reduce((s: number, i: any) => s + i.totalPrice, 0),
      businessName:  businessName ?? 'Store',
      businessPhone: businessPhone ?? '',
      receiptNo:     receiptNo ?? '',
      recordedBy:    recordedBy ?? 'Staff',
      date:          date ? new Date(date) : new Date(),
      notes:         notes ?? '',
    };

    const results: any[] = [];

    // 1. Customer SMS
    if (sendCustomerSMS && customerPhone) {
      const msg = buildCustomerSMS(params);
      const res = await sendSMS({ phoneNumber: customerPhone, message: msg });
      results.push({ to: 'customer', ...res });
    }

    // 2. Admin copy SMS
    const adminTarget = adminPhone || process.env.NEXT_PUBLIC_ADMIN_PHONE;
    if (adminTarget) {
      const msg = buildAdminSMS({ ...params, businessName: businessCode ? `${businessName} (${businessCode})` : businessName });
      const res = await sendSMS({ phoneNumber: adminTarget, message: msg });
      results.push({ to: 'admin', ...res });
    }

    const allOk = results.every((r) => r.success);
    return NextResponse.json({ success: allOk, results }, { status: allOk ? 200 : 207 });

  } catch (err: any) {
    console.error('[/api/send-sms]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}