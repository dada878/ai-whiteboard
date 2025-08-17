import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { WhiteboardData } from '@/app/types';
import { aiAgentTools } from '../tools';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
});

// 最大工具呼叫次數
const MAX_TOOL_CALLS = 20;

// 意圖分析提示詞
const INTENT_ANALYSIS_PROMPT = `分析使用者的問題，識別其真正的意圖和需求。

請分析以下問題並以 JSON 格式回應：
{
  "intent_type": "search|analysis|overview|specific|comparison",
  "key_entities": ["關鍵實體或概念"],
  "expected_answer_type": "list|detail|summary|relationship|count",
  "search_keywords": ["建議的搜尋關鍵字"],
  "alternative_keywords": ["替代關鍵字"],
  "context_needed": ["需要的上下文類型"],
  "confidence": 0-100
}

意圖類型說明：
- search: 尋找特定內容
- analysis: 分析關係或模式
- overview: 獲取總覽
- specific: 查詢特定項目
- comparison: 比較多個項目`;

// 主系統提示詞
const SYSTEM_PROMPT = `你是一個智能白板助手。你可以幫助使用者查詢和分析白板上的內容。

核心原則：
1. **先理解意圖，再行動**
2. **提供相關 context**
3. **持續檢查是否回答原始問題**

工作流程：
1. 分析使用者意圖
2. 基於意圖提供相關的白板 context
3. 決定需要使用的工具
4. 執行工具並收集資訊
5. 反思是否已回答原始問題
6. 生成最終答案

反思標準（每次工具調用後）：
- 我收集的資訊是否回答了使用者的問題？
- 信心程度如何？
- 還需要什麼資訊？

決策格式：
{
  "continue": true/false,
  "reason": "決策理由",
  "confidence": 0-100,
  "answered_original": true/false,
  "next_action": "下一步行動"
}`;

export async function POST(request: NextRequest) {
  try {
    const { message, whiteboardData, conversationHistory = [] } = await request.json();
    
    if (!whiteboardData) {
      return new Response(
        JSON.stringify({ error: 'Whiteboard data is required' }),
        { status: 400 }
      );
    }

    // 建立 SSE 回應
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ============ 階段 1: 意圖分析 ============
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'analyzing_intent',
              message: '分析您的問題意圖...'
            })}\n\n`
          ));

          // 分析使用者意圖
          const intentAnalysis = await analyzeIntent(message);
          
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'intent_analyzed',
              intent: intentAnalysis
            })}\n\n`
          ));

          // ============ 階段 2: 生成智能 Context ============
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'generating_context',
              message: '準備相關的白板資訊...'
            })}\n\n`
          ));

          // 基於意圖生成相關的 context
          const contextualInfo = generateSmartContext(
            whiteboardData, 
            intentAnalysis
          );

          // 提供初步的白板概覽
          const overviewMessage = generateOverviewMessage(
            whiteboardData,
            intentAnalysis,
            contextualInfo
          );

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'context_ready',
              overview: overviewMessage
            })}\n\n`
          ));

          // ============ 階段 3: 準備對話 ============
          const systemPromptWithContext = `${SYSTEM_PROMPT}

使用者意圖分析：
${JSON.stringify(intentAnalysis, null, 2)}

白板相關資訊：
${contextualInfo}

記住：你的目標是回答使用者的原始問題：「${message}」`;

          const messages: ChatCompletionMessageParam[] = [
            { 
              role: 'system', 
              content: systemPromptWithContext
            },
            ...conversationHistory,
            { 
              role: 'user', 
              content: message 
            }
          ];

          // ============ 階段 4: 工具調用循環 ============
          let toolCallCount = 0;
          const allMessages = [...messages];
          let shouldContinue = true;
          const collectedInfo: any[] = [];

          while (shouldContinue && toolCallCount < MAX_TOOL_CALLS) {
            // 呼叫 OpenAI
            const completion = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: allMessages,
              tools: aiAgentTools,
              tool_choice: 'auto',
              temperature: 0.7,
            });

            const responseMessage = completion.choices[0].message;

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
              allMessages.push(responseMessage);

              for (const toolCall of responseMessage.tool_calls) {
                toolCallCount++;
                
                const tc = toolCall as any;
                
                // 發送工具呼叫開始事件
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call_start',
                    tool: tc.function.name,
                    args: JSON.parse(tc.function.arguments),
                    attempt: toolCallCount,
                    maxAttempts: MAX_TOOL_CALLS
                  })}\n\n`
                ));

                // 執行工具
                const result = await executeToolCall(
                  tc.function.name,
                  JSON.parse(tc.function.arguments),
                  whiteboardData
                );

                collectedInfo.push({
                  tool: tc.function.name,
                  args: JSON.parse(tc.function.arguments),
                  result: result
                });

                // 發送工具呼叫結果
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call_result',
                    tool: tc.function.name,
                    result: result,
                    attempt: toolCallCount
                  })}\n\n`
                ));

                // 添加工具結果到訊息歷史
                allMessages.push({
                  role: 'tool' as const,
                  content: typeof result === 'string' ? result : JSON.stringify(result),
                  tool_call_id: tc.id
                });
              }

              // ============ 階段 5: 反思與決策 ============
              if (toolCallCount < MAX_TOOL_CALLS) {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'reflecting',
                    message: '評估是否已找到答案...'
                  })}\n\n`
                ));

                // 反思決策
                const decision = await makeDecision(
                  message,
                  intentAnalysis,
                  collectedInfo,
                  toolCallCount
                );

                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'decision',
                    decision: decision
                  })}\n\n`
                ));

                shouldContinue = decision.continue === true;
                
                if (shouldContinue) {
                  allMessages.push({
                    role: 'assistant',
                    content: `反思結果：${decision.reason}。下一步：${decision.next_action}`
                  });
                }
              }
            } else {
              shouldContinue = false;
            }
          }

          // ============ 階段 6: 生成最終回應 ============
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'response_start' })}\n\n`
          ));

          // 最終提醒
          allMessages.push({
            role: 'system',
            content: `請基於所有收集的資訊，回答使用者的原始問題：「${message}」
            
