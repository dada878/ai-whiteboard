import { db } from '../config/firebase';
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';

export interface WeeklyCohortData {
  cohortWeek: string;
  userId: string;
  signupDate: Date;
  signupWeek: string;
  
  // 留存數據
  week1Retention: boolean;
  week2Retention: boolean;
  week3Retention: boolean;
  week4Retention: boolean;
  
  // 累積數據
  totalSessions: number;
  totalNotesCreated: number;
  totalAIOperations: number;
  totalSessionDuration: number;
  
  // 每週詳細數據
  weeklyStats: {
    week1?: { sessions: number; notes: number; aiOps: number; duration: number };
    week2?: { sessions: number; notes: number; aiOps: number; duration: number };
    week3?: { sessions: number; notes: number; aiOps: number; duration: number };
    week4?: { sessions: number; notes: number; aiOps: number; duration: number };
  };
  
  // 轉換數據
  convertedToPremium: boolean;
  conversionDate?: Date;
  conversionWeek?: number;
  
  lastActiveDate: Date;
  isActive: boolean;
}

export interface CohortSummary {
  cohortWeek: string;
  startDate: Date;
  endDate: Date;
  totalUsers: number;
  
  // 留存率
  retentionRates: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  
  // 平均指標
  avgSessionsPerUser: number;
  avgNotesPerUser: number;
  avgAIOperationsPerUser: number;
  avgSessionDuration: number;
  
  // 轉換指標
  premiumConversionRate: number;
  avgTimeToConversion: number;
  
  // 同期比較
  retentionGrowth: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  
  lastUpdated: Date;
}

export class CohortAnalyticsService {
  
  // ==================== 時間工具函數 ====================
  
  static getWeekString(date: Date): string {
    const year = date.getFullYear();
    const weekNumber = this.getWeekNumber(date);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  }
  
  static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
  
