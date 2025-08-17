import { db } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  // 確保用戶數據存在並更新
  static async ensureUserData(userData: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  }): Promise<void> {
    try {
      const userRef = doc(db, 'users', userData.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // 創建新用戶記錄
        const newUserData: Omit<UserData, 'createdAt' | 'lastLoginAt'> & { 
          createdAt: any; 
          lastLoginAt: any;
        } = {
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName || '',
          photoURL: userData.photoURL || '',
          isAdmin: false,
          role: 'user',
          isPremium: false,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          totalSessions: 0,
          totalNotesCreated: 0,
          totalAIOperations: 0
        };

        await setDoc(userRef, newUserData);
        console.log('Created new user record:', userData.uid);
      } else {
        // 更新現有用戶的登入時間和基本資料
        const updates: any = {
          lastLoginAt: serverTimestamp(),
          email: userData.email
        };

        if (userData.displayName) {
          updates.displayName = userData.displayName;
        }
        if (userData.photoURL) {
          updates.photoURL = userData.photoURL;
        }

        await updateDoc(userRef, updates);
        console.log('Updated existing user record:', userData.uid);
      }
    } catch (error) {
      console.error('Failed to ensure user data:', error);
    }
  }

  // 獲取用戶數據
  static async getUserData(uid: string): Promise<UserData | null> {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate(),
          lastLoginAt: data.lastLoginAt?.toDate()
        } as UserData;
      }

      return null;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  // 檢查用戶是否為管理員
  static async isUserAdmin(uid: string): Promise<boolean> {
    try {
      const userData = await this.getUserData(uid);
      return userData?.isAdmin === true || userData?.role === 'admin';
    } catch (error) {
      console.error('Failed to check admin status:', error);
      return false;
    }
  }

  // 設定用戶為管理員
  static async setUserAdmin(uid: string, isAdmin: boolean = true): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        isAdmin,
        role: isAdmin ? 'admin' : 'user',
        adminGrantedAt: isAdmin ? serverTimestamp() : null
      });
      console.log('Updated user admin status:', uid, isAdmin);
    } catch (error) {
      console.error('Failed to set user admin status:', error);
      throw error;
    }
  }
}