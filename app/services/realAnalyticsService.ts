import { v4 as uuidv4 } from 'uuid';

export interface UserEvent {
  userId: string;
  sessionId: string;
  eventType: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  userAgent?: string;
  lastActivity: Date;
}

export class RealAnalyticsService {
  // 暫時禁用客戶端 Firebase 寫入，改用後端 API
  private static isDisabled = true;

  static async startSession(userId: string, sessionId?: string): Promise<string> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return uuidv4();
  }

  static async endSession(sessionId: string): Promise<void> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return;
  }

  static async logEvent(event: UserEvent): Promise<void> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return;
  }

  static async trackLogin(userId: string, userInfo?: {
    email: string;
    displayName?: string;
    photoURL?: string;
  }): Promise<string> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return uuidv4();
  }

  static async trackExport(userId: string, sessionId: string, format: 'png' | 'pdf' | 'json'): Promise<void> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return;
  }

  static async trackProjectOpened(userId: string, sessionId: string, projectId: string): Promise<void> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return;
  }

  static initVisibilityTracking(): void {
    console.log('RealAnalyticsService: Visibility tracking disabled');
    return;
  }

  static getSessionId(): string {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return uuidv4();
  }

  static async trackNoteCreated(userId: string, sessionId: string, noteId: string): Promise<void> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return;
  }

  static async trackAIOperation(userId: string, sessionId: string, operation: string, metadata?: any): Promise<void> {
    console.log('RealAnalyticsService: Using backend API for analytics');
    return;
  }
}