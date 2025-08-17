# AI Whiteboard 資料結構文件

## 核心資料模型

### 1. StickyNote（便利貼）

便利貼是白板上的基本元素，用於記錄想法、任務或資訊。

```typescript
interface StickyNote {
  id: string;           // 唯一識別碼，格式：'note_' + 時間戳記
  x: number;           // X 座標（像素）
  y: number;           // Y 座標（像素）
  width: number;       // 寬度（預設 200px）
  height: number;      // 高度（預設 100px）
  content: string;     // 文字內容（支援多行）
  color: string;       // 背景顏色（hex 格式，如 '#FFE066'）
  groupId?: string;    // 所屬群組 ID（選填）
}
```

**顏色選項**：
- 黃色：`#FFE066`（預設）
- 綠色：`#95E1D3`
- 藍色：`#A8E6CF`
- 粉色：`#FFD3E1`
- 紫色：`#C9B1FF`

### 2. Edge（連接線）

連接線用於表示便利貼之間的關係或流程。

```typescript
interface Edge {
  id: string;          // 唯一識別碼，格式：'edge_' + 時間戳記
  from: string;        // 起始便利貼 ID
  to: string;          // 目標便利貼 ID
}
```

**特性**：
- 有方向性（從 from 指向 to）
- 自動計算路徑（貝茲曲線）
- 箭頭指向目標便利貼
- 支援多重連接

### 3. Group（群組）

群組用於組織相關的便利貼和圖片。

```typescript
interface Group {
  id: string;                  // 唯一識別碼，格式：'group_' + 時間戳記
  name: string;                // 群組名稱
  color: string;               // 群組顏色（hex 格式）
  createdAt: Date;             // 建立時間
  noteIds: string[];           // 群組內便利貼的 ID 列表
  imageIds?: string[];         // 群組內圖片的 ID 列表
  parentGroupId?: string;      // 父群組 ID（支援巢狀群組）
  childGroupIds?: string[];    // 子群組 ID 列表
}
```

**巢狀規則**：
- 群組可以包含子群組（無限層級）
- 便利貼只能屬於一個群組
- 子群組會繼承父群組的視覺框架

### 4. ImageElement（圖片元素）

支援在白板上放置圖片。

```typescript
interface ImageElement {
  id: string;                  // 唯一識別碼，格式：'img_' + 時間戳記
  x: number;                   // X 座標
  y: number;                   // Y 座標
  width: number;               // 顯示寬度
  height: number;              // 顯示高度
  url: string;                 // 圖片 URL（base64 或外部連結）
  filename?: string;           // 原始檔案名稱
  uploadedAt?: Date;           // 上傳時間
  groupId?: string;            // 所屬群組 ID
}
```

**支援格式**：
- PNG、JPG、JPEG、GIF、SVG
- 最大檔案大小：10MB
- 自動縮放以適應白板

### 5. WhiteboardData（白板完整資料）

包含整個白板的所有資料。

```typescript
interface WhiteboardData {
  notes: StickyNote[];         // 所有便利貼
  edges: Edge[];               // 所有連接線
  groups: Group[];             // 所有群組
  images?: ImageElement[];     // 所有圖片
  viewport?: ViewportState;    // 視窗狀態
}
```

### 6. ViewportState（視窗狀態）

記錄使用者的視角設定。

```typescript
interface ViewportState {
  zoomLevel: number;           // 縮放等級（0.1 到 2.0）
  panOffset: {                 // 平移偏移
    x: number;
    y: number;
  };
}
```

## AI 相關資料結構

### 1. NetworkAnalysis（網絡分析）

用於分析便利貼之間的關係網絡。

```typescript
interface NetworkAnalysis {
  targetNote: StickyNote;              // 分析目標便利貼
  incomingConnections: NetworkConnection[];  // 傳入連接
  outgoingConnections: NetworkConnection[];  // 傳出連接
  allRelatedNotes: StickyNote[];       // 所有相關便利貼
  networkSize: number;                 // 網絡大小
}

interface NetworkConnection {
  note: StickyNote;                    // 連接的便利貼
  relationship: 'leads_to' | 'derives_from';  // 關係類型
}
```

### 2. AI 操作結果

AI 功能返回的結果格式。

