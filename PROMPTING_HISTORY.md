# Prompting History

## 2025-08-17

### 升級 AI Agent 到 GPT-4o 模型

**使用者需求**：
將 AI Agent 從 GPT-3.5-turbo 升級到 GPT-4o 以獲得更好的性能。

**升級內容**：
1. **模型升級**：
   - `stream-natural/route.ts` 中的模型從 `gpt-3.5-turbo` 改為 `gpt-4o`
   - GPT-4o 支援 128K context window

2. **Token 限制放寬**：
   - `truncateMessages` 的 maxTokens 從 10000 提升到 50000
   - 不再需要激進的訊息截斷策略
   - 保留更完整的對話歷史和工具調用結果

3. **優勢**：
   - 更強的推理能力
   - 更好的工具使用決策
   - 更長的上下文記憶
   - 更準確的回答品質

### 統一 AI Agent MAX_TOOL_CALLS 設定

**使用者需求**：
統一所有 AI Agent 路由的 MAX_TOOL_CALLS 設定為 20。

**解決方案**：
將以下檔案的 MAX_TOOL_CALLS 從 5 改為 20：
- `/app/api/ai-agent/stream-multi/route.ts`
- `/app/api/ai-agent/stream-reflection/route.ts`
- `/app/api/ai-agent/stream-intent/route.ts`

保持 `/app/api/ai-agent/stream-natural/route.ts` 的設定為 20。

### 修復 AI Agent 停止邏輯問題

**使用者需求**：
修復 AI Agent 明明在反思中說需要繼續探索，但卻停止執行的問題。

**問題分析**：
1. AI 在反思後說需要繼續，但下一輪循環時 GPT 沒有生成 tool_calls
2. 原邏輯會直接設定 `shouldContinue = false` 並停止

**解決方案**：
在 `stream-natural/route.ts` 中改進邏輯：
- 當 AI 沒有調用工具時，檢查最近的反思內容
- 如果反思包含「需要」「繼續」「探索」等關鍵字，添加明確指示讓 AI 繼續
- 設定 `shouldContinue = true` 強制循環繼續

## 2025-08-17

### 修復 AI Chat 面板樣式對比度問題

**使用者需求**：
修復 AI Chat 面板中的亮色/暗色模式樣式問題，移除所有暗色模式的殘留樣式，確保永遠使用亮色模式，改善文字對比度和背景顏色的一致性。

**問題分析**：
AI Chat 面板中存在大量的 `dark:` Tailwind 類別，這些類別在某些情況下會產生對比度不佳的問題，包括：
- 深色背景配亮色文字，看不清楚
- 某些地方變得特別暗
- 不一致的樣式體驗

**解決方案**：
1. **系統性檢查**：使用 `grep` 搜尋所有 `dark:` 樣式
2. **批量修復**：移除 `AIChatPanelStream.tsx` 中的 61 處 `dark:` 樣式
3. **保持一致性**：確保所有元素都使用統一的亮色模式樣式

**修復的樣式問題**：
- ✅ 移除詳細資料區塊的暗色背景
- ✅ 修復工具調用結果的文字對比度
- ✅ 統一意圖分析、決策、反思等區塊的樣式
- ✅ 修復 Prompt 顯示元件的對比度
- ✅ 確保所有白色背景和灰色邊框的一致性

**技術細節**：
- 移除所有 `dark:bg-gray-800`、`dark:text-gray-300` 等樣式
- 統一使用 `bg-white`、`text-gray-700`、`border-gray-200` 等亮色樣式
- 保持 MarkdownContent 元件的強制亮色模式設計

### 將版本號顯示器移動到用戶下拉選單

**使用者需求**：
將目前固定在右下角的版本號顯示器移動到頁面右上角用戶名稱的下拉選單中，避免擋到其他元素。

**解決方案**：
1. **移除原版本顯示器**：
   - 從 `app/page.tsx` 移除 `<VersionDisplay />` 元件
   - 移除相關 import

2. **修改 AuthButton 元件**：`app/components/AuthButton.tsx`
   - 新增 `VersionInfo` 介面定義
   - 新增版本信息載入邏輯和狀態管理
   - 新增 `formatDate` 格式化函數
   - 在用戶下拉選單中新增版本信息區塊
   - 版本信息顯示在「登出」按鈕之前，包含 commit hash 和建置時間

3. **功能特色**：
   - ✅ 自動載入 `/version.json` 文件
   - ✅ 支援暗色模式樣式
   - ✅ 整合在現有用戶介面流程中
   - ✅ 不會干擾其他元素的操作

