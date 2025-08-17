# GA4 Funnel Analysis 設定指南

## 📊 Overview
本文件說明如何在 GA4 中設定 Onboarding Funnel 分析，追蹤用戶從訪問到轉換的完整旅程。

## 🎯 Onboarding Funnel 步驟

我們的 Onboarding Funnel 包含 10 個關鍵步驟：

1. **Landing Page View** - 用戶訪問著陸頁
2. **CTA Click** - 點擊行動呼籲按鈕
3. **Login Page View** - 查看登入頁面
4. **Login Attempt** - 開始登入流程
5. **Login Success** - 成功登入/註冊
6. **First Whiteboard View** - 首次查看白板
7. **First Note Created** - 創建第一個便利貼
8. **First AI Usage** - 首次使用 AI 功能
9. **Project Saved** - 保存專案
10. **Plus Upgrade** - 升級到付費版（轉換完成）

## 🔧 GA4 設定步驟

### 1. 環境變數設定

在 `.env.local` 中添加：
```bash
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 2. 在應用中初始化 GA4

```typescript
// app/layout.tsx 或 _app.tsx
import { useEffect } from 'react';
import { ga4 } from '@/services/ga4Service';

export default function RootLayout() {
  useEffect(() => {
    ga4.initialize();
  }, []);
  
  return (
    // ... your layout
  );
}
```

### 3. 實作追蹤代碼

#### Landing Page (`app/landing/page.tsx`)
```typescript
import { useEffect } from 'react';
import { ga4 } from '@/services/ga4Service';

export default function LandingPage() {
  useEffect(() => {
    ga4.trackLandingPageView();
  }, []);

  const handleCTAClick = (location: 'hero' | 'features' | 'footer') => {
    ga4.trackCTAClick(location);
    router.push('/login');
  };
  
  return (
    // ... your component
  );
}
```

#### Login Page (`app/login/page.tsx`)
```typescript
import { ga4 } from '@/services/ga4Service';

export default function LoginPage() {
  useEffect(() => {
    ga4.trackLoginPageView();
  }, []);

  const handleLogin = async (method: 'google' | 'email') => {
    ga4.trackLoginAttempt(method);
    
    try {
      const result = await signIn(method);
      ga4.trackLoginSuccess(
        result.user.uid,
        method,
        result.isNewUser
      );
    } catch (error) {
      // Handle error
    }
  };
}
```

#### Whiteboard Component (`app/components/Whiteboard.tsx`)
```typescript
import { ga4 } from '@/services/ga4Service';

