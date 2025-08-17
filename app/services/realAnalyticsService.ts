import { db } from '../config/firebase';
import { adminDb } from '../config/firebase-admin';
import { collection, addDoc, doc, updateDoc, getDoc, setDoc, increment, serverTimestamp, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { UserDataService } from './userDataService';
import { CohortAnalyticsService } from './cohortAnalyticsService';

export interface UserEvent {
  userId: string;
  sessionId: string;
  eventType: 'login' | 'logout' | 'note_created' | 'note_edited' | 'note_deleted' | 
            'ai_operation' | 'project_created' | 'project_opened' | 'export' | 'import';
  timestamp: Date;
  metadata?: {
    noteId?: string;
    aiOperation?: 'brainstorm' | 'analyze' | 'summarize' | 'ask';
    projectId?: string;
    exportFormat?: 'png' | 'pdf' | 'json';
    position?: { x: number; y: number };
    totalNotes?: number;
    generatedNotesCount?: number;
    success?: boolean;
    [key: string]: any;
  };
}

export interface UserSession {
  userId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  eventCount: number;
  notesCreated: number;
  notesEdited: number;
  notesDeleted: number;
  aiOperations: number;
  projectsAccessed: string[];
  isActive: boolean;
  userAgent?: string;
  lastActivity: Date;
}

export class RealAnalyticsService {
  private static currentSession: UserSession | null = null;
  private static sessionUpdateTimer: NodeJS.Timeout | null = null;

  // ==================== 會話管理 ====================

  static async startSession(userId: string): Promise<string> {
    const sessionId = uuidv4();
    const session: UserSession = {
      userId,
      sessionId,
      startTime: new Date(),
      eventCount: 0,
      notesCreated: 0,
      notesEdited: 0,
      notesDeleted: 0,
      aiOperations: 0,
      projectsAccessed: [],
      isActive: true,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      lastActivity: new Date()
    };

    try {
      // 保存到 Firebase
      await addDoc(collection(db, 'user_sessions'), {
        ...session,
        startTime: serverTimestamp(),
        lastActivity: serverTimestamp()
      });

      this.currentSession = session;
      
      // 每 30 秒更新一次會話活動時間
      this.sessionUpdateTimer = setInterval(() => {
        this.updateSessionActivity();
      }, 30000);

      console.log('Session started:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      return sessionId; // 即使保存失敗也返回 sessionId
    }
  }

  static async endSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const endTime = new Date();
      const duration = (endTime.getTime() - this.currentSession.startTime.getTime()) / 1000 / 60; // 分鐘

      // 查找並更新會話記錄
      const sessionsQuery = query(
        collection(db, 'user_sessions'),
        where('sessionId', '==', this.currentSession.sessionId),
        limit(1)
      );
      
      const sessionsSnapshot = await getDocs(sessionsQuery);
      if (!sessionsSnapshot.empty) {
        const sessionDoc = sessionsSnapshot.docs[0];
        await updateDoc(sessionDoc.ref, {
          endTime: serverTimestamp(),
          duration: Math.round(duration),
          isActive: false
        });
      }

      // 記錄登出事件
      await this.logEvent({
        userId: this.currentSession.userId,
        sessionId: this.currentSession.sessionId,
        eventType: 'logout',
        timestamp: endTime,
        metadata: {
          sessionDuration: Math.round(duration),
          totalEvents: this.currentSession.eventCount
        }
      });

      // 清理
      if (this.sessionUpdateTimer) {
        clearInterval(this.sessionUpdateTimer);
        this.sessionUpdateTimer = null;
      }
      this.currentSession = null;

      console.log('Session ended, duration:', duration, 'minutes');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  private static async updateSessionActivity(): Promise<void> {
    if (!this.currentSession) return;

    try {
      this.currentSession.lastActivity = new Date();
      
      const sessionsQuery = query(
        collection(db, 'user_sessions'),
        where('sessionId', '==', this.currentSession.sessionId),
        limit(1)
      );
      
      const sessionsSnapshot = await getDocs(sessionsQuery);
      if (!sessionsSnapshot.empty) {
        const sessionDoc = sessionsSnapshot.docs[0];
        await updateDoc(sessionDoc.ref, {
          lastActivity: serverTimestamp(),
          eventCount: this.currentSession.eventCount,
          notesCreated: this.currentSession.notesCreated,
          notesEdited: this.currentSession.notesEdited,
          notesDeleted: this.currentSession.notesDeleted,
          aiOperations: this.currentSession.aiOperations
        });
      }
    } catch (error) {
      console.error('Failed to update session activity:', error);
    }
  }

  // ==================== 事件記錄 ====================

  static async logEvent(event: UserEvent): Promise<void> {
    try {
      // 保存事件到 Firebase
      await addDoc(collection(db, 'user_events'), {
        ...event,
        timestamp: serverTimestamp(),
        id: uuidv4()
      });

      // 更新當前會話統計
      if (this.currentSession && this.currentSession.sessionId === event.sessionId) {
        this.currentSession.eventCount++;
        this.currentSession.lastActivity = new Date();

        switch (event.eventType) {
          case 'note_created':
            this.currentSession.notesCreated++;
            break;
          case 'note_edited':
            this.currentSession.notesEdited++;
            break;
          case 'note_deleted':
            this.currentSession.notesDeleted++;
            break;
          case 'ai_operation':
            this.currentSession.aiOperations++;
            break;
          case 'project_opened':
            if (event.metadata?.projectId && !this.currentSession.projectsAccessed.includes(event.metadata.projectId)) {
              this.currentSession.projectsAccessed.push(event.metadata.projectId);
            }
            break;
        }
      }

      // 更新用戶統計
      await this.updateUserStats(event);

      // 更新群組活動數據
      await this.updateCohortActivity(event);

      console.log('Event logged:', event.eventType, event.metadata);
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }

  // ==================== 用戶統計更新 ====================

  private static async updateUserStats(event: UserEvent): Promise<void> {
    try {
      const userRef = doc(db, 'users', event.userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const updates: any = {
          lastActivity: serverTimestamp()
        };

        switch (event.eventType) {
          case 'login':
            updates.lastLoginAt = serverTimestamp();
            updates.totalSessions = increment(1);
            break;
          case 'note_created':
            updates.totalNotesCreated = increment(1);
            break;
          case 'ai_operation':
            updates.totalAIOperations = increment(1);
            break;
        }

        await updateDoc(userRef, updates);
      }
    } catch (error) {
      console.error('Failed to update user stats:', error);
    }
  }

  // ==================== 群組活動更新 ====================

  private static async updateCohortActivity(event: UserEvent): Promise<void> {
    try {
      // 只追蹤特定類型的活動
      if (!['note_created', 'ai_operation', 'login'].includes(event.eventType)) {
        return;
      }

      const activityData: any = {
        activityDate: event.timestamp
      };

      // 根據事件類型累積數據
      switch (event.eventType) {
        case 'login':
          activityData.sessions = 1;
          break;
        case 'note_created':
          activityData.notesCreated = 1;
          break;
        case 'ai_operation':
          activityData.aiOperations = 1;
          break;
      }

      // 如果有當前會話，也更新會話時長
      if (this.currentSession && this.currentSession.sessionId === event.sessionId) {
        const sessionDuration = (new Date().getTime() - this.currentSession.startTime.getTime()) / 1000 / 60; // 分鐘
        activityData.sessionDuration = Math.max(1, Math.round(sessionDuration)); // 至少1分鐘
      }

      await CohortAnalyticsService.updateUserActivity(event.userId, activityData);
    } catch (error) {
      console.error('Failed to update cohort activity:', error);
    }
  }

  // ==================== 便捷方法 ====================

  static async trackLogin(userId: string, userInfo?: {
    email: string;
    displayName?: string;
    photoURL?: string;
  }): Promise<string> {
    let isNewUser = false;
    
    // 確保用戶數據存在
    if (userInfo) {
      const existingUser = await UserDataService.getUserData(userId);
      isNewUser = !existingUser;
      
      await UserDataService.ensureUserData({
        uid: userId,
        ...userInfo
      });
      
      // 如果是新用戶，將其加入到當前週的群組
      if (isNewUser) {
        try {
          await CohortAnalyticsService.addUserToCohort(userId, new Date());
          console.log('Added new user to cohort:', userId);
        } catch (error) {
          console.error('Failed to add user to cohort:', error);
        }
      }
    }

    const sessionId = await this.startSession(userId);
    
    await this.logEvent({
      userId,
      sessionId,
      eventType: 'login',
      timestamp: new Date(),
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        email: userInfo?.email,
        isNewUser
      }
    });

    return sessionId;
  }

  static async trackNoteCreated(userId: string, sessionId: string, noteId: string, position: { x: number; y: number }, totalNotes: number): Promise<void> {
    await this.logEvent({
      userId,
      sessionId,
      eventType: 'note_created',
      timestamp: new Date(),
      metadata: {
        noteId,
        position,
        totalNotes
      }
    });
  }

  static async trackNoteEdited(userId: string, sessionId: string, noteId: string): Promise<void> {
    await this.logEvent({
      userId,
      sessionId,
      eventType: 'note_edited',
      timestamp: new Date(),
      metadata: { noteId }
    });
  }

  static async trackAIOperation(userId: string, sessionId: string, operation: string, metadata?: any): Promise<void> {
    await this.logEvent({
      userId,
      sessionId,
      eventType: 'ai_operation',
      timestamp: new Date(),
      metadata: {
        aiOperation: operation,
        ...metadata
      }
    });
  }

  static async trackProjectAccess(userId: string, sessionId: string, projectId: string): Promise<void> {
    await this.logEvent({
      userId,
      sessionId,
      eventType: 'project_opened',
      timestamp: new Date(),
      metadata: { projectId }
    });
  }

  static async trackExport(userId: string, sessionId: string, format: 'png' | 'pdf' | 'json'): Promise<void> {
    await this.logEvent({
      userId,
      sessionId,
      eventType: 'export',
      timestamp: new Date(),
      metadata: { exportFormat: format }
    });
  }

  // ==================== 頁面可見性處理 ====================

  static initVisibilityTracking(): void {
    if (typeof document === 'undefined') return;

    // 頁面隱藏/顯示時的處理
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 頁面隱藏，停止會話活動更新
        if (this.sessionUpdateTimer) {
          clearInterval(this.sessionUpdateTimer);
          this.sessionUpdateTimer = null;
        }
      } else {
        // 頁面顯示，恢復會話活動更新
        if (this.currentSession && !this.sessionUpdateTimer) {
          this.sessionUpdateTimer = setInterval(() => {
            this.updateSessionActivity();
          }, 30000);
        }
      }
    });

    // 頁面卸載時結束會話
    window.addEventListener('beforeunload', () => {
      // 使用 sendBeacon 發送最後的事件
      if (this.currentSession) {
        navigator.sendBeacon('/api/analytics/end-session', JSON.stringify({
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        }));
      }
    });
  }

  // ==================== 獲取當前會話信息 ====================

  static getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  static getSessionId(): string | null {
    return this.currentSession?.sessionId || null;
  }
}