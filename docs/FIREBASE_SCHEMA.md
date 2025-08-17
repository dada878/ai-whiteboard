# Firebase 數據結構設計

## Collections 結構

### 1. users 集合
```typescript
users/{userId} {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isAdmin?: boolean;
  role?: 'admin' | 'user';
  isPremium?: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  totalSessions: number;
  totalNotesCreated: number;
  totalAIOperations: number;
}
```

### 2. user_events 集合
```typescript
user_events/{eventId} {
  userId: string;
  sessionId: string;
  eventType: 'login' | 'logout' | 'note_created' | 'note_edited' | 'note_deleted' | 
            'ai_operation' | 'project_created' | 'project_opened' | 'export' | 'import';
  timestamp: Timestamp;
  metadata: {
    noteId?: string;
    aiOperation?: 'brainstorm' | 'analyze' | 'summarize' | 'ask';
    projectId?: string;
    exportFormat?: 'png' | 'pdf' | 'json';
    position?: { x: number; y: number };
    totalNotes?: number;
    generatedNotesCount?: number;
    success?: boolean;
  };
}
```

### 3. user_sessions 集合
```typescript
user_sessions/{sessionId} {
  userId: string;
  sessionId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration?: number; // 分鐘
  eventCount: number;
  notesCreated: number;
  notesEdited: number;
  notesDeleted: number;
  aiOperations: number;
  projectsAccessed: string[]; // projectIds
  isActive: boolean;
  userAgent?: string;
  lastActivity: Timestamp;
}
```

### 4. daily_stats 集合 (聚合數據)
```typescript
daily_stats/{date} { // format: YYYY-MM-DD
  date: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  premiumUsers: number;
  totalSessions: number;
  totalEvents: number;
  totalNotesCreated: number;
  totalAIOperations: number;
  avgSessionDuration: number;
  topEventTypes: { [eventType]: number };
  updatedAt: Timestamp;
}
```

### 5. user_cohorts 集合 (留存分析)
```typescript
user_cohorts/{cohortId} {
  cohortDate: string; // YYYY-MM-DD
  userId: string;
  signupDate: Timestamp;
  // 留存數據
  day1Retention: boolean;
  day7Retention: boolean;
  day30Retention: boolean;
  // 活動數據
  sessionsCount: number;
  notesCreated: number;
  aiOperationsCount: number;
  lastActivityDate: string;
}
```

## 索引要求

### user_events 索引
- userId + timestamp (desc)
- eventType + timestamp (desc)
- sessionId + timestamp (desc)
- userId + eventType + timestamp (desc)

### user_sessions 索引
- userId + startTime (desc)
- startTime (desc) + isActive
- userId + isActive + startTime (desc)

### user_cohorts 索引
- cohortDate + day1Retention
- cohortDate + day7Retention  
- cohortDate + day30Retention
- userId + cohortDate

## 數據流程

1. **用戶登入**: 更新 users 表, 創建 user_sessions 記錄
2. **用戶操作**: 記錄到 user_events, 更新當前 session
3. **用戶登出**: 結束 session, 計算 duration
4. **定期聚合**: 每日計算統計數據到 daily_stats
5. **留存分析**: 每日更新 user_cohorts 數據