export default function Whiteboard() {
  const [hasCreatedFirstNote, setHasCreatedFirstNote] = useState(false);
  const [hasUsedAI, setHasUsedAI] = useState(false);

  useEffect(() => {
    // 追蹤首次查看
    if (isFirstVisit) {
      ga4.trackFirstWhiteboardView();
    }
  }, []);

  const handleCreateNote = (noteId: string, content: string) => {
    // 追蹤首次創建便利貼
    if (!hasCreatedFirstNote) {
      ga4.trackFirstNoteCreation(noteId, content);
      setHasCreatedFirstNote(true);
    }
    
    // 一般便利貼追蹤
    ga4.trackNoteAction('create', noteId, {
      totalNotes: notes.length + 1
    });
  };

  const handleAIOperation = (operation: string) => {
    // 追蹤首次 AI 使用
    if (!hasUsedAI) {
      ga4.trackFirstAIUsage(operation);
      setHasUsedAI(true);
    }
    
    // 一般 AI 操作追蹤
    ga4.trackAIOperation(operation, true, {
      generatedNotesCount: result.notes.length
    });
  };

  const handleSaveProject = (projectId: string, projectName: string) => {
    const isFirstProject = !localStorage.getItem('hasCreatedProject');
    
    ga4.trackProjectSave(projectId, projectName, isFirstProject);
    
    if (isFirstProject) {
      localStorage.setItem('hasCreatedProject', 'true');
    }
  };
}
```

## 📈 在 GA4 控制台設定 Funnel

### 1. 登入 GA4 控制台
訪問 [Google Analytics](https://analytics.google.com/)

### 2. 創建探索報告
1. 點擊左側選單的「探索」
2. 選擇「漏斗探索」模板

### 3. 設定漏斗步驟

在「步驟」部分，按順序添加以下事件：

| 步驟 | 事件名稱 | 參數篩選 |
|------|----------|----------|
| 1 | page_view | funnel_step = 01_landing_view |
| 2 | select_content | funnel_step = 02_cta_click |
| 3 | view_item | funnel_step = 03_login_view |
| 4 | login | funnel_step = 04_login_attempt |
| 5 | sign_up 或 login | funnel_step = 05_*_success |
| 6 | tutorial_begin | funnel_step = 06_whiteboard_first_view |
| 7 | level_start | funnel_step = 07_first_note_created |
| 8 | unlock_achievement | funnel_step = 08_ai_feature_used |
| 9 | generate_lead | funnel_step = 09_project_saved |
| 10 | purchase | funnel_step = 10_plus_upgrade |

### 4. 設定漏斗選項

- **漏斗類型**: 開放式漏斗（Open Funnel）
- **時間範圍**: 7 天（可調整）
- **區段**: 所有用戶（或特定區段）

### 5. 添加細分維度

可以按以下維度細分漏斗：
- `auth_method` - 登入方式
- `button_location` - CTA 位置
- `ai_feature` - AI 功能類型
- `user_type` - 用戶類型

## 📊 關鍵指標追蹤

### 轉換率指標
- **整體轉換率**: 從步驟 1 到步驟 10 的完成率
- **階段轉換率**: 每個步驟之間的轉換率
- **關鍵節點**: 
  - 註冊轉換率（步驟 1→5）
  - 激活率（步驟 5→7）
  - 付費轉換率（步驟 5→10）

### 時間指標
- **Time to Signup**: 從訪問到註冊的時間
- **Time to First Action**: 從註冊到首次操作的時間
- **Time to Conversion**: 從註冊到付費的時間

## 🎯 優化建議

### 1. 設定目標和警報
在 GA4 中設定以下目標：
- 註冊轉換率 > 20%
- 激活率 > 60%
- 付費轉換率 > 5%

### 2. A/B 測試追蹤
使用自訂參數追蹤不同版本：
```typescript
ga4.trackCTAClick('hero', {
  variant: 'A', // 或 'B'
  button_text: 'Get Started Free'
});
```

### 3. 流失分析
關注高流失率的步驟：
- 步驟 3→4（登入頁面→嘗試登入）
- 步驟 5→6（登入成功→使用產品）
- 步驟 7→8（創建便利貼→使用 AI）

## 🔍 除錯和驗證

### 1. 使用 GA4 DebugView
1. 在瀏覽器安裝 [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger)
2. 在 GA4 控制台選擇「DebugView」
3. 測試每個漏斗步驟，確認事件正確發送

### 2. 使用瀏覽器開發者工具
```javascript
// 在 Console 中檢查事件
window.dataLayer.forEach(event => {
  if (event[0] === 'event') {
    console.log('Event:', event[1], event[2]);
  }
});
```

### 3. 驗證檢查清單
- [ ] 所有 10 個步驟的事件都正確觸發
- [ ] 事件參數包含 funnel_step 和 funnel_name
- [ ] user_id 在登入後正確設定
- [ ] 轉換事件（purchase）包含正確的價值

## 📝 報告模板

### 週報指標
```
週次: [YYYY-WW]
期間: [開始日期] - [結束日期]

漏斗表現:
- 總訪問數: XXX
- 註冊數: XXX (轉換率: XX%)
- 激活用戶: XXX (激活率: XX%)
- 付費轉換: XXX (付費率: XX%)

關鍵洞察:
1. [最大的流失點]
2. [表現最好的獲客渠道]
3. [需要優化的步驟]

下週行動計畫:
1. [優化項目 1]
2. [優化項目 2]
```

## 🚀 進階功能

### 1. 預測分析
使用 GA4 的預測指標：
- 購買可能性
- 流失可能性
- 預測收入

### 2. 受眾建立
基於漏斗行為創建受眾：
- 「高價值潛在客戶」- 完成步驟 7 但未完成步驟 10
- 「需要引導用戶」- 完成步驟 5 但未完成步驟 7
- 「流失風險用戶」- 7 天未活躍

### 3. 自動化行銷
將受眾同步到 Google Ads 或其他行銷工具進行再行銷。

## 📚 相關資源

- [GA4 官方文件](https://support.google.com/analytics/answer/9327972)
- [漏斗探索指南](https://support.google.com/analytics/answer/9329832)
- [事件追蹤最佳實踐](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [GA4 API 文件](https://developers.google.com/analytics/devguides/reporting/data/v1)