### 改進 AI Chat 快速開始問題為動態生成

**使用者需求**：
將 AI Chat 的快速開始問題從硬編碼的關鍵字判別改為真正的 AI 生成動態問題。

**解決方案**：
1. **新建 API Route**：`/app/api/ai-agent/generate-questions/route.ts`
   - 使用 OpenAI GPT-4o-mini 模型分析白板內容
   - 根據便利貼內容、群組結構、連接關係生成相關問題
   - 回退機制：無 API key 時返回預設問題

2. **前端組件改進**：在 `AIChatPanelStream.tsx` 中
   - 移除硬編碼的 `generateDynamicQuestions` 函數
   - 新增 `generateQuickQuestions` 函數調用新 API
   - 添加載入狀態指示器
   - 當白板數據變化時自動重新生成問題

3. **技術特點**：
   - 智能分析白板摘要，包含便利貼內容、群組信息、連接關係
   - 生成具體且針對性的問題（15字以內）
   - 優雅降級：API 失敗時保持預設問題
   - 用戶體驗：載入時顯示 spinner，問題生成中禁用按鈕

**後續優化**：
4. **背景預載入機制**：解決用戶體驗問題
   - 將問題生成邏輯移到 `SidePanel.tsx` 上層元件
   - 在背景自動生成問題，避免切換到對話頁面時才開始載入
   - 通過 props 將預載入的問題狀態傳遞給 `AIChatPanelStream`
   - 添加防抖機制避免頻繁的 API 調用

**檔案修改**：
- 新建：`/app/api/ai-agent/generate-questions/route.ts`
- 修改：`/app/components/AIChat/AIChatPanelStream.tsx`
- 修改：`/app/components/SidePanel.tsx`

### 之前記錄

### 設計 AI Agent 對話功能

**使用者需求**：
設計一個 AI Agent 對話功能，位於右側側邊欄，可以與 AI 對話、詢問問題（如產品行銷策略），AI 可以調用工具來搜尋便利貼、建立新元素、管理群組等。

**設計方案**：
1. **對話介面**：在右側側邊欄實現對話 UI
2. **白板理解**：AI 自動生成白板摘要，理解內容結構
3. **工具系統**：設計 7 種工具供 AI 調用
4. **智能互動**：AI 可以根據對話內容執行操作

**技術架構**：
- **工具定義**：
  - SearchTool：搜尋便利貼（支援 3-4 個關鍵字）
  - CreateNoteTool：建立新便利貼
  - CreateEdgeTool：建立連接
  - GroupTool：管理群組
  - LayoutTool：優化佈局
  - AnalyzeTool：分析內容
  - SummarizeTool：生成摘要

- **核心元件**：
  - AIChatPanel：主對話面板
  - ChatMessage：訊息顯示
  - ToolExecutor：工具執行器
  - WhiteboardContext：上下文管理

**檔案建立**：
- `/docs/AI_AGENT_DESIGN.md` - 詳細設計文件
- `/app/types/aiAgent.ts` - 類型定義和工具介面

**實作階段規劃**：
1. 第一階段：基礎對話介面
2. 第二階段：搜尋功能實作
3. 第三階段：建立功能實作
4. 第四階段：進階工具整合
5. 第五階段：優化和測試

### 優化群組拖曳檢測邏輯

**使用者需求**：
群組拖曳時的檢測應該基於滑鼠位置，而不是重疊面積超過 50%。

**解決方案**：
將檢測邏輯從 `checkGroupOverGroup`（基於重疊面積）改為 `checkMouseOverGroup`（基於滑鼠座標），只要滑鼠進入目標群組範圍就會觸發。

**檔案修改**：
- `/app/components/Whiteboard.tsx` - 修改檢測函數（第 916-941、2046 行）

### 實現群組拖曳變成子群組功能

**使用者需求**：
希望能將一個群組拖曳到另一個群組內，讓小群組變成大群組的子群組，類似便利貼拖入群組的行為。限制條件是被拖曳的群組不能有父群組（只能是頂層群組）。

**解決方案**：
實現了群組拖曳到其他群組變成子群組的功能，包括：
1. 檢測群組拖曳時是否懸停在其他群組上
2. 視覺回饋效果（群組邊框變綠色）
3. 放開時自動將群組變成子群組