意圖：${intentAnalysis.intent_type}
期望答案類型：${intentAnalysis.expected_answer_type}

如果資訊不完整，請誠實說明找到了什麼，還缺什麼。`
          });

          // 生成最終回應
          const finalStream = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: allMessages,
            temperature: 0.7,
            stream: true,
          });

          for await (const chunk of finalStream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'response_chunk', 
                  content 
                })}\n\n`
              ));
            }
          }

          // 完成
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'done',
              totalToolCalls: toolCallCount,
              intent: intentAnalysis
            })}\n\n`
          ));

        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'error', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            })}\n\n`
          ));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('AI Agent error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to process request' }),
      { status: 500 }
    );
  }
}

// ============ 輔助函數 ============

// 分析使用者意圖
async function analyzeIntent(question: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: INTENT_ANALYSIS_PROMPT
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Intent analysis failed:', error);
    return {
      intent_type: 'search',
      key_entities: [],
      expected_answer_type: 'list',
      search_keywords: [question],
      alternative_keywords: [],
      context_needed: ['overview'],
      confidence: 50
    };
  }
}

// 基於意圖生成智能 context
function generateSmartContext(
  whiteboardData: WhiteboardData,
  intent: any
): string {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  const edges = whiteboardData.edges || [];
  
  let context = '';

  // 根據意圖類型提供不同的 context
  switch (intent.intent_type) {
    case 'overview':
      // 提供完整的概覽
      context = generateFullOverview(whiteboardData);
      break;
      
    case 'search':
      // 提供與搜尋關鍵字相關的 context
      context = generateSearchContext(whiteboardData, intent.search_keywords);
      break;
      
    case 'analysis':
      // 提供關係和結構資訊
      context = generateRelationshipContext(whiteboardData);
      break;
      
    case 'specific':
      // 提供特定項目的詳細資訊
      context = generateSpecificContext(whiteboardData, intent.key_entities);
      break;
      
    case 'comparison':
      // 提供比較所需的資訊
      context = generateComparisonContext(whiteboardData, intent.key_entities);
      break;
      
    default:
      context = generateFullOverview(whiteboardData);
  }

  return context;
}

