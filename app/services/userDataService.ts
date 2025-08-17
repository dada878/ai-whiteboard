export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isAdmin?: boolean;
  role?: 'admin' | 'user';
  isPremium?: boolean;
  createdAt: Date;
  lastLoginAt: Date;
  totalSessions: number;
  totalNotesCreated: number;
  totalAIOperations: number;
}

export class UserDataService {
  // 改用後端 API - 暫時禁用客戶端 Firebase 寫入
  static async ensureUserData(userData: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  }): Promise<void> {
    console.log('UserDataService: Using backend API for user data');
    return;
  }

  static async getUserData(uid: string): Promise<UserData | null> {
    console.log('UserDataService: Using backend API for get user data');
    return null;
  }

  static async isUserAdmin(uid: string): Promise<boolean> {
    console.log('UserDataService: Using backend API for admin check');
    return false;
  }

  static async setUserAdmin(uid: string, isAdmin: boolean = true): Promise<void> {
    console.log('UserDataService: Using backend API for admin set');
    return;
  }
}