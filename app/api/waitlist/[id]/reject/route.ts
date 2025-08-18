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
    
    // Check if user is admin using environment variable
    const adminEmailsEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    const adminEmails = adminEmailsEnv 
      ? adminEmailsEnv.split(',').map(email => email.trim())
      : [];
    
    if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
      return NextResponse.json(
        { error: '無權限執行此操作' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const { id } = params;

    // Update status to rejected
    await adminDb.collection('waitlist').doc(id).update({
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: session.user.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rejection error:', error);
    return NextResponse.json(
      { error: '操作失敗' },
      { status: 500 }
    );
  }
}