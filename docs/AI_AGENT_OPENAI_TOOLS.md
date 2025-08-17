# AI Agent OpenAI Function Calling 設計文件

## 概述
使用 OpenAI 的 Function Calling 功能來實現 AI Agent，讓 AI 可以自動選擇和呼叫適當的工具來查詢白板資料。

## OpenAI Function Calling 整合

### API 設定
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 使用支援 Function Calling 的模型
const MODEL = 'gpt-4-turbo-preview'; // 或 gpt-3.5-turbo
```

## 工具定義（OpenAI Format）

### 1. search_notes - 搜尋便利貼

```typescript
const searchNotesTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_notes',
    description: '根據關鍵字搜尋白板上的便利貼內容',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '搜尋關鍵字列表（1-5個關鍵字）',
          minItems: 1,
          maxItems: 5
        },
        match_type: {
          type: 'string',
          enum: ['any', 'all'],
          description: '匹配模式：any(任一關鍵字) 或 all(所有關鍵字)',
          default: 'any'
        },
        in_group: {
          type: 'string',
          description: '限定在特定群組ID內搜尋（選填）'
        }
      },
      required: ['keywords']
    }
  }
};
```

### 2. get_note_by_id - 根據 ID 查詢便利貼

```typescript
const getNoteByIdTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_note_by_id',
    description: '根據ID獲取特定便利貼的詳細資訊，包含連接關係和所屬群組',
    parameters: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: '便利貼的唯一識別碼'
        },
        include_connections: {
          type: 'boolean',
          description: '是否包含連接關係資訊',
          default: true
        },
        include_group: {
          type: 'boolean',
          description: '是否包含群組資訊',
          default: true
        }
      },
      required: ['note_id']
    }
  }
};
```

### 3. search_groups - 搜尋群組

```typescript
const searchGroupsTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_groups',
    description: '根據關鍵字搜尋群組名稱',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '搜尋關鍵字列表（1-5個關鍵字）',
          minItems: 1,
          maxItems: 5
        },
        match_type: {
          type: 'string',
          enum: ['any', 'all'],
          description: '匹配模式：any(任一關鍵字) 或 all(所有關鍵字)',
          default: 'any'
        },
        include_nested: {
          type: 'boolean',
          description: '是否包含巢狀群組',
          default: true
        }
      },
      required: ['keywords']
    }
  }
};
```

### 4. get_group_by_id - 根據 ID 查詢群組

```typescript
const getGroupByIdTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_group_by_id',
    description: '根據ID獲取特定群組的詳細資訊，包含子群組和便利貼',
    parameters: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: '群組的唯一識別碼'
        },
        include_contents: {
          type: 'boolean',
          description: '是否包含群組內容（便利貼和子群組）',
          default: true
        },
        include_parent: {
          type: 'boolean',
          description: '是否包含父群組資訊',
          default: true
        },
        max_depth: {
          type: 'integer',
          description: '遞迴查詢子群組的最大深度',
          default: 1,
          minimum: 1,
          maximum: 5
        }
      },
      required: ['group_id']
    }
  }
};
```

## 完整的工具列表

```typescript
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  searchNotesTool,
  getNoteByIdTool,
  searchGroupsTool,
  getGroupByIdTool
];
```

## API 實作範例

### API Route Handler (`/app/api/ai-agent/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { WhiteboardData } from '@/app/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, whiteboardData, conversationHistory } = await request.json();
    
    // 構建系統提示詞
    const systemMessage = `你是一個智能白板助手。你可以幫助使用者查詢和分析白板上的內容。
    
當前白板概況：
- 便利貼數量：${whiteboardData.notes.length}
- 群組數量：${whiteboardData.groups.length}
- 連接線數量：${whiteboardData.edges.length}

使用工具時請注意：
1. 搜尋時使用相關的關鍵字
2. 需要詳細資訊時使用 ID 查詢
3. 可以組合多個工具來回答複雜問題
4. 追蹤關係時要注意避免無限循環`;

    // 調用 OpenAI API with Function Calling
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemMessage },
        ...conversationHistory,
        { role: 'user', content: message }
      ],
      tools: tools,
      tool_choice: 'auto', // 讓 AI 自動決定是否使用工具
    });

    const responseMessage = completion.choices[0].message;

    // 處理工具呼叫
    if (responseMessage.tool_calls) {
      const toolResults = await handleToolCalls(
        responseMessage.tool_calls,
        whiteboardData
      );

      // 將工具結果回傳給 AI 生成最終回應
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemMessage },
          ...conversationHistory,
          { role: 'user', content: message },
          responseMessage,
          ...toolResults.map(result => ({
            role: 'tool' as const,
            content: JSON.stringify(result.data),
            tool_call_id: result.tool_call_id
          }))
        ]
      });

      return NextResponse.json({
        reply: finalCompletion.choices[0].message.content,
        toolCalls: toolResults
      });
    }

    // 沒有工具呼叫，直接返回回應
    return NextResponse.json({
      reply: responseMessage.content
    });

  } catch (error) {
    console.error('AI Agent error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// 處理工具呼叫
async function handleToolCalls(
  toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
  whiteboardData: WhiteboardData
) {
  const results = [];

  for (const toolCall of toolCalls) {
    const args = JSON.parse(toolCall.function.arguments);
    let result;

    switch (toolCall.function.name) {
      case 'search_notes':
        result = await searchNotes(args, whiteboardData);
        break;
      case 'get_note_by_id':
        result = await getNoteById(args, whiteboardData);
        break;
      case 'search_groups':
        result = await searchGroups(args, whiteboardData);
        break;
      case 'get_group_by_id':
        result = await getGroupById(args, whiteboardData);
        break;
      default:
        result = { error: 'Unknown tool' };
    }

    results.push({
      tool_call_id: toolCall.id,
      data: result
    });
  }

  return results;
}
```

### 工具實作範例

```typescript
// 搜尋便利貼實作
async function searchNotes(
  params: {
    keywords: string[];
    match_type?: 'any' | 'all';
    in_group?: string;
  },
  whiteboardData: WhiteboardData
) {
  let notes = whiteboardData.notes;
  
  // 如果指定群組，先過濾
  if (params.in_group) {
    notes = notes.filter(note => note.groupId === params.in_group);
  }
  
  // 關鍵字搜尋
  const matchedNotes = notes.filter(note => {
    const content = note.content.toLowerCase();
    const keywords = params.keywords.map(k => k.toLowerCase());
    
    if (params.match_type === 'all') {
      return keywords.every(keyword => content.includes(keyword));
    } else {
      return keywords.some(keyword => content.includes(keyword));
    }
  });
  
  // 增強資料（加入連接和群組資訊）
  const enhancedNotes = matchedNotes.map(note => {
    const incoming = whiteboardData.edges
      .filter(edge => edge.to === note.id)
      .map(edge => {
        const sourceNote = whiteboardData.notes.find(n => n.id === edge.from);
        return {
          noteId: edge.from,
          noteContent: sourceNote?.content.substring(0, 50) || ''
        };
      });
    
    const outgoing = whiteboardData.edges
      .filter(edge => edge.from === note.id)
      .map(edge => {
        const targetNote = whiteboardData.notes.find(n => n.id === edge.to);
        return {
          noteId: edge.to,
          noteContent: targetNote?.content.substring(0, 50) || ''
        };
      });
    
    const group = whiteboardData.groups.find(g => g.noteIds.includes(note.id));
    
    return {
      id: note.id,
      content: note.content,
      color: note.color,
      position: { x: note.x, y: note.y },
      connections: { incoming, outgoing },
      group: group ? { id: group.id, name: group.name } : undefined
    };
  });
  
  return {
    results: enhancedNotes,
    totalMatches: enhancedNotes.length,
    searchSummary: `找到 ${enhancedNotes.length} 個符合的便利貼`
  };
}
```

## 前端整合

### React Hook 使用範例

```typescript
// hooks/useAIAgent.ts
import { useState } from 'react';
import { WhiteboardData } from '@/app/types';

export function useAIAgent(whiteboardData: WhiteboardData) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          whiteboardData,
          conversationHistory: messages
        })
      });

      const data = await response.json();
      
      // 更新對話歷史
      setMessages(prev => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: data.reply }
      ]);

      return data;
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    sendMessage,
    isLoading
  };
}
```

### 對話元件範例

```typescript
// components/AIChat/AIChatPanel.tsx
import React, { useState } from 'react';
import { useAIAgent } from '@/hooks/useAIAgent';
import { WhiteboardData } from '@/app/types';