**技術實現**：
- **新增狀態**：`draggedGroupHoveredGroup` 追蹤群組拖曳時懸停的目標群組
- **檢測函數** (`checkGroupOverGroup`)：
  - 檢查被拖曳群組是否有父群組（有則不能再成為子群組）
  - 計算群組間的重疊區域
  - 當重疊區域超過被拖曳群組面積的 50% 時，視為有效懸停
- **拖曳處理**：
  - 在 `handleGlobalMouseMove` 中即時檢測懸停狀態
  - 在 `handleGlobalMouseUp` 中處理群組變成子群組的邏輯
  - 更新群組的 `parentGroupId` 和 `childGroupIds`
- **視覺效果**：
  - Group 元件的 `isDragHovered` prop 同時檢查便利貼和群組的懸停狀態
  - 懸停時群組邊框變為綠色

**檔案修改**：
- `/app/components/Whiteboard.tsx` - 新增狀態和邏輯（第 57、916-952、2047-2105、4560、4733 行）

## 2025-08-17

### 實作版本記錄功能

**使用者需求**：
原本有在實作一個版本記錄的功能，一段時間記錄一下目前的狀態，然後讓之後可以回溯到之前的狀態，防止資料流失。但這個功能應該是做到一半了，需要找到目前的進度並完成它。

**解決方案**：
完成了版本記錄功能的實作，包括：
1. 自動備份功能（每 5 分鐘自動儲存一次）
2. 手動建立版本備份
3. 版本管理 UI（查看、還原、刪除版本）
4. 版本回溯功能

**技術實現**：
- **版本服務層** (`versionService.ts`)：
  - `startAutoBackup`：啟動自動備份，使用定時器每 5 分鐘執行一次
  - `saveVersion`：儲存版本到 Firebase
  - `loadVersion`：載入特定版本的詳細資料
  - `restoreVersion`：還原到特定版本
  - `createManualBackup`：建立手動備份
  - 使用簡單的雜湊函數檢測資料變更，避免重複儲存

- **API 路由** (`/api/versions/route.ts`)：
  - 處理版本的 CRUD 操作
  - 自動清理舊的自動備份（保留最近 10 個）
  - 支援版本還原，會更新專案的當前資料

- **版本管理 UI** (`VersionDialog.tsx`)：
  - 左側顯示版本列表，右側顯示版本詳情
  - 支援建立手動備份（可輸入名稱和說明）
  - 顯示版本的建立時間、類型、內容統計
  - 提供還原和刪除功能
  - 使用 date-fns 處理時間格式化

- **整合到 Whiteboard**：
  - 專案載入時自動啟動自動備份
  - 使用 useRef 確保總是獲取最新的白板資料
  - 在 FloatingToolbar 添加版本管理按鈕
  - 版本還原後重置歷史記錄並重啟自動備份

**檔案修改**：
- `/app/services/versionService.ts` - 版本服務層（已存在，完整實作）
- `/app/api/versions/route.ts` - API 路由（已存在，完整實作）
- `/app/components/VersionDialog.tsx` - 版本管理 UI（新建）
- `/app/components/Whiteboard.tsx` - 整合版本服務（第 1149-1155、1187-1190、5525-5555 行）
- `/app/components/FloatingToolbar.tsx` - 添加版本管理按鈕（第 20、57、404-416 行）

**依賴套件**：
- 安裝了 `date-fns` 用於時間格式化
- 安裝了 `lucide-react` 用於圖標

## 2025-08-17

### 優化快速連接功能 - 新便利貼自動加入群組

**使用者需求**：
當從群組內的便利貼透過快速連接（點擊或拖曳四個方向的連接點）建立新便利貼時，希望新建立的便利貼能自動加入原便利貼所在的群組，而不是在群組外面。

**解決方案**：
修改了 `handleQuickConnect` 和 `handleImageQuickConnect` 函數，在建立新便利貼時檢查原便利貼/圖片是否在群組內，如果是，則將新便利貼的 `groupId` 設定為相同的群組 ID。

**技術實現**：
- 在 `handleQuickConnect` 中，新便利貼會繼承 `fromNote.groupId`
- 在 `handleImageQuickConnect` 中，新便利貼會繼承 `fromImage.groupId`
- 這樣從群組內元素延伸出的新便利貼會自動成為該群組的一部分

**檔案修改**：
- `/app/components/Whiteboard.tsx` - `handleQuickConnect` 函數（第 2620-2631 行）
- `/app/components/Whiteboard.tsx` - `handleImageQuickConnect` 函數（第 2714-2725 行）

### 優化巢狀群組功能

