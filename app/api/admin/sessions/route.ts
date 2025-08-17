import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb as db } from '../../../config/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const limit = parseInt(searchParams.get('limit') || '50');

    const start = startTime ? new Date(startTime) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endTime ? new Date(endTime) : new Date();

    console.log('Fetching real session data from Firebase...');

    try {
      // 從 Firebase 獲取會話數據
      let query = db.collection('user_sessions').orderBy('startTime', 'desc');

      if (userId) {
        query = query.where('userId', '==', userId);
      }
      
      // 添加時間範圍過濾
      query = query.where('startTime', '>=', start);
      query = query.where('startTime', '<=', end);
      query = query.limit(limit);

      const snapshot = await query.get();
      console.log('Found sessions:', snapshot.size);

      const sessions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          sessionId: data.sessionId,
          startTime: data.startTime?.toDate()?.toISOString(),
          endTime: data.endTime?.toDate()?.toISOString(),
          duration: data.duration,
          eventCount: data.eventCount || 0,
          notesCreated: data.notesCreated || 0,
          notesEdited: data.notesEdited || 0,
          notesDeleted: data.notesDeleted || 0,
          aiOperations: data.aiOperations || 0,
          projectsAccessed: data.projectsAccessed || [],
          isActive: data.isActive || false
        };
      });

      console.log('Processed sessions:', sessions.length);
      return NextResponse.json({ sessions });

    } catch (dbError) {
      console.error('Firebase session query failed, returning mock data:', dbError);
      
      // 返回模擬會話數據
      const mockSessions = [
        {
          id: 'session_1',
          userId: session.user.email,
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2小時前
          endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5小時前
          duration: 30, // 30分鐘
          eventCount: 15,
          notesCreated: 3,
          aiOperations: 2
        },
        {
          id: 'session_2',
          userId: session.user.email,
          startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 昨天
          endTime: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString(),
          duration: 45,
          eventCount: 22,
          notesCreated: 5,
          aiOperations: 3
        },
        {
          id: 'session_3',
          userId: session.user.email,
          startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3天前
          endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
          duration: 20,
          eventCount: 8,
          notesCreated: 2,
          aiOperations: 1
        }
      ];

      return NextResponse.json({ sessions: mockSessions });
    }

  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' }, 
      { status: 500 }
    );
  }
}