# Prompts 索引與使用地圖

此檔案記錄所有 Markdown prompts 的使用位置和功能說明。

## 📊 使用狀態總覽

| Prompt 檔案 | 使用位置 | 整合狀態 | 功能說明 |
|------------|---------|---------|---------|
| `agent/main.md` | `/app/api/ai-agent/stream-natural/route.ts` | ✅ 完全使用 | AI Agent 主系統 prompt |
| `agent/intent-analysis.md` | `/app/api/ai-agent/stream-natural/route.ts` | ✅ 完全使用 | 意圖分析 |
| `agent/graph-exploration.md` | `agent/main.md` (import) | ✅ 完全使用 | 圖探索策略 |
| `agent/reflection.md` | - | ❌ 未整合 | 反思機制（硬編碼中） |
| `services/brainstorm.md` | `/app/services/aiService.ts` | ❌ 未整合 | 腦力激盪 |
| `services/analysis.md` | - | ❌ 未整合 | 白板分析 |
| `services/summary.md` | - | ❌ 未整合 | 內容摘要 |

## 🔄 調用關係圖

```
stream-natural/route.ts
├── agent/main.md (系統 prompt)
│   └── agent/graph-exploration.md (import)
├── agent/intent-analysis.md (意圖分析)
└── [硬編碼] reflection prompt (待整合)

aiService.ts
└── [硬編碼] brainstorm prompt (待整合)
```

## 📝 註解說明格式

每個 Markdown prompt 檔案都包含以下註解區塊：

```markdown
<!-- 
====================
📍 使用位置 (Used In)
====================
說明在哪些檔案的哪一行被調用

====================
🎯 功能說明 (Purpose)
====================
說明此 prompt 的主要功能和用途

====================
🔧 相關變數 (Variables)
====================
列出所有使用的變數 {{variable}}

====================
📦 引入檔案 (Imports)
====================
列出引入的其他 prompt 檔案

====================
⚠️ 注意事項 (Notes)
====================
特殊說明或待辦事項
-->
```

## 🚀 待整合項目

### 高優先級
1. **reflection.md** - 將 reflectNaturally() 函數改為使用 PromptService
2. **brainstorm.md** - 需要將 aiService 移至 API route 才能整合

### 中優先級
3. **analysis.md** - 白板分析功能的 prompt
4. **summary.md** - 摘要功能的 prompt

## 💡 調整建議

### 如何查看 prompt 使用情況
1. 開啟對應的 .md 檔案
2. 查看檔案頂部的註解區塊
3. 找到「📍 使用位置」部分

### 如何新增 prompt
1. 在適當的資料夾建立 .md 檔案
2. 加入標準註解區塊
3. 編寫 prompt 內容
4. 在程式碼中使用 PromptService 載入
5. 更新此索引檔案

### 如何調整現有 prompt
1. 找到對應的 .md 檔案
2. 查看註解了解使用情況
3. 修改 prompt 內容
4. 測試修改效果
5. 更新註解（如有需要）

## 🔍 快速查找

### Agent 相關
- 主系統行為 → `agent/main.md`
- 意圖理解 → `agent/intent-analysis.md`
- 圖探索 → `agent/graph-exploration.md`
- 反思決策 → `agent/reflection.md`

### 服務功能
- 腦力激盪 → `services/brainstorm.md`
- 內容分析 → `services/analysis.md`
- 摘要生成 → `services/summary.md`

## 📌 重要提醒

- 修改 prompt 時記得更新註解
- 新增變數時要在註解中說明
- 整合狀態變更時更新此索引
- 保持註解格式的一致性