**使用者需求**：
當在一個群組內選擇多個便利貼，想要再建立一個新群組時，現有行為會讓這些便利貼先離開原本的群組，然後建立一個新的獨立群組。使用者希望能在同一個群組底下直接建立一個子群組。

**解決方案**：
修改了 `Whiteboard.tsx` 中的 `createGroup` 函數邏輯：
1. 檢查所有選中的便利貼和圖片是否都在同一個群組內
2. 如果是，自動將該群組設為父群組，建立子群組
3. 便利貼和圖片會屬於新建立的子群組（設定 `groupId` 為子群組 ID）
4. 新建立的群組會成為原群組的子群組（透過 `parentGroupId` 和 `childGroupIds` 建立關係）

**技術實現重點**：
- 利用現有的 `parentGroupId` 和 `childGroupIds` 欄位支援巢狀結構
- 當建立子群組時，便利貼的 `groupId` 會更新為新子群組的 ID
- 自動偵測選中項目是否在同一群組，智能決定是否建立子群組
- 加入 console.log 協助除錯，追蹤群組建立的流程

**更新**：
經過進一步測試，發現需要調整邏輯：
- 便利貼必須屬於新建立的子群組（而非保持在原群組）
- 透過 `parentGroupId` 維持群組間的層級關係
- 修復了鍵盤快捷鍵處理邏輯，確保 Cmd+G 正確觸發群組建立

**檔案修改**：
- `/app/components/Whiteboard.tsx` - `createGroup` 函數（第 325-402 行）
- `/app/components/Whiteboard.tsx` - 鍵盤快捷鍵處理（第 1548-1553 行）

## 2025-08-17 (續)

### 修復 AI Agent 意圖分析 context 參考問題

**使用者需求**：
使用者懷疑 AI 助手功能的意圖理解沒有參考到前一步驟的 context，希望將白板狀態傳進去意圖分析 prompt 會比較精準。

**問題分析**：
1. 發現 `analyzeIntentNaturally` 函數沒有使用傳入的 `conversationHistory` 參數
2. 意圖分析只有簡化的白板摘要，沒有詳細的白板狀態資訊

**解決方案**：
1. 修改意圖分析函數，加入對話歷史和詳細白板資訊
2. 在意圖分析 prompt 中包含：
   - 前面的對話內容
   - 便利貼詳細內容（ID、內容、群組）
   - 群組詳細資訊（名稱、描述）
   - 連接關係資訊
   - 圖片資訊

**技術實現**：
- 修改 `analyzeIntentNaturally` 函數參數，加入 `conversationHistory` 和 `whiteboardData`
- 在 prompt 中加入詳細的白板狀態資訊，讓 AI 能更精準理解使用者意圖
- 在系統 prompt 中說明 AI 可以看到白板的所有詳細資訊

**檔案修改**：
- `/app/api/ai-agent/stream-natural/route.ts` - 修改意圖分析函數（第 461-533 行）
- 傳入詳細白板資料到意圖分析功能

### 修復 React 元件錯誤

**問題**：
遇到 "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined" 錯誤，出現在 `ProcessMessageDisplay` 元件的 render 方法中。

**原因分析**：
問題出現在 `ProcessMessageDisplay` 元件中，當 `getProcessStyle` 函數返回的 `style.icon` 可能為 undefined 時，嘗試渲染 `<Icon />` 會導致錯誤。

**解決方案**：
1. 為 Icon 變數添加了 fallback 機制：`const Icon = style.icon || Tool`
2. 增加額外的安全檢查，確保 Icon 存在才渲染
3. 如果 Icon 仍然為 undefined，則使用 Tool 圖標作為後備

**檔案修改**：
- `/app/components/AIChat/AIChatPanelStream.tsx` - `ProcessMessageDisplay` 元件和相關函數

**修復內容**：
1. **主要修復**：添加 Icon 安全檢查和 fallback 機制
2. **次要修復**：發現 `Tool` 圖標不存在於 lucide-react 中，替換為 `Wrench`

```typescript
// 修正導入
import { ..., Wrench, ... } from 'lucide-react';

// 添加安全檢查
const Icon = style.icon || Wrench; // Fallback to Wrench if icon is undefined

// 在渲染時增加額外安全檢查
Icon ? (
  <Icon className={`w-4 h-4 ${style.iconColor}`} />
) : (
  <Wrench className={`w-4 h-4 ${style.iconColor}`} />
)
```

**更新的行數**：
- 第 4 行：更新 import 語句
- 第 248、453、467、476、492 行：將所有 `Tool` 替換為 `Wrench`

