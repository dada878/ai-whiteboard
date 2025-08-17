import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

export interface UserEvent {
  id: string;
  userId: string;
  eventType: 'login' | 'logout' | 'note_created' | 'note_edited' | 'ai_operation' | 'project_created' | 'export';
  timestamp: Date;
  metadata?: Record<string, unknown>;
  sessionId: string;
}

export interface UserSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // 分鐘
  eventCount: number;
  notesCreated: number;
  aiOperations: number;
}

export class AdminService {
  // 檢查管理員權限 - 使用 API 調用確保服務器端邏輯一致
  static async checkAdminAccess(userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/admin/grant-access');
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.isAdmin === true;
    } catch (error) {
      console.error('Admin access check failed:', error);
      return false;
    }
  }

  // 記錄用戶事件
  static async logUserEvent(event: Omit<UserEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const eventData = {
        ...event,
        timestamp: Timestamp.now(),
        id: `${event.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // 存儲到 Firebase
      await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });
    } catch (error) {
      console.error('Failed to log user event:', error);
    }
  }

  // 獲取用戶事件列表
  static async getUserEvents(
    userId?: string, 
    eventType?: string,
    timeRange?: { start: Date; end: Date },
    limitCount: number = 100
  ): Promise<UserEvent[]> {
    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (eventType) params.set('eventType', eventType);
      if (timeRange) {
        params.set('startTime', timeRange.start.toISOString());
        params.set('endTime', timeRange.end.toISOString());
      }
      params.set('limit', limitCount.toString());

      const response = await fetch(`/api/admin/events?${params}`);
      const data = await response.json();
      
      return data.events?.map((event: any) => ({
        ...event,
        timestamp: new Date(event.timestamp)
      })) || [];
    } catch (error) {
      console.error('Failed to fetch user events:', error);
      return [];
    }
  }

  // 獲取用戶會話數據
  static async getUserSessions(
    userId?: string,
    timeRange?: { start: Date; end: Date },
    limitCount: number = 50
  ): Promise<UserSession[]> {
    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (timeRange) {
        params.set('startTime', timeRange.start.toISOString());
        params.set('endTime', timeRange.end.toISOString());
      }
      params.set('limit', limitCount.toString());

      const response = await fetch(`/api/admin/sessions?${params}`);
      const data = await response.json();
      
      return data.sessions?.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined
      })) || [];
    } catch (error) {
      console.error('Failed to fetch user sessions:', error);
      return [];
    }
  }

  // 計算用戶留存率
  static async calculateRetention(
    timeRange: { start: Date; end: Date },
    segment?: string
  ): Promise<{ day1: number; day7: number; day30: number }> {
    try {
      const params = new URLSearchParams();
      params.set('startTime', timeRange.start.toISOString());
      params.set('endTime', timeRange.end.toISOString());
      if (segment && segment !== 'all') params.set('segment', segment);

      const response = await fetch(`/api/admin/retention?${params}`);
      const data = await response.json();
      
      return data.retention || { day1: 0, day7: 0, day30: 0 };
    } catch (error) {
      console.error('Failed to calculate retention:', error);
      return { day1: 0, day7: 0, day30: 0 };
    }
  }

  // 獲取用戶統計數據
  static async getUserStats(
    timeRange: { start: Date; end: Date },
    segment?: string
  ): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    premiumUsers: number;
  }> {
    try {
      const params = new URLSearchParams();
      params.set('startTime', timeRange.start.toISOString());
      params.set('endTime', timeRange.end.toISOString());
      if (segment && segment !== 'all') params.set('segment', segment);

      const response = await fetch(`/api/admin/user-stats?${params}`);
      const data = await response.json();
      
      return data.stats || {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        premiumUsers: 0
      };
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        premiumUsers: 0
      };
    }
  }
}