// 生成完整概覽
function generateFullOverview(whiteboardData: WhiteboardData): string {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  const edges = whiteboardData.edges || [];
  const images = whiteboardData.images || [];
  
  // 識別主題
  const themes = identifyThemes(notes);
  
  // 找出重要節點（連接最多的）
  const importantNotes = findImportantNotes(notes, edges);
  
  // 群組層級結構
  const groupHierarchy = buildGroupHierarchy(groups);
  
  return `
=== 白板完整概覽 ===

📊 基本統計：
- 便利貼總數：${notes.length}
- 群組總數：${groups.length}
- 連接線總數：${edges.length}
- 圖片總數：${images.length}

🎯 識別的主題：
${themes.length > 0 ? themes.join('、') : '未識別到明確主題'}

📍 重要節點（連接最多）：
${importantNotes.map(n => `- ${n.content.substring(0, 50)}`).join('\n')}

🗂️ 群組結構：
${groupHierarchy}

💡 內容摘要：
${generateContentSummary(notes)}
`;
}

// 生成搜尋相關的 context
function generateSearchContext(whiteboardData: WhiteboardData, keywords: string[]): string {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  
  // 找出可能相關的內容
  const relatedNotes = notes.filter(note => {
    const content = note.content.toLowerCase();
    return keywords.some(k => content.includes(k.toLowerCase()));
  });
  
  const relatedGroups = groups.filter(group => {
    const name = group.name.toLowerCase();
    return keywords.some(k => name.includes(k.toLowerCase()));
  });
  
  return `
=== 搜尋相關資訊 ===

🔍 搜尋關鍵字：${keywords.join('、')}

📝 可能相關的便利貼（預覽）：
${relatedNotes.slice(0, 5).map(n => `- ${n.content.substring(0, 50)}`).join('\n')}
共 ${relatedNotes.length} 個可能相關

📁 可能相關的群組：
${relatedGroups.map(g => `- ${g.name} (${g.noteIds?.length || 0} 個便利貼)`).join('\n')}

💡 提示：如果初步搜尋無結果，可以嘗試相關詞彙或更廣泛的搜尋。
`;
}

// 生成關係 context
function generateRelationshipContext(whiteboardData: WhiteboardData): string {
  const notes = whiteboardData.notes || [];
  const edges = whiteboardData.edges || [];
  const groups = whiteboardData.groups || [];
  
  // 分析連接模式
  const connectionStats = analyzeConnections(notes, edges);
  
  return `
=== 關係結構分析 ===

🔗 連接統計：
- 總連接數：${edges.length}
- 最多連出：${connectionStats.maxOutgoing.content} (${connectionStats.maxOutgoingCount} 條)
- 最多連入：${connectionStats.maxIncoming.content} (${connectionStats.maxIncomingCount} 條)
- 孤立節點：${connectionStats.isolated} 個

🗂️ 群組關係：
- 頂層群組：${groups.filter(g => !g.parentGroupId).length} 個
- 最大群組：${connectionStats.largestGroup?.name} (${connectionStats.largestGroup?.noteCount} 個便利貼)
- 巢狀深度：最深 ${connectionStats.maxDepth} 層

🎯 中心節點（hub）：
${connectionStats.hubs.map((h: any) => `- ${h.content.substring(0, 50)}`).join('\n')}
`;
}

// 生成特定項目的 context
function generateSpecificContext(whiteboardData: WhiteboardData, entities: string[]): string {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  
  let context = `
=== 特定項目資訊 ===

🎯 查詢目標：${entities.join('、')}
`;

  entities.forEach(entity => {
    const relatedNotes = notes.filter(n => 
      n.content.toLowerCase().includes(entity.toLowerCase())
    );
    const relatedGroups = groups.filter(g => 
      g.name.toLowerCase().includes(entity.toLowerCase())
    );
    
    context += `
📌 關於「${entity}」：
- 相關便利貼：${relatedNotes.length} 個
- 相關群組：${relatedGroups.length} 個
${relatedNotes.slice(0, 3).map(n => `  • ${n.content.substring(0, 40)}`).join('\n')}
`;
  });

  return context;
}

// 生成比較 context
function generateComparisonContext(whiteboardData: WhiteboardData, entities: string[]): string {
  return `
=== 比較分析準備 ===

📊 比較項目：${entities.join(' vs ')}

需要收集的資訊：
1. 各項目的基本資訊
2. 相關便利貼數量
3. 所屬群組
4. 連接關係
5. 主要特徵

這些資訊將透過工具調用收集。
`;
}

// 生成概覽訊息
function generateOverviewMessage(
  whiteboardData: WhiteboardData,
  intent: any,
  contextualInfo: string
): string {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  
  return `我已經分析了您的問題，理解您想要${getIntentDescription(intent.intent_type)}。

白板目前有 ${notes.length} 個便利貼和 ${groups.length} 個群組。
${intent.key_entities.length > 0 ? `\n我會特別關注：${intent.key_entities.join('、')}` : ''}

讓我為您查詢相關資訊...`;
}

