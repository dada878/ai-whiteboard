<!-- 
====================
📍 使用位置 (Used In)
====================
- /prompts/agent/main.md (Line 28: {{import:./graph-exploration.md}})
  - 被主要系統 prompt 引入，作為圖探索策略說明
  
====================
🎯 功能說明 (Purpose)
====================
- 定義如何正確探索便利貼之間的連接關係
- 教導 AI 使用 get_note_by_id 工具探索相鄰節點
- 避免重複探索同一個節點的錯誤
- 提供廣度優先和深度限制的探索策略

====================
⚠️ 重要規則 (Important Rules)
====================
- 不要重複對同一個便利貼使用 get_note_by_id
- 對 connections.incoming/outgoing 中的 noteId 使用 get_note_by_id
- 通常探索 1-2 層即可，避免過深探索
- 記錄已探索的節點，避免循環

====================
🛠️ 相關工具 (Related Tools)
====================
- search_notes - 初始搜尋找到相關便利貼
- get_note_by_id - 獲取便利貼詳細資訊和連接關係
-->

# 圖探索策略

## 核心概念

圖探索是理解便利貼之間關係的關鍵策略。透過探索連接關係，可以發現隱藏的脈絡和相關資訊。

## 執行步驟

### 步驟 1：初始搜尋
使用 `search_notes` 找到相關便利貼

### 步驟 2：獲取連接資訊
對找到的便利貼使用 `get_note_by_id`，獲取其連接關係：
- `connections.incoming`：連到這個便利貼的其他便利貼
- `connections.outgoing`：從這個便利貼連出去的便利貼

### 步驟 3：探索相鄰節點（關鍵）
對**連接關係中的其他便利貼 ID** 使用 `get_note_by_id` 來探索相鄰節點

## ⚠️ 重要提醒

### 正確做法
- 對 `connections.incoming` 和 `connections.outgoing` 中的 `noteId` 使用 `get_note_by_id`
- 這些 noteId 代表相鄰的便利貼，可能包含相關資訊

### 錯誤做法
- ❌ 重複對同一個便利貼使用 `get_note_by_id`
- ❌ 忽略連接關係中的相鄰節點

## 範例流程

```
第一步：search_notes 找到便利貼 note_123
第二步：get_note_by_id(note_123) 獲得連接關係
       發現 connections.outgoing 包含 note_456
第三步：get_note_by_id(note_456) 探索相鄰節點
```

## 探索策略

1. **廣度優先**：先探索所有直接相鄰的節點
2. **深度限制**：通常探索 1-2 層即可
3. **選擇性探索**：根據節點內容判斷是否值得深入探索
4. **避免循環**：記錄已探索的節點，避免重複

## 應用場景

- 尋找相關概念的完整脈絡
- 理解因果關係鏈
- 發現隱藏的關聯
- 建構知識網絡