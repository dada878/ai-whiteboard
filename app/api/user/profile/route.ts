import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb } from '@/app/config/firebase-admin';

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body?.name ?? '').toString().trim();
  if (!name || name.length < 1 || name.length > 50) {
    return NextResponse.json({ error: 'Name must be 1-50 characters' }, { status: 400 });
  }

  try {
    await adminDb.collection('users').doc(session.user.id).set({ name }, { merge: true });
    return NextResponse.json({ ok: true, name });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update name' }, { status: 500 });
  }
}


