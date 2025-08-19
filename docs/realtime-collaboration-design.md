# ThinkBoard 即時協作功能設計文件

## 1. 執行摘要

本文件規劃 ThinkBoard 白板應用程式的即時多人協作功能設計。透過整合 WebSocket 技術與現有的 Firebase 基礎設施，讓多個使用者能夠同時在同一個白板上進行編輯，並即時看到彼此的操作。

## 2. 現有架構分析

### 2.1 目前技術堆疊
- **前端框架**: Next.js 15 + React 19 + TypeScript
- **狀態管理**: React State (useState) 於 Whiteboard 元件中集中管理
- **資料儲存**: Firebase Firestore
- **身份驗證**: NextAuth + Firebase Adapter
- **UI 框架**: Tailwind CSS

### 2.2 資料結構
```typescript
WhiteboardData {
  notes: StickyNote[]      // 便利貼
  edges: Edge[]            // 連線
  groups: Group[]          // 群組
  images: ImageElement[]   // 圖片
  viewport: ViewportState  // 視窗狀態
}
```

### 2.3 現有同步機制
- 目前使用 Firebase Firestore 進行資料持久化
- 透過 `/api/sync` API 端點進行 CRUD 操作
- 單向同步：本地變更 → Firebase
- 無即時同步機制

## 3. 即時協作需求分析

### 3.1 核心功能需求
1. **即時同步**: 所有使用者的操作需即時反映給其他協作者
2. **使用者游標**: 顯示其他使用者的游標位置
3. **使用者識別**: 每個使用者有獨特的顏色和名稱標識
4. **衝突解決**: 自動處理同時編輯的衝突
5. **離線支援**: 斷線後能自動重連並同步資料
6. **權限控制**: 專案擁有者可以管理協作者權限

### 3.2 同步範圍
需要即時同步的操作：
- 便利貼的新增/刪除/移動/編輯
- 連線的新增/刪除
- 群組的建立/修改/刪除
- 圖片的上傳/移動/刪除
- 視窗的縮放/平移（可選）

### 3.3 效能需求
- 延遲 < 100ms（同地區）
- 支援 10+ 同時在線使用者
- 資料傳輸優化（差異更新）

## 4. 技術方案設計

### 4.1 架構概覽

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Client A  │◄──────────────────►│             │
└─────────────┘                    │             │
                                   │  WebSocket  │
┌─────────────┐     WebSocket      │   Server    │
│   Client B  │◄──────────────────►│             │
└─────────────┘                    │             │
                                   └──────┬──────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │  Firebase   │
                                   │  Firestore  │
                                   └─────────────┘
```

### 4.2 技術選型

#### WebSocket 伺服器方案比較：

| 方案 | 優點 | 缺點 | 建議 |
|------|------|------|------|
| **Socket.IO** | 成熟穩定、自動重連、房間管理 | 額外協議開銷 | ✅ 推薦 |
| Pusher | 託管服務、易於整合 | 成本較高、依賴第三方 | 備選 |
| 原生 WebSocket | 輕量、無依賴 | 需自行實現房間、重連等 | 不推薦 |

### 4.3 實作架構

#### 4.3.1 後端架構
```typescript
// /app/api/socket/route.ts
// Socket.IO 伺服器端點

interface CollaborationRoom {
  projectId: string
  users: Map<string, UserInfo>
  lastActivity: Date
}

interface UserInfo {
  id: string
  name: string
  email: string
  color: string
  cursor?: { x: number, y: number }
}

// 事件類型
type CollaborationEvent = 
  | NoteEvent
  | EdgeEvent
  | GroupEvent
  | CursorEvent
  | UserEvent