```typescript
// 腦力激盪結果
interface BrainstormResult {
  ideas: Array<{
    content: string;
    category?: string;
    confidence: number;
  }>;
  suggestedConnections: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
}

// 分析結果
interface AnalysisResult {
  summary: string;
  keyThemes: string[];
  insights: string[];
  suggestions: Array<{
    type: 'add' | 'connect' | 'group';
    description: string;
  }>;
}

// 摘要結果
interface SummaryResult {
  executiveSummary: string;
  mainPoints: string[];
  actionItems: string[];
  nextSteps: string[];
}
```

## 專案與版本管理

### 1. Project（專案）

```typescript
interface Project {
  id: string;                  // 專案 ID
  name: string;                // 專案名稱
  createdAt: Date;             // 建立時間
  updatedAt: Date;             // 最後更新時間
  description?: string;        // 專案描述
  thumbnail?: string;          // 縮圖（base64）
  userId?: string;             // 擁有者 ID
  isPublic?: boolean;          // 是否公開
  collaborators?: string[];    // 協作者列表
}
```

### 2. Version（版本）

```typescript
interface Version {
  id: string;                  // 版本 ID
  projectId: string;           // 所屬專案 ID
  name: string;                // 版本名稱
  description?: string;        // 版本描述
  type: 'manual' | 'auto';     // 版本類型
  createdAt: Date;             // 建立時間
  data: WhiteboardData;        // 白板資料快照
  stats: {                     // 統計資訊
    notes: number;
    edges: number;
    groups: number;
    images: number;
  };
}
```

## 使用者互動狀態

### 1. Selection State（選擇狀態）

```typescript
interface SelectionState {
  selectedNotes: Set<string>;          // 選中的便利貼 ID
  selectedGroups: Set<string>;         // 選中的群組 ID
  selectedEdges: Set<string>;          // 選中的連接線 ID
  selectedImages: Set<string>;         // 選中的圖片 ID
  isMultiSelect: boolean;              // 是否多選模式
  selectionBox?: {                     // 選擇框
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
}
```

### 2. Drag State（拖曳狀態）

```typescript
interface DragState {
  isDragging: boolean;                 // 是否正在拖曳
  draggedElement?: {                   // 被拖曳的元素
    type: 'note' | 'group' | 'image';
    id: string;
    offsetX: number;
    offsetY: number;
  };
  draggedOverGroup?: string;           // 懸停的群組 ID
  showAlignmentGuides: boolean;        // 是否顯示對齊輔助線
}
```

### 3. History State（歷史狀態）

```typescript
interface HistoryState {
  past: WhiteboardData[];              // 過去的狀態
  present: WhiteboardData;             // 當前狀態
  future: WhiteboardData[];            // 未來的狀態（重做）
  canUndo: boolean;                    // 是否可以復原
  canRedo: boolean;                    // 是否可以重做
}
```

## 資料驗證規則

### 便利貼驗證
- `id`：必須唯一，不可重複
- `content`：最多 500 個字元
- `x, y`：必須為正數或零
- `width`：最小 100px，最大 400px
- `height`：最小 50px，最大 300px
- `color`：必須為有效的 hex 顏色碼

### 連接線驗證
- `from` 和 `to` 必須指向存在的便利貼
- 不可自己連到自己
- 不可重複建立相同的連接

### 群組驗證
- `name`：最多 50 個字元
- `noteIds` 中的 ID 必須指向存在的便利貼
- 巢狀群組不可形成循環引用

## 資料儲存策略

### 本地儲存（localStorage）
- 鍵名：`whiteboard_data`
- 格式：JSON 字串
- 大小限制：約 5-10MB
- 自動儲存間隔：每 30 秒

### 雲端儲存（Firebase）
- 集合：`projects`、`versions`
- 文件大小限制：1MB
- 圖片儲存：Firebase Storage
- 即時同步：使用 Firestore 監聽器

### 版本管理
- 自動備份：每 5 分鐘
- 保留策略：最近 10 個自動備份
- 手動備份：無數量限制
- 版本比較：使用簡單雜湊檢測變更

## 效能考量

### 大量資料處理
- 便利貼數量上限建議：1000 個
- 使用虛擬化技術顯示大量元素
- 分批載入和渲染
- 使用 Web Workers 處理複雜計算

### 記憶體管理
- 定期清理未使用的圖片資料
- 限制歷史記錄堆疊大小（最多 50 筆）
- 使用 WeakMap 存儲臨時資料
- 實施懶載入策略

### 網路優化
- 批量同步變更（debounce）
- 壓縮大型資料
- 使用增量更新而非全量更新
- 實施離線優先策略