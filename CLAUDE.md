# CLAUDE.md

此文件為 Claude Code (claude.ai/code) 在此程式庫中工作時提供指引。

## 指令

### 開發
```bash
npm run dev      # 啟動開發伺服器 http://localhost:3000
npm run build    # 建置正式版本
npm run start    # 啟動正式伺服器
npm run lint     # 執行 ESLint
```

### 工作流程
- 每次比較大的改動完成後，在 git commit 之前執行 `npm run lint` 確認沒有重大 lint error
- 定期 `git commit`
- 不要自行 `npm run dev`，我會執行
- 為避免各種問題，幫我把每次下的 prompt 和對話都寫到 `PROMPTING_HISTORY.md` 裡面
- 解決複雜問題、完成複雜系統時，記得在 docs 資料夾底下撰寫 Markdown 文件來紀錄

## 架構概覽

### 技術堆疊
- **框架**: Next.js 15 搭配 React 19 與 TypeScript
- **樣式**: Tailwind CSS 支援暗色模式
- **拖放功能**: react-draggable 處理便利貼
- **AI 整合**: OpenAI GPT-4 API
- **身份驗證**: NextAuth 搭配 Firebase adapter
- **儲存**: Firebase 雲端同步
- **分析**: Google Analytics 4 追蹤使用者行為

### 核心元件結構

#### 主要應用程式流程
1. `app/page.tsx` - 入口點，渲染 Whiteboard 元件
2. `app/components/Whiteboard.tsx` - 中央元件，管理所有狀態與互動
3. Theme 與 Auth 的 Context providers 包裝應用程式

#### Whiteboard 中的關鍵狀態管理
- **WhiteboardData**: 包含便利貼、連線與群組的中央狀態
- **歷史系統**: 復原/重做功能與歷史堆疊
- **選取系統**: 便利貼與連線的單選與多選
- **AI 載入狀態**: 追蹤 AI 操作與思考步驟
- **視窗控制**: 縮放與平移功能

### 元件職責

#### 互動元素
- **StickyNote**: 可拖曳的便利貼，支援內嵌編輯、顏色選項、右鍵選單
- **Edge**: 便利貼間的連接箭頭，隨便利貼移動自動更新
- **Group**: 相關便利貼的視覺群組
- **AlignmentGuides**: 拖曳便利貼時的視覺輔助線

#### UI 元件
- **Toolbar**: 左側工具列，包含 AI 功能、範本、便利貼
- **FloatingToolbar**: 頂部工具列，包含專案管理、匯出、主題切換
- **SidePanel**: 右側面板，顯示 AI 結果
- **AIPreviewDialog**: 套用 AI 生成變更前的預覽對話框

### 服務層

#### AI 服務 (`aiService.ts`)
- 腦力激盪: 從單一便利貼生成相關想法
- 分析: 整個白板的結構分析
- 摘要: 提取所有內容的關鍵要點
- 網路分析: 分析便利貼之間的關係
- 詢問 AI: 針對特定便利貼的自訂提示

#### 儲存服務
- **StorageService**: 本地儲存持久化
- **ProjectService**: Firebase 專案管理
- **SyncService**: 雲端同步
- **AuthService**: 透過 NextAuth 進行 Google/Email 身份驗證

### 資料類型 (`types.ts`)
- **StickyNote**: 核心便利貼結構，包含位置、內容、顏色
- **Edge**: 便利貼間的連線
- **Group**: 相關便利貼的集合
- **WhiteboardData**: 完整的白板狀態
- **NetworkAnalysis**: 關係分析結果

## 關鍵實作細節

### AI 功能
- 使用 OpenAI API (金鑰在 `.env.local`)
- 無 API 金鑰時回退到模擬資料
- 處理過程中顯示思考步驟
- 套用 AI 生成變更前的預覽對話框

### 暗色模式
- 基於類別的 Tailwind 暗色模式
- `tailwind.config.js` 中的自訂色彩調色盤
- 主題保存在 localStorage
- 系統偏好設定偵測

### 身份驗證流程
1. NextAuth 處理 Google OAuth
2. Firebase adapter 處理使用者資料
3. 計劃支援匿名模式
4. 基於會話的身份驗證

#### 重要安全說明
- **不需要 Firebase Security Rules** - 我們使用自己的 NextAuth 基礎授權系統
- 所有權限檢查都在 Next.js API routes 中使用 NextAuth session 進行
- Firebase 用於資料儲存，搭配自訂的伺服器端存取控制

### 重要模式
- 所有檔案路徑必須是絕對路徑，不是相對路徑
- 元件檢查相鄰檔案的慣例
- AI 結果顯示在右側面板 (SidePanel)
- 多選便利貼的拖曳選取
- 右鍵點擊的上下文選單

## 必要的環境變數
```
NEXT_PUBLIC_OPENAI_API_KEY    # AI 功能用
NEXTAUTH_URL                  # NextAuth 基礎 URL
NEXTAUTH_SECRET               # NextAuth 加密金鑰
GOOGLE_CLIENT_ID              # Google OAuth
GOOGLE_CLIENT_SECRET          # Google OAuth
FIREBASE_*                    # Firebase 設定
```

## 重要指示
- 做被要求的事情；不多不少
- 除非絕對必要，否則永遠不要建立檔案
- 總是偏好編輯現有檔案
- 除非明確要求，否則永遠不要主動建立文件檔案