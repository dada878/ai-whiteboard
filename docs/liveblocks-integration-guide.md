# ThinkBoard + Liveblocks 整合實作指南

## 目錄
1. [整合概覽](#整合概覽)
2. [現有系統架構分析](#現有系統架構分析)
3. [整合架構設計](#整合架構設計)
4. [實作步驟](#實作步驟)
5. [程式碼實作](#程式碼實作)
6. [測試計畫](#測試計畫)
7. [部署清單](#部署清單)

---

## 整合概覽

### 目標
為 ThinkBoard 加入即時多人協作功能，讓使用者可以：
- 分享專案連結邀請他人協作
- 即時看到其他人的操作（便利貼移動、編輯等）
- 顯示協作者游標和線上狀態
- 保持現有的 Firebase 資料結構和 NextAuth 認證

### 技術選擇
- **Liveblocks**: 處理即時協作和同步
- **Firebase**: 保持作為主要資料庫（專案管理、使用者資料）
- **NextAuth**: 繼續使用現有認證系統

---

## 現有系統架構分析

### 目前技術堆疊
```
Frontend:
├── Next.js 15 + React 19
├── TypeScript
├── Tailwind CSS
└── react-draggable

Backend:
├── NextAuth (Google OAuth Only)
├── Firebase Firestore
└── Firebase Admin SDK

State Management:
└── React State (集中在 Whiteboard.tsx)
```

### 關鍵元件結構
```
app/
├── components/
│   ├── Whiteboard.tsx          # 主要白板元件（需要整合 Liveblocks）
│   ├── StickyNote.tsx          # 便利貼元件
│   ├── Edge.tsx                # 連線元件
│   └── FloatingToolbar.tsx     # 工具列（需顯示協作者）
├── services/
│   ├── projectService.ts       # 專案管理（保持不變）
│   ├── storageService.ts       # 本地儲存（需調整）
│   └── syncService.ts          # 同步服務（將被 Liveblocks 取代）
└── api/
    └── sync/route.ts           # Firebase 同步 API（保持作為備份）
```

### 現有資料流
```
使用者操作 → Whiteboard State → Firebase Firestore
                    ↓
              Local Storage
```

---

## 整合架構設計

### 新的資料流架構
```
使用者操作 → Liveblocks Room → 即時同步到其他使用者
                    ↓
              定期備份到 Firebase
```

### 資料責任分配

| 資料類型 | 儲存位置 | 說明 |
|---------|---------|------|
| 專案資訊 | Firebase | 名稱、描述、建立時間、擁有者 |
| 使用者資料 | Firebase | 個人資料、權限、設定 |
| 白板即時資料 | Liveblocks | 便利貼、連線、群組位置 |
| 協作狀態 | Liveblocks | 游標、選取狀態、線上使用者 |
| 歷史備份 | Firebase | 定期快照、版本控制 |

### Room 與 Project 對應
```typescript
// 每個 Firebase Project 對應一個 Liveblocks Room
Room ID = `project_${projectId}`
```

---

## 實作步驟

### Phase 1: 環境設置（30分鐘）

#### 1.1 安裝依賴
```bash
npm install @liveblocks/client @liveblocks/react @liveblocks/node
```

#### 1.2 環境變數設定
```env
# .env.local 新增
LIVEBLOCKS_SECRET_KEY=sk_dev_xxxxxxxxxxxxx
```

#### 1.3 取得 Liveblocks 金鑰
1. 前往 [liveblocks.io](https://liveblocks.io)
2. 註冊/登入帳號
3. 建立新專案
4. 複製 Secret Key

### Phase 2: 後端整合（1小時）

#### 2.1 建立認證端點
```typescript
// app/api/liveblocks-auth/route.ts
import { Liveblocks } from "@liveblocks/node";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 為使用者建立 Liveblocks session
  const { status, body } = await liveblocks.identifyUser({
    userId: session.user.id,
    groupIds: [], // 可以加入團隊/組織 ID
    userInfo: {
      name: session.user.name || "匿名使用者",
      email: session.user.email,
      avatar: session.user.image || undefined,
      color: generateUserColor(session.user.id), // 產生使用者顏色
    },
  });

  return new Response(body, { status });
}

// 為每個使用者產生固定顏色
function generateUserColor(userId: string): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#FDA7DF"
  ];
  
  const hash = userId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + acc;
  }, 0);
  
  return colors[hash % colors.length];
}
```

#### 2.2 建立權限檢查
```typescript
// app/api/liveblocks-auth/access/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { ProjectService } from "@/app/services/projectService";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { room } = await request.json();
  const projectId = room.replace("project_", "");
  
  // 檢查使用者是否有權限存取此專案
  const project = await ProjectService.getProject(projectId);
  
  if (!project) {
    return new Response("Project not found", { status: 404 });
  }
  
  // 檢查是否為擁有者或協作者
  const hasAccess = 
    project.ownerId === session.user.id ||
    project.collaborators?.includes(session.user.id) ||
    project.isPublic;
  
  if (!hasAccess) {
    return new Response("Forbidden", { status: 403 });
  }
  
  return new Response("OK", { status: 200 });
}
```

### Phase 3: 前端整合（2小時）

#### 3.1 建立 Liveblocks Provider
```typescript
// app/providers/LiveblocksProvider.tsx
"use client";

import { LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense";
import { useParams } from "next/navigation";

export function LiveblocksWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      throttle={100}
    >
      {children}
    </LiveblocksProvider>
  );
}

// app/layout.tsx 更新
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          <LiveblocksWrapper>
            {children}
          </LiveblocksWrapper>
        </Providers>
      </body>
    </html>
  );
}
```

#### 3.2 定義協作資料結構
```typescript
// app/types/collaboration.ts
import { LiveObject, LiveList, LiveMap } from "@liveblocks/client";

// 定義 Storage 結構（持久化資料）
export type Storage = {
  notes: LiveMap<string, LiveObject<StickyNote>>;
  edges: LiveList<Edge>;
  groups: LiveList<Group>;
  images: LiveList<ImageElement>;
};

// 定義 Presence 結構（暫時性資料）
export type Presence = {
  cursor: { x: number; y: number } | null;
  selectedNoteIds: string[];
  isTyping: boolean;
  user: {
    name: string;
    color: string;
    avatar?: string;
  };
};

// 使用者資訊
export type UserMeta = {
  id: string;
  info: {
    name: string;
    email: string;
    avatar?: string;
    color: string;
  };
};
```

#### 3.3 修改 Whiteboard 元件
```typescript
// app/components/CollaborativeWhiteboard.tsx
"use client";

import { RoomProvider } from "@liveblocks/react/suspense";
import { useParams } from "next/navigation";
import { Whiteboard } from "./Whiteboard";
import { ClientSideSuspense } from "@liveblocks/react";
import { ErrorBoundary } from "react-error-boundary";

export function CollaborativeWhiteboard() {
  const params = useParams();
  const projectId = params.projectId as string;
  
  if (!projectId) {
    return <div>載入中...</div>;
  }
  
  return (
    <ErrorBoundary fallback={<div>發生錯誤</div>}>
      <RoomProvider
        id={`project_${projectId}`}
        initialPresence={{
          cursor: null,
          selectedNoteIds: [],
          isTyping: false,
          user: {
            name: "",
            color: "",
          },
        }}
        initialStorage={{
          notes: new LiveMap(),
          edges: new LiveList(),
          groups: new LiveList(),
          images: new LiveList(),
        }}
      >
        <ClientSideSuspense fallback={<div>同步中...</div>}>
          <WhiteboardWithCollaboration />
        </ClientSideSuspense>
      </RoomProvider>
    </ErrorBoundary>
  );
}

// 整合 Liveblocks 的白板元件
function WhiteboardWithCollaboration() {
  const notes = useStorage((root) => root.notes);
  const edges = useStorage((root) => root.edges);
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();
  
  // 修改便利貼（自動同步）
  const updateNote = useMutation(
    ({ storage }, noteId: string, updates: Partial<StickyNote>) => {
      const note = storage.get("notes").get(noteId);
      if (note) {
        Object.entries(updates).forEach(([key, value]) => {
          note.set(key as any, value);
        });
      }
    },
    []
  );
  
  // 新增便利貼
  const addNote = useMutation(
    ({ storage }, note: StickyNote) => {
      storage.get("notes").set(note.id, new LiveObject(note));
    },
    []
  );
  
  // 刪除便利貼
  const deleteNote = useMutation(
    ({ storage }, noteId: string) => {
      storage.get("notes").delete(noteId);
    },
    []
  );
  
  // 更新游標位置
  const handleMouseMove = (e: React.MouseEvent) => {
    updateMyPresence({
      cursor: { 
        x: e.clientX, 
        y: e.clientY 
      },
    });
  };
  
  // 渲染其他使用者的游標
  const cursors = others.map(({ connectionId, presence }) => {
    if (!presence.cursor) return null;
    
    return (
      <Cursor
        key={connectionId}
        x={presence.cursor.x}
        y={presence.cursor.y}
        color={presence.user.color}
        name={presence.user.name}
      />
    );
  });
  
  return (
    <div onMouseMove={handleMouseMove}>
      {/* 原有的 Whiteboard 內容 */}
      <Whiteboard
        notes={Array.from(notes.values())}
        onNoteUpdate={updateNote}
        onNoteAdd={addNote}
        onNoteDelete={deleteNote}
      />
      
      {/* 協作者游標 */}
      {cursors}
      
      {/* 協作者列表 */}
      <OnlineUsers />
    </div>
  );
}
```

#### 3.4 顯示線上使用者
```typescript
// app/components/OnlineUsers.tsx
import { useOthers, useSelf } from "@liveblocks/react/suspense";

export function OnlineUsers() {
  const others = useOthers();
  const currentUser = useSelf();
  
  return (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      {/* 顯示自己 */}
      <div className="relative">
        <img
          src={currentUser.info.avatar || "/default-avatar.png"}
          alt={currentUser.info.name}
          className="w-10 h-10 rounded-full border-2"
          style={{ borderColor: currentUser.info.color }}
        />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
      </div>
      
      {/* 顯示其他協作者 */}
      {others.map(({ connectionId, info }) => (
        <div key={connectionId} className="relative">
          <img
            src={info.avatar || "/default-avatar.png"}
            alt={info.name}
            className="w-10 h-10 rounded-full border-2"
            style={{ borderColor: info.color }}
          />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        </div>
      ))}
      
      {/* 顯示人數 */}
      <span className="ml-2 text-sm text-gray-600">
        {others.length + 1} 人在線上
      </span>
    </div>
  );
}
```

#### 3.5 游標元件
```typescript
// app/components/Cursor.tsx
export function Cursor({ x, y, color, name }: {
  x: number;
  y: number;
  color: string;
  name: string;
}) {
  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* 游標圖示 */}
      <svg
        className="relative"
        width="24"
        height="36"
        viewBox="0 0 24 36"
        fill="none"
      >
        <path
          d="M5.65376 12.3673L5.46026 12.1522L5.25124 12.3673L0.758296 16.8596L0.759094 16.8605L0.759897 16.8614L0.954036 17.0561L0.953958 17.0561L0.95398 17.0561L0.954679 17.0567L0.955368 17.0573L5.44431 21.5463L5.44511 21.5471L5.44591 21.5479L5.65376 21.7556L5.85159 21.5479L10.3405 17.059L10.5477 16.8514L10.3405 16.6437L5.85159 12.1522L5.65376 12.3673Z"
          fill={color}
          stroke={color}
        />
      </svg>
      
      {/* 使用者名稱 */}
      <div
        className="absolute top-5 left-2 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}
```

### Phase 4: 資料同步與備份（1小時）

#### 4.1 定期備份到 Firebase
```typescript
// app/hooks/useDataBackup.ts
import { useEffect } from "react";
import { useRoom, useStorage } from "@liveblocks/react/suspense";
import { ProjectService } from "../services/projectService";

export function useDataBackup(projectId: string) {
  const room = useRoom();
  const storage = useStorage();
  
  useEffect(() => {
    // 每 30 秒備份一次
    const interval = setInterval(async () => {
      try {
        const notes = Array.from(storage.notes.values());
        const edges = storage.edges.toArray();
        const groups = storage.groups.toArray();
        const images = storage.images.toArray();
        
        const whiteboardData = {
          notes,
          edges,
          groups,
          images,
        };
        
        // 儲存到 Firebase
        await ProjectService.saveProjectData(projectId, whiteboardData);
        console.log("資料已備份到 Firebase");
      } catch (error) {
        console.error("備份失敗:", error);
      }
    }, 30000);
    
    // 離開頁面時最後備份一次
    return () => {
      clearInterval(interval);
      // 執行最後備份
      backupData();
    };
  }, [projectId, storage]);
}
```

#### 4.2 載入現有資料
```typescript
// app/hooks/useLoadExistingData.ts
import { useEffect } from "react";
import { useMutation } from "@liveblocks/react";
import { ProjectService } from "../services/projectService";
import { LiveObject } from "@liveblocks/client";

export function useLoadExistingData(projectId: string) {
  const loadData = useMutation(
    async ({ storage }) => {
      // 從 Firebase 載入現有資料
      const existingData = await ProjectService.loadProjectData(projectId);
      
      if (existingData) {
        // 載入便利貼
        existingData.notes.forEach(note => {
          storage.get("notes").set(note.id, new LiveObject(note));
        });
        
        // 載入連線
        existingData.edges.forEach(edge => {
          storage.get("edges").push(edge);
        });
        
        // 載入群組
        existingData.groups.forEach(group => {
          storage.get("groups").push(group);
        });
        
        // 載入圖片
        existingData.images?.forEach(image => {
          storage.get("images").push(image);
        });
      }
    },
    []
  );
  
  useEffect(() => {
    loadData();
  }, [projectId]);
}
```

### Phase 5: 分享功能（30分鐘）

#### 5.1 產生分享連結
```typescript
// app/components/ShareDialog.tsx
import { useState } from "react";
import { useParams } from "next/navigation";

export function ShareDialog({ isOpen, onClose }: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const params = useParams();
  const projectId = params.projectId as string;
  const [copied, setCopied] = useState(false);
  
  const shareLink = `${window.location.origin}/project/${projectId}`;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShareViaEmail = () => {
    const subject = "邀請你加入 ThinkBoard 協作";
    const body = `點擊以下連結加入白板協作：\n${shareLink}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold mb-4">分享專案</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            專案連結
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {copied ? "已複製" : "複製"}
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            任何擁有此連結的人都可以加入協作
          </p>
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={handleShareViaEmail}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            透過 Email 分享
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 5.2 加入專案頁面
```typescript
// app/project/[projectId]/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ProjectService } from "@/app/services/projectService";
import { CollaborativeWhiteboard } from "@/app/components/CollaborativeWhiteboard";

export default async function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    // 未登入，導向登入頁
    redirect(`/login?callbackUrl=/project/${params.projectId}`);
  }
  
  // 檢查專案是否存在
  const project = await ProjectService.getProject(params.projectId);
  
  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">專案不存在</h1>
          <p>此專案可能已被刪除或連結無效</p>
        </div>
      </div>
    );
  }
  
  // 檢查權限
  const hasAccess = 
    project.ownerId === session.user.id ||
    project.collaborators?.includes(session.user.id) ||
    project.isPublic;
  
  if (!hasAccess) {
    // 自動加入為協作者（如果專案允許）
    if (project.allowAutoJoin) {
      await ProjectService.addCollaborator(params.projectId, session.user.id);
    } else {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">需要權限</h1>
            <p>請聯絡專案擁有者取得存取權限</p>
          </div>
        </div>
      );
    }
  }
  
  // 有權限，顯示協作白板
  return <CollaborativeWhiteboard />;
}
```

---

## 測試計畫

### 功能測試清單

#### 基本協作功能
- [ ] 兩個使用者可以同時看到對方的游標
- [ ] 移動便利貼時，其他使用者即時看到變化
- [ ] 新增便利貼時，其他使用者即時看到
- [ ] 刪除便利貼時，其他使用者即時看到
- [ ] 編輯便利貼內容時，其他使用者即時看到

#### 分享功能
- [ ] 可以產生分享連結
- [ ] 點擊連結可以加入專案
- [ ] 未登入使用者會導向登入頁
- [ ] 登入後自動導向專案

#### 資料同步
- [ ] Liveblocks 資料定期備份到 Firebase
- [ ] 重新載入頁面後資料保持
- [ ] 斷線重連後資料同步

#### 效能測試
- [ ] 3 個使用者同時操作流暢
- [ ] 100+ 便利貼時效能正常
- [ ] 游標移動無明顯延遲

### 測試步驟

1. **單人測試**
   - 建立新專案
   - 新增、編輯、刪除便利貼
   - 重新整理頁面，確認資料保存

2. **雙人測試**
   - 開啟兩個瀏覽器（或無痕模式）
   - 登入不同帳號
   - 分享專案連結
   - 測試即時同步

3. **壓力測試**
   - 建立 100+ 便利貼
   - 多人同時移動不同便利貼
   - 觀察效能和同步狀況

---

## 部署清單

### 環境準備
- [ ] 取得 Liveblocks Production Key
- [ ] 設定環境變數
- [ ] 更新 CORS 設定

### 程式碼檢查
- [ ] 移除 console.log
- [ ] 錯誤處理完整
- [ ] Loading 狀態處理

### 部署步驟
1. 推送程式碼到 Git
2. Vercel 自動部署
3. 檢查環境變數
4. 測試生產環境

### 監控設定
- [ ] 設定 Liveblocks Dashboard 監控
- [ ] 設定錯誤追蹤（Sentry）
- [ ] 設定使用量警報

---

## 常見問題處理

### Q: 使用者看不到其他人的游標
A: 檢查 Presence 更新是否正確發送，確認 updateMyPresence 有被調用

### Q: 資料沒有同步到 Firebase
A: 檢查備份 interval 是否正常運作，查看 console 錯誤訊息

### Q: 載入速度很慢
A: 考慮實作資料分頁載入，或只載入可見區域的便利貼

### Q: 斷線後無法重連
A: Liveblocks 會自動重連，但可以加入手動重連按鈕作為備案

---

## 成本估算

### Liveblocks 定價
- **免費方案**: 100 MAU, 1GB 儲存
- **Starter**: $99/月, 1000 MAU
- **Pro**: $499/月, 10000 MAU

### 預估使用量
- 初期：50-100 活躍使用者 → 免費方案
- 成長期：500-1000 使用者 → Starter 方案
- 規模化：1000+ 使用者 → Pro 方案

---

## 下一步行動

1. **Day 1**: 環境設置 + 後端整合
2. **Day 2**: 前端整合 + 基本協作功能
3. **Day 3**: 分享功能 + 資料備份
4. **Day 4**: 測試 + 調試
5. **Day 5**: 部署 + 監控

預計總開發時間：**5 個工作天**

---

## 參考資源

- [Liveblocks 官方文件](https://liveblocks.io/docs)
- [Liveblocks React 教學](https://liveblocks.io/docs/get-started/react)
- [Liveblocks 白板範例](https://liveblocks.io/examples/collaborative-whiteboard-react)
- [NextAuth + Liveblocks 整合](https://liveblocks.io/docs/authentication/nextauth)

---

## 聯絡支援

如遇到問題，可以：
1. 查看 Liveblocks Discord 社群
2. 提交 GitHub Issue
3. 聯絡 Liveblocks 支援團隊