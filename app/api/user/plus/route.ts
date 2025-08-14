import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb } from '@/app/config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const email = (session.user.email || '').toLowerCase();

    // Downgrade plan to free and remove plus-related fields
    await adminDb.collection('users').doc(userId).set({
      plan: 'free',
      plusGrantedAt: FieldValue.delete(),
      plusSource: FieldValue.delete(),
      bmc: FieldValue.delete()
    }, { merge: true });

    // Ensure no pregrant remains to auto-regrant
    if (email) {
      await adminDb.collection('plus_pregrants').doc(email).delete().catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to downgrade' }, { status: 500 });
  }
}


