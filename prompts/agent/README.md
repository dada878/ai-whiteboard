# AI Agent Prompts

此資料夾包含所有 AI Agent 相關的 prompts。

## 📁 檔案結構

```
agent/
├── main.md              # 主要系統 prompt
├── intent-analysis.md   # 意圖分析 prompt
├── reflection.md        # 反思機制 prompt
└── graph-exploration.md # 圖探索策略
```

## 🔧 檔案說明

### main.md
- AI Agent 的主要系統 prompt
- 定義核心原則、工作流程
- 引入其他策略模組（如 graph-exploration.md）

### intent-analysis.md
- 分析使用者意圖
- 判斷問題類型（查詢類、建議類、分析類等）
- 決定搜尋策略

### reflection.md
- AI 反思機制
- 評估收集的資訊是否充足
- 決定是否需要繼續搜尋

### graph-exploration.md
- 圖探索策略說明
- 如何正確使用 get_note_by_id
- 探索相鄰節點的方法

## 💡 使用方式

在程式碼中載入：
```typescript
// 載入主要 prompt
await promptService.compilePrompt('agent/main.md', variables);

// 載入意圖分析
await promptService.compilePrompt('agent/intent-analysis.md', variables);
```

## 📝 調整建議

1. **調整搜尋策略**：編輯 `main.md` 的搜尋策略部分
2. **改善意圖理解**：修改 `intent-analysis.md` 的分析邏輯
3. **優化圖探索**：更新 `graph-exploration.md` 的探索規則
4. **加強反思能力**：調整 `reflection.md` 的評估標準