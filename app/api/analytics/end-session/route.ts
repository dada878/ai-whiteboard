import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '../../../config/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Missing sessionId or userId' }, { status: 400 });
    }

    // 查找會話記錄
    const sessionsSnapshot = await db.collection('user_sessions')
      .where('sessionId', '==', sessionId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (sessionsSnapshot.empty) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionDoc = sessionsSnapshot.docs[0];
    const sessionData = sessionDoc.data();

    // 計算會話時長
    const endTime = new Date();
    const startTime = sessionData.startTime?.toDate() || new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000 / 60; // 分鐘

    // 更新會話記錄
    await sessionDoc.ref.update({
      endTime: new Date(),
      duration: Math.round(duration),
      isActive: false
    });

    // 記錄登出事件
    await db.collection('user_events').add({
      userId,
      sessionId,
      eventType: 'logout',
      timestamp: new Date(),
      metadata: {
        sessionDuration: Math.round(duration),
        totalEvents: sessionData.eventCount || 0
      }
    });

    return NextResponse.json({ success: true, duration: Math.round(duration) });

  } catch (error) {
    console.error('Error ending session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}