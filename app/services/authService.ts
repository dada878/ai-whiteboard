import { signIn, signOut, getSession } from "next-auth/react";

export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  plan?: 'free' | 'plus';
  isPlus?: boolean;
  profileComplete?: boolean;
  onboardingStatus?: string;
  isApproved?: boolean;
}

export class AuthService {
  // Google 登入
  static async signInWithGoogle(): Promise<void> {
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw new Error((error as Error).message || 'Google 登入失敗');
    }
  }

  // Email/Password 登入
  static async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      
      if (result?.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw new Error((error as Error).message || 'Email 登入失敗');
    }
  }

  // Email/Password 註冊
  static async signUpWithEmail(email: string, password: string): Promise<void> {
    try {
      // 在實際應用中，你需要實現註冊邏輯
      // 這可能包括：
      // 1. 檢查使用者是否已存在
      // 2. 創建新使用者
      // 3. 自動登入
      
      // 暫時使用登入作為示範
      await AuthService.signInWithEmail(email, password);
    } catch (error) {
      console.error('Email sign-up error:', error);
      throw new Error((error as Error).message || 'Email 註冊失敗');
    }
  }

  // 匿名登入（NextAuth 不直接支援，需要自定義）
  static async signInAnonymously(): Promise<void> {
    // NextAuth 不直接支援匿名登入
    // 你可以實現自定義的匿名登入邏輯
    throw new Error('匿名登入功能尚未實現');
  }

  // 重設密碼
  static async resetPassword(email: string): Promise<void> {
    // 實現密碼重設邏輯
    // 這通常涉及發送重設密碼的郵件
    throw new Error('密碼重設功能尚未實現');
  }

  // 登出
  static async signOut(): Promise<void> {
    try {
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error('Sign-out error:', error);
      throw new Error((error as Error).message || '登出失敗');
    }
  }

  // 取得當前使用者
  static async getCurrentUser(): Promise<User | null> {
    try {
      const session = await getSession();
      if (!session?.user) return null;
      
      return {
        id: session.user.id || "",
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        plan: (session.user as { plan?: 'free' | 'plus' }).plan,
        isPlus: Boolean((session.user as { isPlus?: boolean }).isPlus)
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // 監聽認證狀態變化（NextAuth 使用 SessionProvider）
  static onAuthStateChanged(_callback: (user: User | null) => void): () => void {
    // NextAuth 使用 SessionProvider 和 useSession hook
    // 這個方法主要是為了保持與原有介面的相容性
    console.warn('onAuthStateChanged is deprecated with NextAuth. Use useSession hook instead.');
    
    // 返回一個空的取消訂閱函數
    return () => {};
  }

  // 檢查是否為匿名使用者
  static isAnonymousUser(_user: User | null): boolean {
    // NextAuth 預設不支援匿名使用者
    return false;
  }

  // 取得使用者顯示名稱
  static getUserDisplayName(user: User | null): string {
    if (!user) return '訪客';
    return user.name || user.email?.split('@')[0] || '使用者';
  }
}