  static getWeekStartDate(weekString: string): Date {
    const [year, week] = weekString.split('-W');
    const yearStart = new Date(parseInt(year), 0, 1);
    const daysOffset = (parseInt(week) - 1) * 7;
    const weekStart = new Date(yearStart.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    // 調整到週一
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    return weekStart;
  }
  
  static getWeekEndDate(weekString: string): Date {
    const startDate = this.getWeekStartDate(weekString);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return endDate;
  }
  
  // ==================== 群組管理 ====================
  
  // 將用戶加入群組
  static async addUserToCohort(userId: string, signupDate: Date): Promise<void> {
    try {
      const cohortWeek = this.getWeekString(signupDate);
      const docId = `${cohortWeek}_${userId}`;
      
      const cohortData: Omit<WeeklyCohortData, 'signupDate' | 'lastActiveDate'> & {
        signupDate: any;
        lastActiveDate: any;
      } = {
        cohortWeek,
        userId,
        signupDate: serverTimestamp(),
        signupWeek: cohortWeek,
        
        week1Retention: false,
        week2Retention: false,
        week3Retention: false,
        week4Retention: false,
        
        totalSessions: 0,
        totalNotesCreated: 0,
        totalAIOperations: 0,
        totalSessionDuration: 0,
        
        weeklyStats: {},
        
        convertedToPremium: false,
        
        lastActiveDate: serverTimestamp(),
        isActive: true
      };
      
      await setDoc(doc(collection(db, 'weekly_cohorts'), docId), cohortData);
      console.log('Added user to cohort:', cohortWeek, userId);
    } catch (error) {
      console.error('Failed to add user to cohort:', error);
    }
  }
  
  // 更新用戶活動數據
  static async updateUserActivity(userId: string, activityData: {
    sessions?: number;
    notesCreated?: number;
    aiOperations?: number;
    sessionDuration?: number;
    activityDate: Date;
  }): Promise<void> {
    try {
      // 找到用戶的群組記錄
      const cohortsQuery = query(
        collection(db, 'weekly_cohorts'),
        where('userId', '==', userId)
      );
      
      const cohortsSnapshot = await getDocs(cohortsQuery);
      
      if (cohortsSnapshot.empty) {
        console.warn('User cohort not found:', userId);
        return;
      }
      
      const cohortDoc = cohortsSnapshot.docs[0];
      const cohortData = cohortDoc.data();
      const signupDate = cohortData.signupDate?.toDate();
      
      if (!signupDate) {
        console.warn('Invalid signup date for user:', userId);
        return;
      }
      
      // 計算當前活動是第幾週
      const weekNumber = this.calculateWeekNumber(signupDate, activityData.activityDate);
      
      if (weekNumber < 1 || weekNumber > 4) {
        console.log('Activity outside tracking window:', weekNumber);
        return;
      }
      
      // 更新留存狀態
      const retentionUpdates: any = {
        lastActiveDate: serverTimestamp(),
        isActive: true
      };
      
      if (weekNumber === 1) retentionUpdates.week1Retention = true;
      if (weekNumber === 2) retentionUpdates.week2Retention = true;
      if (weekNumber === 3) retentionUpdates.week3Retention = true;
      if (weekNumber === 4) retentionUpdates.week4Retention = true;
      
      // 更新累積數據
      if (activityData.sessions) {
        retentionUpdates.totalSessions = (cohortData.totalSessions || 0) + activityData.sessions;
      }
      if (activityData.notesCreated) {
        retentionUpdates.totalNotesCreated = (cohortData.totalNotesCreated || 0) + activityData.notesCreated;
      }
      if (activityData.aiOperations) {
        retentionUpdates.totalAIOperations = (cohortData.totalAIOperations || 0) + activityData.aiOperations;
      }
      if (activityData.sessionDuration) {
        retentionUpdates.totalSessionDuration = (cohortData.totalSessionDuration || 0) + activityData.sessionDuration;
      }
      
      // 更新週統計
      const weekKey = `week${weekNumber}`;
      const currentWeeklyStats = cohortData.weeklyStats || {};
      const currentWeekStats = currentWeeklyStats[weekKey] || { sessions: 0, notes: 0, aiOps: 0, duration: 0 };
      
      retentionUpdates[`weeklyStats.${weekKey}`] = {
        sessions: (currentWeekStats.sessions || 0) + (activityData.sessions || 0),
        notes: (currentWeekStats.notes || 0) + (activityData.notesCreated || 0),
        aiOps: (currentWeekStats.aiOps || 0) + (activityData.aiOperations || 0),
        duration: (currentWeekStats.duration || 0) + (activityData.sessionDuration || 0)
      };
      
      await updateDoc(cohortDoc.ref, retentionUpdates);
      console.log('Updated user cohort activity:', userId, weekNumber);
      
    } catch (error) {
      console.error('Failed to update user activity:', error);
    }
  }
  
  // 計算活動日期相對於註冊日期是第幾週
  private static calculateWeekNumber(signupDate: Date, activityDate: Date): number {
    const diffTime = activityDate.getTime() - signupDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }
  
  // ==================== 群組統計計算 ====================
  
  // 計算群組摘要
  static async calculateCohortSummary(cohortWeek: string): Promise<CohortSummary | null> {
    try {
      console.log('Calculating cohort summary for:', cohortWeek);
      
      // 獲取該群組的所有用戶數據
      const cohortsQuery = query(
        collection(db, 'weekly_cohorts'),
        where('cohortWeek', '==', cohortWeek)
      );
      
      const cohortsSnapshot = await getDocs(cohortsQuery);
      
      if (cohortsSnapshot.empty) {
        console.log('No users found for cohort:', cohortWeek);
        return null;
      }
      
      const users = cohortsSnapshot.docs.map(doc => doc.data());
      const totalUsers = users.length;
      
      // 計算留存率
      const retentionRates = {
        week1: (users.filter(u => u.week1Retention).length / totalUsers) * 100,
        week2: (users.filter(u => u.week2Retention).length / totalUsers) * 100,
        week3: (users.filter(u => u.week3Retention).length / totalUsers) * 100,
        week4: (users.filter(u => u.week4Retention).length / totalUsers) * 100,
      };
      
      // 計算平均指標
      const avgSessionsPerUser = users.reduce((sum, u) => sum + (u.totalSessions || 0), 0) / totalUsers;
      const avgNotesPerUser = users.reduce((sum, u) => sum + (u.totalNotesCreated || 0), 0) / totalUsers;
      const avgAIOperationsPerUser = users.reduce((sum, u) => sum + (u.totalAIOperations || 0), 0) / totalUsers;
      const avgSessionDuration = users.reduce((sum, u) => sum + (u.totalSessionDuration || 0), 0) / totalUsers;
      
      // 計算轉換指標
      const premiumUsers = users.filter(u => u.convertedToPremium);
      const premiumConversionRate = (premiumUsers.length / totalUsers) * 100;
      
      const avgTimeToConversion = premiumUsers.length > 0
        ? premiumUsers.reduce((sum, u) => {
            if (u.conversionDate && u.signupDate) {
              const signupDate = u.signupDate.toDate ? u.signupDate.toDate() : new Date(u.signupDate);
              const conversionDate = u.conversionDate.toDate ? u.conversionDate.toDate() : new Date(u.conversionDate);
              return sum + (conversionDate.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
            }
            return sum;
          }, 0) / premiumUsers.length
        : 0;
      
      // 獲取上一群組數據來計算成長率
      const previousWeek = this.getPreviousWeek(cohortWeek);
      const previousSummary = await this.getCohortSummary(previousWeek);
      
      const retentionGrowth = {
        week1: previousSummary ? retentionRates.week1 - previousSummary.retentionRates.week1 : 0,
        week2: previousSummary ? retentionRates.week2 - previousSummary.retentionRates.week2 : 0,
        week3: previousSummary ? retentionRates.week3 - previousSummary.retentionRates.week3 : 0,
        week4: previousSummary ? retentionRates.week4 - previousSummary.retentionRates.week4 : 0,
      };
      
      const summary: CohortSummary = {
        cohortWeek,
        startDate: this.getWeekStartDate(cohortWeek),
        endDate: this.getWeekEndDate(cohortWeek),
        totalUsers,
        retentionRates,
        avgSessionsPerUser,
        avgNotesPerUser,
        avgAIOperationsPerUser,
        avgSessionDuration,
        premiumConversionRate,
        avgTimeToConversion,
        retentionGrowth,
        lastUpdated: new Date()
      };
      
      // 保存摘要到 Firebase
      await setDoc(doc(collection(db, 'cohort_summaries'), cohortWeek), {
        ...summary,
        startDate: serverTimestamp(),
        endDate: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
      
      console.log('Calculated cohort summary:', summary);
      return summary;
      
    } catch (error) {
      console.error('Failed to calculate cohort summary:', error);
      return null;
    }
  }
  
  // 獲取群組摘要
  static async getCohortSummary(cohortWeek: string): Promise<CohortSummary | null> {
    try {
      const summaryDoc = await getDoc(doc(collection(db, 'cohort_summaries'), cohortWeek));
      
      if (summaryDoc.exists()) {
        const data = summaryDoc.data();
        return {
          ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          lastUpdated: data.lastUpdated?.toDate()
        } as CohortSummary;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cohort summary:', error);
      return null;
    }
  }
  
  // 獲取多個群組摘要
  static async getCohortSummaries(startWeek: string, endWeek: string): Promise<CohortSummary[]> {
    try {
      const summariesQuery = query(
        collection(db, 'cohort_summaries'),
        where('cohortWeek', '>=', startWeek),
        where('cohortWeek', '<=', endWeek),
        orderBy('cohortWeek', 'asc')
      );
      
      const summariesSnapshot = await getDocs(summariesQuery);
      
      return summariesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          lastUpdated: data.lastUpdated?.toDate()
        } as CohortSummary;
      });
    } catch (error) {
      console.error('Failed to get cohort summaries:', error);
      return [];
    }
  }
  
  // ==================== 輔助函數 ====================
  
  private static getPreviousWeek(weekString: string): string {
    const [year, week] = weekString.split('-W');
    const weekNum = parseInt(week);
    
    if (weekNum > 1) {
      return `${year}-W${(weekNum - 1).toString().padStart(2, '0')}`;
    } else {
      const prevYear = parseInt(year) - 1;
      return `${prevYear}-W52`; // 假設上一年有52週
    }
  }
  
  // 獲取最近的群組週列表
  static getRecentCohortWeeks(count: number = 8): string[] {
    const weeks: string[] = [];
    const currentDate = new Date();
    
    for (let i = 0; i < count; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - (i * 7));
      weeks.push(this.getWeekString(date));
    }
    
    return weeks.reverse(); // 按時間順序排列
  }
}