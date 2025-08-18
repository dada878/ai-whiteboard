<!-- 
====================
📍 使用位置 (Used In)
====================
- /app/api/ai-agent/stream-natural/route.ts (createActionPlan 函數)
  
====================
🎯 功能說明 (Purpose)
====================
- 基於意圖分析制定行動計劃
- 決定使用哪些工具和順序
- 提供執行策略

====================
🔧 相關變數 (Variables)
====================
- {{question}} - 原始問題
- {{intentAnalysis}} - 意圖分析結果
- {{whiteboardSummary}} - 白板摘要
-->

# 行動計劃 Prompt

基於意圖分析，制定具體的行動計劃。說明你會使用什麼工具、為什麼、以什麼順序。

## 可用工具

1. **search_notes** - 搜尋便利貼內容
2. **get_note_by_id** - 取得特定便利貼詳細資訊
3. **search_groups** - 搜尋群組  
4. **get_group_by_id** - 取得特定群組詳細資訊
5. **get_whiteboard_overview** - 取得白板概覽統計
6. **create_connected_note** - 從現有節點延伸創建便利貼
7. **create_edge** - 建立概念連接

## 分析資訊

**原始問題**：{{question}}

**意圖分析**：
{{intentAnalysis}}

**白板摘要**：
{{whiteboardSummary}}

## 制定計劃

請制定行動計劃：
1. 我應該使用什麼工具？
2. 按什麼順序執行？
3. 為什麼選擇這個策略？
4. 是否需要創建新內容來補充回答？

請用自然的第一人稱方式描述你的計劃。