```

#### 4.3.2 前端整合
```typescript
// /app/hooks/useCollaboration.ts
export function useCollaboration(projectId: string) {
  const [collaborators, setCollaborators] = useState<UserInfo[]>([])
  const [isConnected, setIsConnected] = useState(false)
  
  // 建立 WebSocket 連接
  // 處理即時事件
  // 發送本地變更
  
  return {
    collaborators,
    isConnected,
    sendUpdate,
    // ...
  }
}
```

### 4.4 資料同步策略

#### 4.4.1 操作轉換 (Operational Transformation)
使用 OT 演算法處理並發編輯：
1. 每個操作都有版本號
2. 衝突時自動轉換操作
3. 保證最終一致性

#### 4.4.2 衝突解決策略
- **Last Write Wins (LWW)**: 用於位置、顏色等屬性
- **CRDT**: 用於文字內容的協作編輯
- **版本向量**: 追蹤每個客戶端的操作歷史

### 4.5 優化策略

#### 4.5.1 資料傳輸優化
- **差異更新**: 只傳送變更的部分
- **批次處理**: 將多個小操作合併傳送
- **壓縮**: 使用 gzip 壓縮大型資料

#### 4.5.2 效能優化
- **防抖動**: 移動操作防抖 50ms
- **節流**: 游標更新節流 100ms
- **虛擬化**: 只渲染可見區域的協作者游標

## 5. 實施計畫

### 第一階段：基礎設施（1-2 週）
1. 設置 Socket.IO 伺服器
2. 建立 WebSocket 連接管理
3. 實作基本的房間管理

### 第二階段：核心同步（2-3 週）
1. 實作便利貼同步
2. 實作連線同步
3. 實作群組同步
4. 測試與調試

### 第三階段：協作功能（1-2 週）
1. 實作使用者游標
2. 實作使用者狀態顯示
3. 實作權限管理

### 第四階段：優化與完善（1 週）
1. 效能優化
2. 錯誤處理
3. 離線支援

## 6. 實作細節

### 6.1 Socket.IO 事件設計

```typescript
// 客戶端 → 伺服器
socket.emit('join-project', { projectId, userId })
socket.emit('leave-project', { projectId })
socket.emit('note-update', { noteId, changes })
socket.emit('cursor-move', { x, y })

// 伺服器 → 客戶端
socket.on('user-joined', (userInfo) => {})
socket.on('user-left', (userId) => {})
socket.on('state-sync', (whiteboardData) => {})
socket.on('note-updated', (update) => {})
socket.on('cursor-moved', ({ userId, x, y }) => {})
```

### 6.2 狀態管理整合

```typescript
// 修改 Whiteboard.tsx
const Whiteboard = () => {
  // 現有狀態...
  
  // 協作狀態
  const { 
    collaborators, 
    isConnected, 
    sendUpdate 
  } = useCollaboration(currentProjectId)
  
  // 修改狀態更新函數，加入同步
  const updateNote = (noteId: string, changes: Partial<StickyNote>) => {
    // 本地更新
    setWhiteboardData(prev => ...)
    
    // 同步到其他使用者
    sendUpdate('note-update', { noteId, changes })
  }
}
```

### 6.3 UI/UX 設計

#### 協作者顯示
- 右上角顯示在線使用者頭像
- 游標旁顯示使用者名稱
- 使用者選中物件時顯示彩色邊框

#### 狀態指示
- 連接狀態圖標（綠色=已連接，黃色=重連中，紅色=斷線）
- 同步狀態提示（正在同步/已同步）

## 7. 安全性考量

1. **身份驗證**: 使用現有的 NextAuth session 驗證 WebSocket 連接
2. **授權**: 檢查使用者是否有權限訪問專案
3. **資料驗證**: 驗證所有傳入的操作資料
4. **速率限制**: 防止惡意使用者發送過多請求

## 8. 測試計畫

### 單元測試
- 測試 OT 演算法
- 測試衝突解決邏輯

### 整合測試
- 測試多使用者同步
- 測試斷線重連
- 測試資料一致性

### 效能測試
- 測試 10+ 使用者同時操作
- 測試大型白板（1000+ 便利貼）

## 9. 未來擴展

1. **版本控制**: 查看歷史版本、回滾功能
2. **評論系統**: 在便利貼上留言討論
3. **鎖定機制**: 鎖定特定元素防止他人編輯
4. **即時語音/視訊**: 整合通話功能
5. **AI 協作**: AI 助手參與協作

## 10. 結論

透過整合 Socket.IO 與現有的 Firebase 基礎設施，我們可以為 ThinkBoard 添加強大的即時協作功能。這個設計方案考慮了效能、可擴展性和使用者體驗，能夠提供流暢的多人協作體驗。

建議先實作基礎同步功能，再逐步添加進階功能，確保系統的穩定性和可靠性。