### 修復 OpenAI API Tool Call 錯誤

**問題**：
遇到 "An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'" 錯誤，表示有工具呼叫沒有得到對應的回應。

**原因分析**：
在 `/app/api/ai-agent/stream-natural/route.ts` 中，當 OpenAI 返回多個工具呼叫時，程式碼只處理第一個工具呼叫，導致其他工具呼叫的 `tool_call_id` 沒有得到回應。

**解決方案**：
修改工具呼叫處理邏輯，使用 `for` 迴圈處理所有工具呼叫，確保每個 `tool_call_id` 都有對應的工具回應訊息。

**技術實現**：
```typescript
// 原本：只處理第一個工具呼叫
const toolCall = responseMessage.tool_calls[0];

// 修正：處理所有工具呼叫
for (const toolCall of responseMessage.tool_calls) {
  // 執行工具並添加回應訊息
  allMessages.push({
    role: 'tool' as const,
    content: typeof result === 'string' ? result : JSON.stringify(result),
    tool_call_id: toolCall.id  // 重要：必須包含正確的 tool_call_id
  });
}
```

**檔案修改**：
- `/app/api/ai-agent/stream-natural/route.ts` - 工具呼叫處理邏輯（第 155-202 行）

### 實作 AI Prompt 顯示功能（方便 debug）

**使用者需求**：
希望在 AI agent 的每個階段都能看到實際傳送給 OpenAI 的 prompt 內容，並加上收合/展開按鈕，方便 debug 和了解 AI 的思考過程。

**解決方案**：
1. **後端修改**：修改 AI agent API 讓所有函數都返回使用的 prompt 內容
2. **前端顯示**：創建 `PromptDisplay` 元件，支援收合/展開功能
3. **整合顯示**：在白板摘要和意圖分析階段顯示對應的 prompt

**技術實現**：

**後端 API 修改**：
- `generateComprehensiveOverview` 函數：
  ```typescript
  // 返回格式改為包含 prompts
  return {
    summary: "...",
    prompts: [
      { type: '摘要分析', model: 'gpt-3.5-turbo', messages: summaryPrompt },
      { type: '結構分析', model: 'gpt-3.5-turbo', messages: structurePrompt }
    ]
  };
  ```

- `analyzeIntentNaturally` 函數：
  ```typescript
  // 返回格式改為包含 prompt
  return {
    analysis: "...",
    prompt: { type: '意圖分析', model: 'gpt-3.5-turbo', messages: intentMessages }
  };
  ```

**前端 UI 元件**：
- 創建 `PromptDisplay` 元件，特色：
  - 🔍 可收合/展開的按鈕
  - 顯示 prompt 類型和使用的模型
  - 分別顯示 System 和 User 訊息
  - 支援長內容的滾動顯示
  - 深色模式適配

- 整合到 `ProcessMessageDisplay` 中：
  - 白板摘要階段顯示摘要和結構分析的 prompts
  - 意圖分析階段顯示意圖分析的 prompt

**檔案修改**：
- `/app/api/ai-agent/stream-natural/route.ts` - API 函數修改（第 89-114、317-562 行）
- `/app/components/AIChat/AIChatPanelStream.tsx` - 前端 UI 修改（第 614-627、631-645、732-783 行）

**功能特色**：
- 📋 每個 AI 呼叫都顯示完整的 prompt 內容
- 🔄 支援收合/展開，避免介面過於冗長
- 🎨 美觀的 UI 設計，區分 System 和 User 訊息
- 🌙 支援深色模式
- 🔍 方便開發者 debug 和了解 AI 行為

### 合併工具執行與結果顯示

**使用者需求**：
將「執行工具」和「工具結果」合併成一個區塊，讓介面更簡潔易讀。

**解決方案**：
1. **修改事件處理邏輯**：在工具開始時創建訊息，在工具完成時更新同一個訊息
2. **新增合併顯示類型**：創建 `tool_call_combined` 類型
3. **動態狀態更新**：從「執行中」到「已完成」的狀態轉換

**技術實現**：

**前端邏輯改進**：
- 使用 `activeToolCalls` Map 追蹤正在進行的工具調用
- `tool_call_start` 事件：創建包含工具參數的訊息，狀態為 `running`
- `tool_call_result` 事件：更新對應訊息，添加結果並將狀態改為 `completed`

