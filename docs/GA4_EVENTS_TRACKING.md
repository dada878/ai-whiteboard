# GA4 事件追蹤完整列表

## 📊 目前已實作的事件追蹤

### 1. 用戶認證事件 (Authentication)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `auth_login` | 用戶登入時 | `user_id`, `method` (google/email), `session_id` |
| `auth_logout` | 用戶登出時 | `user_id`, `session_duration` |
| `auth_signup` | 新用戶註冊時 | `user_id`, `method` |

### 2. 便利貼操作事件 (Sticky Notes)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `note_create` | 創建新便利貼 | `user_id`, `note_id`, `x_position`, `y_position`, `total_notes`, `color` |
| `note_edit` | 編輯便利貼內容 | `user_id`, `note_id` |
| `note_delete` | 刪除便利貼 | `user_id`, `note_id` |
| `note_move` | 移動便利貼位置 | `user_id`, `note_id`, `new_x`, `new_y` |

### 3. AI 功能事件 (AI Operations)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `ai_brainstorm` | 使用 AI 腦力激盪 | `user_id`, `source_note_id`, `generated_notes_count`, `network_depth`, `related_notes_count`, `success` |
| `ai_analyze` | 使用 AI 分析 | `user_id`, `notes_analyzed`, `success` |
| `ai_summarize` | 使用 AI 摘要 | `user_id`, `notes_count`, `success` |
| `ai_ask` | 使用 AI 問答 | `user_id`, `source_note_id`, `prompt_length`, `success` |
| `ai_network` | 使用網絡分析 | `user_id`, `nodes_count`, `connections_count`, `success` |

### 4. 專案管理事件 (Project Management)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `project_create` | 創建新專案 | `user_id`, `project_id`, `project_name`, `project_description` |
| `project_open` | 開啟/切換專案 | `user_id`, `project_id`, `project_name`, `notes_count` |
| `project_save` | 儲存專案 | `user_id`, `project_id`, `auto_save` |
| `project_delete` | 刪除專案 | `user_id`, `project_id` |
| `project_share` | 分享專案 | `user_id`, `project_id`, `share_method` |

### 5. 匯出功能事件 (Export)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `export` | 匯出白板內容 | `user_id`, `format` (png/pdf/json), `notes_count`, `edges_count`, `groups_count` |

### 6. 圖片操作事件 (Images)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `image_upload` | 上傳圖片 | `user_id`, `image_size`, `image_type` |
| `image_delete` | 刪除圖片 | `user_id`, `image_id` |
| `image_resize` | 調整圖片大小 | `user_id`, `image_id`, `new_width`, `new_height` |

### 7. 群組操作事件 (Groups)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `group_create` | 創建群組 | `user_id`, `group_id`, `notes_count` |
| `group_delete` | 刪除群組 | `user_id`, `group_id` |
| `group_update` | 更新群組 | `user_id`, `group_id`, `action` |

### 8. 用戶參與度事件 (Engagement)

| 事件名稱 | 觸發時機 | 參數 |
|---------|---------|------|
| `session_engagement` | 會話結束時 | `user_id`, `session_duration`, `notes_created`, `ai_operations` |
| `feature_use` | 使用特定功能 | `user_id`, `feature_name`, `context` |

## 🎯 建議標記為轉換的事件

在 GA4 管理介面中，建議將以下事件標記為「轉換」：

1. **`ai_brainstorm`** - 核心 AI 功能使用
2. **`ai_analyze`** - 深度分析功能
3. **`export`** - 價值實現（用戶覺得內容有價值才會匯出）
4. **`project_create`** - 深度參與指標
5. **`auth_signup`** - 新用戶獲取

## 📈 自定義維度建議

在 GA4 管理 → 自定義定義中，建議創建以下自定義維度：

### 用戶範圍 (User-scoped)
- `user_id` - 用戶唯一識別碼
- `is_plus` - 是否為付費用戶
- `display_name` - 用戶顯示名稱

### 事件範圍 (Event-scoped)
- `total_notes` - 便利貼總數
- `ai_operation_type` - AI 操作類型
- `export_format` - 匯出格式
- `project_name` - 專案名稱
- `success` - 操作是否成功

## 🔍 實用的 GA4 探索報表

### 1. AI 功能採用漏斗
路徑：登入 → 創建便利貼 → 使用 AI → 匯出

### 2. 用戶留存群組分析
- 依註冊週分群
- 追蹤每週回訪率
- 比較不同功能對留存的影響

### 3. 功能使用熱力圖
- 哪些 AI 功能最受歡迎
- 用戶平均使用幾個不同功能
- 功能之間的使用關聯性

### 4. 轉換路徑分析
- 從註冊到首次使用 AI 的路徑
- 從創建便利貼到匯出的路徑
- 付費轉換路徑（如果有付費功能）

## 🛠️ 實作位置

主要追蹤程式碼位於：
- `/lib/gtag.ts` - GA4 核心函數
- `/app/components/Whiteboard.tsx` - 主要事件觸發點
- `/app/components/GoogleAnalytics.tsx` - GA4 Script 載入

## 📝 開發環境測試

在開發環境中，事件會在 Console 顯示而不發送：
```javascript
[GA Event] note_create {
  category: "Note",
  user_id: "xxx",
  total_notes: 5
}
```

若要在開發環境測試真實發送，可暫時修改 `/lib/gtag.ts`：
```typescript
export const isProd = true; // 暫時強制發送
```

## 🚀 未來可新增的追蹤

- **協作事件** - 如果加入多人協作功能
- **模板使用** - 追蹤哪些模板最受歡迎
- **搜尋行為** - 用戶搜尋什麼內容
- **錯誤追蹤** - API 錯誤、載入失敗等
- **效能指標** - 頁面載入時間、API 回應時間

## 📊 查看數據

1. **即時報表**：GA4 → 報表 → 即時
2. **事件報表**：GA4 → 報表 → 參與 → 事件
3. **DebugView**：GA4 → 管理 → DebugView（需安裝 GA Debugger）
4. **探索**：GA4 → 探索（建立自定義報表）

---

最後更新：2024-08-17
Measurement ID: G-PEP72CMLD6