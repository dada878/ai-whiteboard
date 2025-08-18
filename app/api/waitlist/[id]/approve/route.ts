import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { adminDb } from '@/app/lib/firebase-admin';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    const isAdmin = session?.user?.email === 'dada878@gmail.com';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: '無權限執行此操作' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const { id } = params;

    // Get the waitlist entry
    const docRef = adminDb.collection('waitlist').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: '找不到此申請' },
        { status: 404 }
      );
    }

    const data = doc.data();

    // Update status to approved
    await docRef.update({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: session.user.email,
    });

    // Update user profile to mark as approved (use profiles collection)
    if (data?.email) {
      await adminDb.collection('profiles').doc(data.email).update({
        isApproved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: session.user.email,
      });
    }

    // TODO: Send approval email to user

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { error: '審核失敗' },
      { status: 500 }
    );
  }
}