**UI 改進**：
- **🔧 工具參數區塊**：顯示工具名稱、搜尋關鍵字、執行狀態、嘗試次數
- **📊 執行結果區塊**：僅在完成時顯示，包含搜尋結果、結果預覽
- **動態狀態指示器**：藍色「執行中」→ 綠色「已完成」

**檔案修改**：
- `/app/hooks/useAIAgentStream.ts` - 工具調用事件處理邏輯（第 45、125-190、473-487 行）
- `/app/components/AIChat/AIChatPanelStream.tsx` - 新增合併顯示元件（第 465-471、735-803 行）

**用戶體驗提升**：
- ✅ 減少重複區塊，介面更簡潔
- 🔄 保持所有原有資訊，無功能缺失
- 📱 更好的垂直空間利用
- 👁️ 清晰的狀態變化視覺回饋

### 修復工具狀態卡在執行中的問題

**問題描述**：
合併工具顯示後，工具狀態永遠卡在「執行中」，無法更新為「已完成」，同時出現 OpenAI API 錯誤：`tool_call_id` 沒有對應的回應訊息。

**問題原因**：
1. **狀態管理問題**：使用 `useState` 的 `activeToolCalls` 在 `useCallback` 中無法獲取最新值
2. **事件處理邏輯**：工具開始和結果事件無法正確匹配，導致狀態無法更新

**解決方案**：
1. **改用 useRef**：將 `activeToolCalls` 從 `useState` 改為 `useRef`，確保能獲取即時值
2. **修復追蹤邏輯**：確保工具 key 的生成和匹配邏輯一致
3. **清理機制**：在清除對話和取消請求時正確清理 ref

**技術修復**：

```typescript
// 原本：使用 useState（有問題）
const [activeToolCalls, setActiveToolCalls] = useState<Map<string, string>>(new Map());

// 修正：使用 useRef
const activeToolCallsRef = useRef<Map<string, string>>(new Map());

// 工具開始時記錄
activeToolCallsRef.current.set(`${event.tool}_${event.attempt}`, toolMessageId);

// 工具結果時更新
const existingMessageId = activeToolCallsRef.current.get(`${event.tool}_${event.attempt}`);
if (existingMessageId) {
  // 更新對應訊息的狀態和結果
}
```

**檔案修改**：
- `/app/hooks/useAIAgentStream.ts` - 修復狀態追蹤邏輯（第 45、152-183、472-485 行）

**修復效果**：
- 🔧 工具執行狀態正確從「執行中」變為「已完成」
- 📊 工具結果正常顯示在合併區塊中
- ✅ 解決 OpenAI API 的 tool_call_id 錯誤
- 🔄 保持合併顯示的所有優點

### 強化 AI 圖探索引導功能

**使用者需求**：
希望 AI 能更主動地探索附近的節點，利用便利貼之間的連接關係來發現相關資訊，而不是只依靠關鍵字搜尋。

**問題分析**：
雖然技術上已經支援圖探索功能（透過 `get_note_by_id` 可以獲取節點連接資訊），但 AI 沒有被充分引導去使用這個策略。

**解決方案**：
1. **系統 Prompt 增強**：在 AI agent 的核心指引中加入明確的圖探索策略
2. **工具描述優化**：強化 `get_note_by_id` 工具的描述，突出其圖探索能力
3. **反思邏輯改進**：在反思過程中特別考慮圖探索的必要性
4. **具體範例指導**：提供具體的圖探索使用情境

**技術實現**：

**系統 Prompt 改進**：
```typescript
🔗 **圖探索策略（新增重點）**：
- **節點探索**：當找到相關便利貼時，使用 get_note_by_id 查看它的連接關係
- **相鄰探索**：探索連接到這個節點的其他便利貼，它們可能包含相關或延伸的資訊
- **脈絡追蹤**：沿著連接線索追蹤思路的延續和發展
- **關聯發現**：連接的便利貼往往代表使用者的思考脈絡和概念關聯

圖探索範例：
- 找到「目標客戶」便利貼 → 探索連接的便利貼，可能有「需求分析」「購買動機」等
- 發現「付費模式」 → 查看相鄰節點，可能連接到「定價策略」「收費方式」等
- 找到問題描述 → 探索連接的解決方案、影響因素等
- 使用者問「行銷策略」，找到相關便利貼後 → 使用 get_note_by_id 查看其連接，可能發現連到「目標族群」「宣傳管道」「預算規劃」等相關節點
```

