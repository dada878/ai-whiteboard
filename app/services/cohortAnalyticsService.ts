import { v4 as uuidv4 } from 'uuid';

export interface WeeklyCohortData {
  cohortWeek: string;
  year: number;
  userCount: number;
  retentionWeeks: { [week: string]: number };
  createdAt: Date;
}

export interface CohortGroup {
  id: string;
  week: string;
  year: number;
  startDate: Date;
  endDate: Date;
  userIds: string[];
  createdAt: Date;
}

export interface UserCohortData {
  userId: string;
  cohortId: string;
  joinDate: Date;
  weeklyRetention: { [week: string]: boolean };
  lastActivity: Date;
}

export class CohortAnalyticsService {
  // 暫時禁用客戶端 Firebase 寫入，改用後端 API
  
  static async addUserToCohort(userId: string, userEmailOrDate?: string | Date): Promise<string> {
    console.log('CohortAnalyticsService: Using backend API for cohort analytics');
    return uuidv4();
  }

  static async updateUserActivity(userId: string, metadata?: any): Promise<void> {
    console.log('CohortAnalyticsService: Using backend API for cohort analytics');
    return;
  }

  static async getUserCohortData(userId: string): Promise<UserCohortData | null> {
    console.log('CohortAnalyticsService: Using backend API for cohort analytics');
    return null;
  }

  static async getCohortGroups(): Promise<CohortGroup[]> {
    console.log('CohortAnalyticsService: Using backend API for cohort analytics');
    return [];
  }

  static async getWeeklyCohortData(): Promise<WeeklyCohortData[]> {
    console.log('CohortAnalyticsService: Using backend API for cohort analytics');
    return [];
  }

  static async getCohortSummaries(startWeek?: string, endWeek?: string): Promise<any[]> {
    console.log('CohortAnalyticsService: Using backend API for cohort summaries');
    return [];
  }

  static async getCohortSummary(cohortWeek?: string): Promise<any> {
    console.log('CohortAnalyticsService: Using backend API for cohort summary');
    return null;
  }

  static async calculateCohortSummary(targetWeek?: string): Promise<any> {
    console.log('CohortAnalyticsService: Using backend API for calculate cohort summary');
    return null;
  }

  static getRecentCohortWeeks(count: number): string[] {
    console.log('CohortAnalyticsService: Using backend API for recent cohort weeks');
    return [];
  }
}