// 獲取意圖描述
function getIntentDescription(intentType: string): string {
  const descriptions: Record<string, string> = {
    'search': '搜尋特定內容',
    'analysis': '分析關係或模式',
    'overview': '獲取總覽資訊',
    'specific': '查詢特定項目',
    'comparison': '比較多個項目'
  };
  return descriptions[intentType] || '查詢資訊';
}

// 做出繼續與否的決策
async function makeDecision(
  originalQuestion: string,
  intent: any,
  collectedInfo: any[],
  toolCount: number
): Promise<any> {
  const decisionPrompt = `
原始問題：${originalQuestion}
使用者意圖：${intent.intent_type}
期望答案類型：${intent.expected_answer_type}
已收集資訊：${JSON.stringify(collectedInfo, null, 2)}
工具調用次數：${toolCount}/5

請評估：
1. 收集的資訊是否足以回答原始問題？
2. 如果不足，具體還需要什麼？
3. 信心程度如何？

回應必須是 JSON 格式：
{
  "continue": true/false,
  "reason": "決策理由",
  "confidence": 0-100,
  "answered_original": true/false,
  "next_action": "如果繼續，下一步做什麼",
  "missing_info": "還缺少什麼資訊"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一個決策助手，評估是否已收集足夠資訊來回答使用者問題。'
        },
        {
          role: 'user',
          content: decisionPrompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Decision making failed:', error);
    return {
      continue: false,
      reason: 'Decision error',
      confidence: 50,
      answered_original: false,
      next_action: '',
      missing_info: 'unknown'
    };
  }
}

// ============ 分析函數 ============

// 識別主題
function identifyThemes(notes: any[]): string[] {
  const themes: Set<string> = new Set();
  const keywordMap: Record<string, string> = {
    '付費': '商業模式',
    '價格': '商業模式',
    '訂閱': '商業模式',
    '免費': '商業模式',
    '收費': '商業模式',
    '用戶': '使用者研究',
    '客戶': '使用者研究',
    '使用者': '使用者研究',
    'TA': '使用者研究',
    'UI': '設計',
    'UX': '設計',
    '介面': '設計',
    '設計': '設計',
    'API': '技術架構',
    '資料庫': '技術架構',
    '後端': '技術架構',
    '前端': '技術架構',
    '功能': '產品規劃',
    '需求': '產品規劃',
    'MVP': '產品規劃',
    '流程': '流程設計',
    '步驟': '流程設計',
  };

  notes.forEach(note => {
    const content = note.content.toLowerCase();
    Object.entries(keywordMap).forEach(([keyword, theme]) => {
      if (content.includes(keyword.toLowerCase())) {
        themes.add(theme);
      }
    });
  });

  return Array.from(themes);
}

// 找出重要節點
function findImportantNotes(notes: any[], edges: any[]): any[] {
  const connectionCount = new Map<string, number>();
  
  edges.forEach(edge => {
    connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
    connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
  });
  
  return notes
    .map(note => ({
      ...note,
      connections: connectionCount.get(note.id) || 0
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5);
}

// 分析連接
function analyzeConnections(notes: any[], edges: any[]): any {
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  
  edges.forEach(edge => {
    outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
  });
  
  let maxOutgoing = { content: '', id: '' };
  let maxOutgoingCount = 0;
  let maxIncoming = { content: '', id: '' };
  let maxIncomingCount = 0;
  
  notes.forEach(note => {
    const out = outgoing.get(note.id) || 0;
    const inc = incoming.get(note.id) || 0;
    
    if (out > maxOutgoingCount) {
      maxOutgoingCount = out;
      maxOutgoing = note;
    }
    if (inc > maxIncomingCount) {
      maxIncomingCount = inc;
      maxIncoming = note;
    }
  });
  
  const isolated = notes.filter(n => 
    !outgoing.has(n.id) && !incoming.has(n.id)
  ).length;
  
  const hubs = notes
    .filter(n => {
      const total = (outgoing.get(n.id) || 0) + (incoming.get(n.id) || 0);
      return total >= 3;
    })
    .slice(0, 3);
  
  return {
    maxOutgoing,
    maxOutgoingCount,
    maxIncoming,
    maxIncomingCount,
    isolated,
    hubs,
    largestGroup: null,
    maxDepth: 0
  };
}

// 建立群組階層
function buildGroupHierarchy(groups: any[]): string {
  const topLevel = groups.filter(g => !g.parentGroupId);
  if (topLevel.length === 0) return '無群組結構';
  
  let hierarchy = '';
  topLevel.forEach(group => {
    hierarchy += `\n- ${group.name} (${group.noteIds?.length || 0} 個便利貼)`;
    const children = groups.filter(g => g.parentGroupId === group.id);
    children.forEach(child => {
      hierarchy += `\n  └─ ${child.name} (${child.noteIds?.length || 0} 個便利貼)`;
    });
  });
  
  return hierarchy;
}

// 生成內容摘要
function generateContentSummary(notes: any[]): string {
  if (notes.length === 0) return '白板目前沒有內容';
  
  const samples = notes.slice(0, 5).map(n => {
    const content = n.content.length > 60 ? 
      n.content.substring(0, 60) + '...' : 
      n.content;
    return `- ${content}`;
  });
  
  return samples.join('\n') + 
    (notes.length > 5 ? `\n... 還有 ${notes.length - 5} 個便利貼` : '');
}

// ============ 工具執行函數（從其他檔案複製） ============

async function executeToolCall(
  toolName: string,
  args: any,
  whiteboardData: WhiteboardData
) {
  switch (toolName) {
    case 'search_notes':
      return await searchNotes(args, whiteboardData);
    case 'get_note_by_id':
      return await getNoteById(args, whiteboardData);
    case 'search_groups':
      return await searchGroups(args, whiteboardData);
    case 'get_group_by_id':
      return await getGroupById(args, whiteboardData);
    case 'get_whiteboard_overview':
      return await getWhiteboardOverview(args, whiteboardData);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// [以下省略工具實作函數，與 stream-reflection/route.ts 相同]
async function searchNotes(params: any, whiteboardData: WhiteboardData) {
  let notes = whiteboardData.notes || [];
  if (params.in_group) {
    notes = notes.filter(note => note.groupId === params.in_group);
  }
  const matchedNotes = notes.filter(note => {
    const content = note.content.toLowerCase();
    const keywords = params.keywords.map((k: any) => k.toLowerCase());
    if (params.match_type === 'all') {
      return keywords.every((keyword: any) => content.includes(keyword));
    } else {
      return keywords.some((keyword: any) => content.includes(keyword));
    }
  });
  return {
    results: matchedNotes,
    totalMatches: matchedNotes.length,
    searchSummary: `找到 ${matchedNotes.length} 個符合的便利貼`
  };
}

async function getNoteById(params: any, whiteboardData: WhiteboardData) {
  const note = (whiteboardData.notes || []).find(n => n.id === params.note_id);
  if (!note) {
    return { note: null, error: `找不到 ID 為 ${params.note_id} 的便利貼` };
  }
  return { note };
}

async function searchGroups(params: any, whiteboardData: WhiteboardData) {
  const groups = whiteboardData.groups || [];
  const matchedGroups = groups.filter(group => {
    const name = group.name.toLowerCase();
    const keywords = params.keywords.map((k: any) => k.toLowerCase());
    if (params.match_type === 'all') {
      return keywords.every((keyword: any) => name.includes(keyword));
    } else {
      return keywords.some((keyword: any) => name.includes(keyword));
    }
  });
  return {
    results: matchedGroups,
    totalMatches: matchedGroups.length
  };
}

async function getGroupById(params: any, whiteboardData: WhiteboardData) {
  const group = (whiteboardData.groups || []).find(g => g.id === params.group_id);
  if (!group) {
    return { group: null, error: `找不到 ID 為 ${params.group_id} 的群組` };
  }
  return { group };
}

async function getWhiteboardOverview(params: any, whiteboardData: WhiteboardData) {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  const edges = whiteboardData.edges || [];
  const images = whiteboardData.images || [];
  return {
    stats: {
      totalNotes: notes.length,
      totalGroups: groups.length,
      totalEdges: edges.length,
      totalImages: images.length
    }
  };
}

function calculateGroupDepth(groupId: string, groups: any[]): number {
  let depth = 0;
  let currentGroup = groups.find(g => g.id === groupId);
  while (currentGroup?.parentGroupId) {
    depth++;
    currentGroup = groups.find(g => g.id === currentGroup.parentGroupId);
    if (depth > 10) break;
  }
  return depth;
}