import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFirestore } from 'firebase-admin/firestore';
import '@/app/config/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getFirestore();
    const profileRef = db.collection('profiles').doc(session.user.email);
    
    // Clear the isNewUser flag
    await profileRef.update({
      isNewUser: false,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear new user flag:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}