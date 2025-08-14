import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/app/config/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return true; // If no secret configured, skip verification
  if (!signatureHeader) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const sigBuf = Buffer.from(signatureHeader, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-bmc-signature') || request.headers.get('x-signature');
  const secret = process.env.BMC_WEBHOOK_SECRET;

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsedPayload = payload as Record<string, unknown>;
  const type = parsedPayload?.type as string | undefined;
  const data = parsedPayload?.data as Record<string, unknown>;
  const status = data?.status as string | undefined;
  const supporterEmail = (data?.supporter_email as string | undefined) || (data?.payer_email as string | undefined);

  if (!type || !data) {
    return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
  }

  // Accept only successful payment-like events
  const isPaymentSucceeded = status === 'succeeded' || status === 'completed' || status === 'paid';
  if (!isPaymentSucceeded) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!supporterEmail) {
    // Acknowledge but cannot grant without email
    return NextResponse.json({ ok: true, missingEmail: true });
  }

  const email = String(supporterEmail).toLowerCase();
  const usersRef = adminDb.collection('users');
  const snapshot = await usersRef.where('email', '==', email).limit(1).get();

  const grantData = {
    plan: 'plus' as const,
    plusGrantedAt: FieldValue.serverTimestamp(),
    plusSource: 'bmc',
    bmc: {
      supporterId: data?.supporter_id ?? null,
      transactionId: data?.transaction_id ?? null,
      amount: data?.total_amount_charged ?? data?.amount ?? null,
      currency: data?.currency ?? null,
      coffeeCount: data?.coffee_count ?? null,
      coffeePrice: data?.coffee_price ?? null,
      eventType: type,
      liveMode: parsedPayload?.live_mode ?? null
    }
  };

  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    await userDoc.ref.set({ ...grantData, email }, { merge: true });
  } else {
    // Store pre-grant for email to be claimed on next login
    await adminDb.collection('plus_pregrants').doc(email).set({
      email,
      ...grantData,
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return NextResponse.json({ ok: true });
}