**工具描述優化**：
```typescript
description: '🔗 重要的圖探索工具：根據ID獲取特定便利貼的詳細資訊，包含其內容、位置、顏色、連接關係（哪些便利貼連到它、它連到哪些便利貼）以及所屬群組。特別適合用於探索相鄰節點 - 當找到相關便利貼時，可以透過連接關係探索附近的其他便利貼來獲得更完整的脈絡。'
```

**反思邏輯強化**：
```typescript
🔗 **圖探索思考重點**：
- 如果我找到了相關便利貼，是否已經探索了它們的連接關係？
- 連接的便利貼可能包含更深入或相關的資訊
- 是否應該沿著連接路徑繼續探索？
- 使用者的問題可能涉及多個相關概念，這些概念在白板上可能是連接的

🔍 **策略提醒**：
- 發散性搜尋：嘗試不同關鍵字、同義詞、相關概念
- 圖探索：使用 get_note_by_id 探索已找到便利貼的連接節點
- 組合策略：搜尋新關鍵字的同時，探索已知節點的相鄰內容
```

**檔案修改**：
- `/app/api/ai-agent/stream-natural/route.ts` - 系統 prompt 和反思邏輯強化（第 58-68、645-675 行）
- `/app/api/ai-agent/tools.ts` - 工具描述優化（第 43 行）

**功能特色**：
- 🔗 明確的圖探索策略指導
- 📝 具體的使用範例和情境
- 🧠 智能反思機制考慮圖探索必要性
- 🎯 發散性搜尋與圖探索的結合策略
- 💡 充分利用現有技術能力的引導機制

### 修復 AI 圖探索邏輯錯誤

**使用者回饋**：
AI agent 雖然會使用 `get_note_by_id` 工具，但有邏輯錯誤：它會重複對同一個便利貼使用該工具，而不是去探索該便利貼連接的其他便利貼（相鄰節點）。

**問題分析**：
AI 的錯誤行為模式：
1. 找到便利貼 A
2. 對便利貼 A 使用 `get_note_by_id`
3. 又對便利貼 A 重複使用 `get_note_by_id` ❌

正確的圖探索應該是：
1. 找到便利貼 A  
2. 對便利貼 A 使用 `get_note_by_id`，獲得連接關係
3. 對 A 連接的便利貼 B、C、D 使用 `get_note_by_id` ✅

**解決方案**：
1. **明確探索步驟**：重新設計系統 prompt，明確說明 3 步驟圖探索邏輯
2. **防止重複探索**：明確指出不要重複對同一便利貼使用工具
3. **強調目標對象**：connections 欄位中的 noteId 才是探索目標
4. **改進反思邏輯**：讓 AI 能檢查自己的探索行為是否正確

**技術實現**：

**修正的探索策略**：
```typescript
🔗 **圖探索策略（重要邏輯）**：
- **步驟 1**：使用 search_notes 找到相關便利貼
- **步驟 2**：對找到的便利貼使用 get_note_by_id，獲取其連接關係（incoming/outgoing connections）
- **步驟 3 關鍵**：對**連接關係中的其他便利貼 ID** 使用 get_note_by_id 來探索相鄰節點
- **避免錯誤**：不要重複對同一個便利貼使用 get_note_by_id，要對它連接的其他便利貼使用
- **探索邏輯**：connections.incoming 和 connections.outgoing 中的 noteId 才是你應該探索的目標
```

**具體流程範例**：
```
1. search_notes(["目標客戶"]) → 找到便利貼 note_123
2. get_note_by_id("note_123") → 獲得連接關係:
   - connections.outgoing: [note_456, note_789] 
   - connections.incoming: [note_234]
3. 正確做法：對相鄰節點探索
   - get_note_by_id("note_456") → 可能是「需求分析」
   - get_note_by_id("note_789") → 可能是「購買動機」
   - get_note_by_id("note_234") → 可能是「市場調查」
4. 錯誤做法：再次 get_note_by_id("note_123") ❌
```

**反思邏輯增強**：
```typescript
🔗 **圖探索檢查重點**：
- 我是否找到了有連接關係的便利貼（connections.total > 0）？
- 我是否對那些便利貼的**相鄰節點**（connections 中的其他 noteId）進行了探索？
- **錯誤檢查**：我是否重複對同一個便利貼使用 get_note_by_id？應該避免！
- **正確做法**：應該對 connections.incoming 和 connections.outgoing 中的 noteId 使用 get_note_by_id
```

**改進的追蹤機制**：
- 在反思時顯示已探索和未探索的相鄰節點列表
- 明確標示哪些 connections 中的 noteId 還沒有被探索
- 引導 AI 對未探索的相鄰節點進行探索