interface AIChatPanelProps {
  whiteboardData: WhiteboardData;
}

export function AIChatPanel({ whiteboardData }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, isLoading } = useAIAgent(whiteboardData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input;
    setInput('');
    await sendMessage(userInput);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 對話歷史 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex space-x-2">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 輸入框 */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="詢問關於白板的問題..."
            className="flex-1 px-4 py-2 border rounded-lg"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            發送
          </button>
        </div>
      </form>
    </div>
  );
}
```

## 對話範例

### 範例 1：搜尋功能
```
使用者：找出所有關於產品規劃的便利貼

AI 內部處理：
1. OpenAI 自動呼叫 search_notes({ keywords: ['產品', '規劃'], match_type: 'any' })
2. 收到工具結果
3. 生成自然語言回應

AI 回應：我找到了 5 個關於產品規劃的便利貼：

1. 「Q1 產品規劃會議」（黃色）
   - 位於「會議記錄」群組
   - 連接到：「行動項目」、「待辦事項」

2. 「產品路線圖 2024」（綠色）
   - 位於「策略」群組
   - 連接到：「里程碑」、「KPI 指標」
...
```

### 範例 2：關係追蹤
```
使用者：用戶登入功能會影響哪些模組？

AI 內部處理：
1. 呼叫 search_notes({ keywords: ['用戶登入'] })
2. 呼叫 get_note_by_id({ note_id: 'note_login' })
3. 對每個 outgoing connection 呼叫 get_note_by_id
4. 組織結果並回應

AI 回應：「用戶登入」功能會直接影響以下模組：

第一層影響：
• 身份驗證系統 - 處理登入驗證
• 會話管理 - 維護用戶狀態
• 權限控制 - 決定用戶訪問權限

第二層影響（透過上述模組）：
• 個人資料頁面
• 訂單系統
• 支付流程
...
```

## 優勢

1. **原生支援**：使用 OpenAI 內建的 Function Calling，無需自行設計複雜的工具選擇邏輯
2. **自動選擇**：AI 會根據問題自動決定要呼叫哪些工具
3. **並行呼叫**：OpenAI 可以在一次請求中呼叫多個工具
4. **錯誤處理**：內建參數驗證和錯誤處理機制
5. **類型安全**：使用 JSON Schema 定義參數，確保類型正確

## 部署注意事項

1. **API Key 管理**：
   ```env
   OPENAI_API_KEY=sk-xxx
   ```

2. **成本控制**：
   - 使用 `gpt-3.5-turbo` 降低成本
   - 實作快取機制避免重複查詢
   - 設定 max_tokens 限制

3. **效能優化**：
   - 批量處理工具呼叫
   - 使用 streaming 改善使用者體驗
   - 實作請求去重機制

4. **安全考量**：
   - 驗證工具參數
   - 限制遞迴深度
   - 實作 rate limiting