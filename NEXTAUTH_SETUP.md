# NextAuth.js 設置指南

## 概述
這個專案使用 NextAuth.js 進行身份驗證，並使用 Firebase Firestore 作為資料儲存（但不使用 Firebase Authentication）。

## 環境變數已設置
你的 Firebase 服務帳號憑證已經配置在 `.env.local` 中。

## 仍需設置的項目

### 1. Google OAuth 設置

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇你的專案（onyx-goal-334712）
3. 前往 "APIs & Services" > "Credentials"
4. 點擊 "Create Credentials" > "OAuth client ID"
5. 選擇 "Web application"
6. 設置：
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. 複製 Client ID 和 Client Secret
8. 更新 `.env.local` 中的：
   ```
   GOOGLE_CLIENT_ID=你的-client-id
   GOOGLE_CLIENT_SECRET=你的-client-secret
   ```

### 2. 生產環境設置

當部署到生產環境時，更新 `.env.local` 中的：
```
NEXTAUTH_URL=https://你的域名.com
```

並在 Google OAuth 設置中添加生產環境的 URLs。

## 功能說明

### 支援的登入方式
- ✅ Google OAuth 登入
- ✅ Email/Password 登入（需要實現真實的驗證邏輯）
- ❌ 匿名登入（NextAuth 不直接支援）

### 資料儲存
- 使用者資料儲存在 Firebase Firestore
- 自動創建使用者文檔和會話記錄

## 使用方式

### 在元件中使用認證狀態

```tsx
import { useAuth } from '@/app/contexts/AuthContext';

function MyComponent() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  
  if (loading) return <div>載入中...</div>;
  
  if (!user) {
    return (
      <button onClick={signInWithGoogle}>
        使用 Google 登入
      </button>
    );
  }
  
  return (
    <div>
      歡迎，{user.name}！
      <button onClick={signOut}>登出</button>
    </div>
  );
}
```

### 自定義登入頁面（可選）

如果你想創建自定義登入頁面，創建 `/app/auth/signin/page.tsx`：

```tsx
'use client';

import { signIn } from 'next-auth/react';

export default function SignIn() {
  return (
    <div>
      <h1>登入</h1>
      <button onClick={() => signIn('google')}>
        使用 Google 登入
      </button>
    </div>
  );
}
```

## 注意事項

1. **安全性**：確保 `.env.local` 不會被提交到版本控制
2. **NEXTAUTH_SECRET**：已生成安全的密鑰，生產環境請使用不同的密鑰
3. **Email/Password 登入**：目前只是示範，需要實現真實的驗證邏輯
4. **匿名登入**：NextAuth 不直接支援，如需要可以考慮其他方案

## 下一步

1. 設置 Google OAuth 憑證
2. 實現 Email/Password 註冊和驗證邏輯
3. 考慮添加其他登入提供者（GitHub、Facebook 等）
4. 實現密碼重設功能（通過郵件）