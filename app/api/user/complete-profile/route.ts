import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { adminDb } from '@/app/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, school, major, year, purpose } = body;

    // Validate required fields
    if (!name || !school) {
      return NextResponse.json(
        { error: '請填寫必填欄位' },
        { status: 400 }
      );
    }

    // Update user profile
    await adminDb.collection('users').doc(session.user.id).update({
      name,
      school,
      major: major || '',
      year: year || '',
      purpose: purpose || '',
      profileComplete: true,
      onboardingStatus: 'completed',
      profileCompletedAt: new Date().toISOString(),
    });

    // Add to waitlist for admin review
    await adminDb.collection('waitlist').add({
      userId: session.user.id,
      email: session.user.email,
      name,
      school,
      major: major || '',
      year: year || '',
      purpose: purpose || '',
      status: 'pending', // Admin needs to approve
      createdAt: new Date().toISOString(),
      source: 'onboarding',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile completion error:', error);
    return NextResponse.json(
      { error: '更新失敗，請稍後再試' },
      { status: 500 }
    );
  }
}