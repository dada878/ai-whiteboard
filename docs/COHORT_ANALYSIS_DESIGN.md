# 時間群組分析系統設計

## 概念說明

### Cohort Analysis (群組分析)
將用戶按**首次註冊/使用時間**分組，然後追蹤每個群組在後續時間的行為表現。

### 分群策略
1. **週群組**: 2024-W1, 2024-W2, 2024-W3...
2. **月群組**: 2024-01, 2024-02, 2024-03...
3. **自定義期間**: 可設定任意開始/結束日期

## 分析維度

### 1. 留存分析 (Retention Analysis)
- **D1 留存**: 註冊後第1天還有使用
- **D7 留存**: 註冊後第7天還有使用  
- **D30 留存**: 註冊後第30天還有使用
- **週留存**: 註冊後第1週、第2週、第3週...還有使用

### 2. 使用行為分析
- **平均會話時長**: 每個群組的使用深度
- **便利貼創建率**: 創作活躍度
- **AI 使用率**: 核心功能採用率
- **功能探索度**: 使用了多少不同功能

### 3. 商業指標分析
- **轉換率**: 免費 → Premium 轉換
- **流失率**: 每週/月的用戶流失
- **生命週期價值**: LTV 計算

## 應用場景

### 產品迭代追蹤
```
第1週群組: 改版前註冊的用戶
第2週群組: 改版後註冊的用戶
比較: 看改版效果
```

### A/B 測試分析
```
控制組: 某週註冊的用戶 (舊功能)
實驗組: 下週註冊的用戶 (新功能) 
比較: 看功能影響
```

### 季節性分析
```
Q1群組 vs Q2群組 vs Q3群組
分析: 不同季節用戶的行為差異
```

## 數據結構

### weekly_cohorts 集合
```typescript
weekly_cohorts/{cohortWeek}_{userId} {
  cohortWeek: string;        // "2024-W32"
  userId: string;
  signupDate: Timestamp;
  signupWeek: string;
  
  // 留存數據
  week1Retention: boolean;   // 第1週是否活躍
  week2Retention: boolean;   // 第2週是否活躍
  week3Retention: boolean;   // 第3週是否活躍
  week4Retention: boolean;   // 第4週是否活躍
  
  // 累積數據
  totalSessions: number;
  totalNotesCreated: number;
  totalAIOperations: number;
  totalSessionDuration: number; // 分鐘
  
  // 每週詳細數據
  weeklyStats: {
    week1: { sessions: number, notes: number, aiOps: number, duration: number };
    week2: { sessions: number, notes: number, aiOps: number, duration: number };
    week3: { sessions: number, notes: number, aiOps: number, duration: number };
    week4: { sessions: number, notes: number, aiOps: number, duration: number };
  };
  
  // 轉換數據
  convertedToPremium: boolean;
  conversionDate?: Timestamp;
  conversionWeek?: number;    // 第幾週轉換的
  
  lastActiveDate: Timestamp;
  isActive: boolean;
}
```

### cohort_summaries 集合
```typescript
cohort_summaries/{cohortWeek} {
  cohortWeek: string;        // "2024-W32"
  startDate: Timestamp;
  endDate: Timestamp;
  
  totalUsers: number;
  
  // 留存率
  retentionRates: {
    week1: number;           // 70.5%
    week2: number;           // 45.2%
    week3: number;           // 32.1%
    week4: number;           // 25.8%
  };
  
  // 平均指標
  avgSessionsPerUser: number;
  avgNotesPerUser: number;
  avgAIOperationsPerUser: number;
  avgSessionDuration: number;
  
  // 轉換指標
  premiumConversionRate: number;
  avgTimeToConversion: number; // 天
  
  // 同期比較 (相對於上一群組)
  retentionGrowth: {
    week1: number;           // +15.2% vs last cohort
    week2: number;           // +8.7% vs last cohort
  };
  
  lastUpdated: Timestamp;
}
```