**檔案修改**：
- `/app/api/ai-agent/stream-natural/route.ts` - 修正圖探索邏輯和反思機制（第 58-78、656-703 行）

**修復效果**：
- ✅ AI 不再重複對同一便利貼使用 get_note_by_id
- 🔗 正確探索 connections 中的相鄰節點
- 📊 清楚追蹤已探索和未探索的節點
- 🧠 反思時能自我檢查圖探索的正確性
- 🎯 實現真正的圖遍歷而非重複查詢

### 修復 get_note_by_id 工具沒有返回相鄰節點 ID 的嚴重問題

**使用者發現的核心問題**：
`get_note_by_id` 工具返回的連接資訊只有數字統計（incoming: 1, outgoing: 1），但沒有提供相鄰節點的實際 ID，導致 AI 無法知道應該探索哪些具體的便利貼。

**問題示例**：
```json
// 原本的錯誤格式
"connections": {
  "incoming": 1,
  "outgoing": 1, 
  "total": 2
}
```

這樣的格式完全無法支援圖探索，因為 AI 不知道那 1 個 incoming 和 1 個 outgoing 分別指向哪些便利貼。

**解決方案**：
1. **修改 connections 資料結構**：從數字統計改為包含具體節點資訊的物件陣列
2. **提供相鄰節點的完整資訊**：包含 noteId 和 noteContent
3. **更新反思邏輯**：讓反思機制能正確讀取新的 connections 格式
4. **增強除錯資訊**：在 console.log 中顯示相鄰節點的詳細資訊

**技術實現**：

**修正後的 connections 格式**：
```json
"connections": {
  "incoming": [
    {
      "noteId": "source-note-id-123", 
      "noteContent": "來源便利貼的內容"
    }
  ],
  "outgoing": [
    {
      "noteId": "target-note-id-456",
      "noteContent": "目標便利貼的內容" 
    }
  ],
  "total": 2
}
```

**獲取相鄰節點詳細資訊的邏輯**：
```typescript
// 獲取入連接的詳細資訊
const incomingNodesInfo = incomingConnections.map(edge => {
  const sourceNote = whiteboardData.notes.find(n => n.id === edge.from);
  return {
    noteId: edge.from,
    noteContent: sourceNote ? sourceNote.content : '未知便利貼'
  };
});

// 獲取出連接的詳細資訊  
const outgoingNodesInfo = outgoingConnections.map(edge => {
  const targetNote = whiteboardData.notes.find(n => n.id === edge.to);
  return {
    noteId: edge.to,
    noteContent: targetNote ? targetNote.content : '未知便利貼'
  };
});
```

**反思邏輯的相應修改**：
```typescript
// 適配新的 connections 格式
const incomingNodes = note.connections?.incoming || [];
const outgoingNodes = note.connections?.outgoing || [];

if (incomingNodes.length > 0 || outgoingNodes.length > 0) {
  const incomingIds = incomingNodes.map(conn => conn.noteId);
  const outgoingIds = outgoingNodes.map(conn => conn.noteId);
  const allConnectedIds = [...incomingIds, ...outgoingIds];
  
  // 檢查哪些相鄰節點已經探索過，哪些還沒有
  const alreadyExplored = allConnectedIds.filter(id => detailedNotes.some(n => n.id === id));
  const notExplored = allConnectedIds.filter(id => !detailedNotes.some(n => n.id === id));
}
```

**增強的除錯和追蹤功能**：
- 在反思時顯示相鄰節點的內容預覽
- 清楚標示哪些節點已探索、哪些未探索
- 提供具體的便利貼 ID 和內容摘要

**檔案修改**：
- `/app/api/ai-agent/stream-natural/route.ts` - 修復 `getNoteById` 函數和反思邏輯（第 1088-1143、671-695 行）

**修復效果**：
- 🔧 **核心修復**：AI 現在能獲得相鄰節點的具體 ID 和內容
- 🎯 **正確圖探索**：AI 知道應該對哪些具體的便利貼 ID 使用 get_note_by_id
- 📊 **清晰追蹤**：反思時能看到「🎯 未探索」節點的具體 ID 和內容預覽  
- 🔍 **智能引導**：AI 被明確引導去探索「未探索」列表中的相鄰節點
- ✅ **完整圖遍歷**：終於實現真正有效的圖探索功能

這是一個**關鍵性的修復**，解決了圖探索功能的根本問題！