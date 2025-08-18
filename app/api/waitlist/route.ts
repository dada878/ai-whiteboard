import { NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, school, major, reason } = body;

    // Validate required fields
    if (!email || !name || !school) {
      return NextResponse.json(
        { error: '請填寫所有必填欄位' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEntry = await adminDb
      .collection('waitlist')
      .where('email', '==', email)
      .get();

    if (!existingEntry.empty) {
      return NextResponse.json(
        { error: '此 Email 已經在等候名單中' },
        { status: 400 }
      );
    }

    // Add to waitlist
    await adminDb.collection('waitlist').add({
      email,
      name,
      school,
      major: major || '',
      reason: reason || '',
      status: 'pending', // pending, approved, rejected
      createdAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Waitlist submission error:', error);
    return NextResponse.json(
      { error: '提交失敗，請稍後再試' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // This endpoint is for admin to view waitlist
    // Add authentication check here
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    let query = adminDb.collection('waitlist').orderBy('createdAt', 'desc');
    
    if (status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const waitlist = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ waitlist });
  } catch (error) {
    console.error('Waitlist fetch error:', error);
    return NextResponse.json(
      { error: '無法載入等候名單' },
      { status: 500 }
    );
  }
}