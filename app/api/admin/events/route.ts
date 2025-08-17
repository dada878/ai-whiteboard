import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb as db } from '../../../config/firebase-admin';

// 記錄用戶事件
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventData = await req.json();
    
    // 驗證必要欄位
    if (!eventData.userId || !eventData.eventType || !eventData.sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 存儲事件到 Firestore
    const docRef = await db.collection('user_events').add({
      ...eventData,
      timestamp: new Date(),
      createdAt: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      eventId: docRef.id 
    });

  } catch (error) {
    console.error('Error logging user event:', error);
    return NextResponse.json(
      { error: 'Failed to log event' }, 
      { status: 500 }
    );
  }
}

// 獲取用戶事件
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = db.collection('user_events').orderBy('timestamp', 'desc');

    // 添加過濾條件
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }
    if (startTime) {
      query = query.where('timestamp', '>=', new Date(startTime));
    }
    if (endTime) {
      query = query.where('timestamp', '<=', new Date(endTime));
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()?.toISOString()
    }));

    return NextResponse.json({ events });

  } catch (error) {
    console.error('Error fetching user events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' }, 
      { status: 500 }
    );
  }
}