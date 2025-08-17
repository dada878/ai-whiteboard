# Prompts 管理系統

此資料夾集中管理所有 AI 相關的 prompts，方便調整和維護。

## 📁 資料夾結構

```
prompts/
├── agent/           # AI Agent 相關 prompts（主要系統）
├── system/          # 其他系統級 prompts
├── tools/           # 工具相關策略 prompts  
├── services/        # 各服務功能的 prompts
├── components/      # UI 元件相關 prompts
└── templates/       # 可重用的 prompt 片段
```

## 🔧 使用方式

```typescript
import { PromptService } from '@/app/services/promptService';

const promptService = new PromptService();

// 載入 prompt
const prompt = await promptService.loadPrompt('agent/main.md');

// 載入並替換變數
const compiled = await promptService.compilePrompt('agent/main.md', {
  userMessage: '使用者的問題',
  whiteboardSummary: '白板摘要內容'
});
```

## 📝 Prompt 格式規範

### 變數替換
使用 `{{variableName}}` 語法：
```markdown
使用者問：「{{userMessage}}」
```

### 引入其他檔案
使用 `{{import:path}}` 語法：
```markdown
{{import:../templates/common.md}}
```

### 條件邏輯
使用 `{{#if condition}}...{{/if}}` 語法：
```markdown
{{#if needsSearch}}
請執行搜尋策略
{{/if}}
```

## 🎯 設計原則

1. **模組化** - 每個 prompt 專注單一職責
2. **可重用** - 共用部分抽取到 templates
3. **易維護** - 清晰的檔案命名和組織
4. **版本控制** - 所有變更都可追蹤