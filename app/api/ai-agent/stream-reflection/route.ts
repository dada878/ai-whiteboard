import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { WhiteboardData } from '@/app/types';
import { aiAgentTools } from '../tools';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
});

// 最大工具呼叫次數
const MAX_TOOL_CALLS = 5;

// 改進的系統提示詞 - 加入反思原始問題的機制
const SYSTEM_PROMPT = `你是一個智能白板助手。你可以幫助使用者查詢和分析白板上的內容。

核心原則：
**永遠記住使用者的原始問題和意圖，每次工具調用後都要反思是否已經回答了使用者的問題。**

重要指引：

1. **理解並記住原始意圖**：
   - 仔細分析使用者的問題
   - 識別關鍵需求和期望的答案類型
   - 將原始問題分解為可驗證的子任務

2. **智慧搜尋與反思策略**：
   - 如果第一次搜尋沒有找到結果，分析為什麼失敗
   - 嘗試不同的搜尋策略（同義詞、相關詞、更廣或更窄的範圍）
   - 每次搜尋後評估：這個結果是否幫助回答了原始問題？

3. **連續工具使用與驗證**：
   - 每次工具調用後，問自己：
     a) 我找到了什麼有用的資訊？
     b) 這些資訊是否足以回答使用者的問題？
     c) 還需要什麼額外資訊？
   - 如果已經有足夠資訊，停止調用工具並生成答案
   - 如果資訊不足，明確說明還缺什麼，然後繼續搜尋

4. **決定是否繼續的標準**：
   當你收到工具結果後，使用以下 JSON 格式回應來決定下一步：
   {
     "continue": true/false,
     "reason": "為什麼要繼續或停止",
     "next_action": "如果繼續，下一步要做什麼",
     "confidence": 0-100,  // 對當前答案的信心程度
     "answered_original": true/false  // 是否已經回答了原始問題
   }

5. **回答方式**：
   - 明確引用找到的資訊
   - 如果無法完全回答，誠實說明找到了什麼，缺少什麼
   - 提供基於現有資訊的最佳答案

你可以：
1. 搜尋便利貼和群組
2. 查詢特定元素的詳細資訊
3. 分析便利貼之間的關係
4. 提供白板內容的摘要和洞察

回答時請：
- 使用繁體中文
- 保持友善和專業
- 明確說明資訊來源
- 誠實面對資訊不足的情況`;

// 反思提示詞 - 用於決定是否繼續
const REFLECTION_PROMPT = `基於剛才的工具調用結果，請評估：

1. 原始問題：{original_question}
2. 已收集的資訊：{collected_info}
3. 工具調用次數：{tool_count}/{max_tools}

請決定：
- 是否已經有足夠資訊回答原始問題？
- 如果要繼續，具體要搜尋什麼？
- 你對當前答案的信心程度？

回應格式必須是 JSON：
{
  "continue": true/false,
  "reason": "決策理由",
  "next_action": "下一步行動（如果繼續）",
  "confidence": 0-100,
  "answered_original": true/false,
  "missing_info": "還缺少什麼資訊（如果有）"
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

    // 構建白板概況
    const generateWhiteboardContext = () => {
      const notes = whiteboardData.notes || [];
      const groups = whiteboardData.groups || [];
      const edges = whiteboardData.edges || [];
      const images = whiteboardData.images || [];
      
      // 獲取主要群組
      const topGroups = groups
        .slice(0, 5)
        .map(g => `「${g.name}」(${g.noteIds?.length || 0} 個便利貼)`)
        .join('、');
      
      // 獲取一些關鍵便利貼內容（前10個）
      const sampleNotes = notes
        .slice(0, 10)
        .map(n => {
          const content = n.content.length > 30 ? 
            n.content.substring(0, 30) + '...' : 
            n.content;
          return content;
        });
      
      // 主題識別（簡單版本）
      const themes = identifyThemes(notes);
      
      return `
白板內容摘要：

基本統計：
- 便利貼數量：${notes.length}
- 群組數量：${groups.length}
- 連接線數量：${edges.length}
- 圖片數量：${images.length}

${themes.length > 0 ? `識別的主題：
${themes.join('、')}
` : ''}${groups.length > 0 ? `主要群組：
${topGroups}
` : ''}${sampleNotes.length > 0 ? `
部分便利貼內容：
${sampleNotes.map(s => `- ${s}`).join('\n')}
` : ''}
請注意：以上是白板的快速摘要，你可以使用工具查詢更詳細的資訊。`;
    };
    
    const whiteboardContext = generateWhiteboardContext();

    // 準備訊息
    const messages: ChatCompletionMessageParam[] = [
      { 
        role: 'system', 
        content: SYSTEM_PROMPT + '\n\n' + whiteboardContext 
      },
      ...conversationHistory,
      { 
        role: 'user', 
        content: message 
      }
    ];

    // 建立 SSE 回應
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let toolCallCount = 0;
          const allMessages = [...messages];
          let shouldContinue = true;
          let finalResponseStarted = false;
          const collectedInfo: any[] = [];

          // 連續工具呼叫循環
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

            // 如果有工具呼叫
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
              // 添加 assistant 訊息到歷史
              allMessages.push(responseMessage);

              // 處理每個工具呼叫
              for (const toolCall of responseMessage.tool_calls) {
                toolCallCount++;
                
                // 發送工具呼叫開始事件
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call_start',
                    tool: toolCall.function.name,
                    args: JSON.parse(toolCall.function.arguments),
                    attempt: toolCallCount,
                    maxAttempts: MAX_TOOL_CALLS
                  })}\n\n`
                ));

                // 執行工具
                const result = await executeToolCall(
                  toolCall.function.name,
                  JSON.parse(toolCall.function.arguments),
                  whiteboardData
                );

                // 收集資訊用於反思
                collectedInfo.push({
                  tool: toolCall.function.name,
                  args: JSON.parse(toolCall.function.arguments),
                  result: result
                });

                // 發送工具呼叫結果
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call_result',
                    tool: toolCall.function.name,
                    result: result,
                    attempt: toolCallCount
                  })}\n\n`
                ));

                // 添加工具結果到訊息歷史
                allMessages.push({
                  role: 'tool' as const,
                  content: typeof result === 'string' ? result : JSON.stringify(result),
                  tool_call_id: toolCall.id
                });
              }

              // 反思：是否已經回答了原始問題？
              if (toolCallCount < MAX_TOOL_CALLS) {
                // 發送反思事件
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'reflecting',
                    message: '評估是否已經找到足夠資訊...'
                  })}\n\n`
                ));

                // 讓 AI 反思是否需要繼續
                const reflectionPrompt = REFLECTION_PROMPT
                  .replace('{original_question}', message)
                  .replace('{collected_info}', JSON.stringify(collectedInfo, null, 2))
                  .replace('{tool_count}', toolCallCount.toString())
                  .replace('{max_tools}', MAX_TOOL_CALLS.toString());

                // 添加反思提示到訊息
                allMessages.push({
                  role: 'system',
                  content: reflectionPrompt
                });

                // 讓 AI 決定是否繼續
                const reflectionResponse = await openai.chat.completions.create({
                  model: 'gpt-3.5-turbo',
                  messages: allMessages,
                  temperature: 0.3, // 降低溫度使決策更穩定
                  response_format: { type: "json_object" }
                });

                try {
                  const decision = JSON.parse(reflectionResponse.choices[0].message.content || '{}');
                  
                  // 發送決策事件
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'decision',
                      decision: decision
                    })}\n\n`
                  ));

                  // 根據決策更新 shouldContinue
                  shouldContinue = decision.continue === true;
                  
                  if (shouldContinue) {
                    // 添加決策結果到訊息，引導下一次工具調用
                    allMessages.push({
                      role: 'assistant',
                      content: `Based on reflection: ${decision.reason}. Next action: ${decision.next_action}`
                    });
                  }
                } catch (e) {
                  console.error('Failed to parse reflection response:', e);
                  shouldContinue = false; // 解析失敗時停止
                }
              }
            } else {
              // 沒有工具呼叫，準備生成最終回應
              shouldContinue = false;
            }
          }

          // 生成最終回應
          if (!finalResponseStarted) {
            finalResponseStarted = true;
            
            // 發送回應開始
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'response_start' })}\n\n`
            ));

            // 添加最終指引，確保回答原始問題
            allMessages.push({
              role: 'system',
              content: `請基於收集到的所有資訊，回答使用者的原始問題：「${message}」。如果資訊不完整，請明確說明找到了什麼，還缺少什麼。`
            });

            // 使用串流生成最終回應
            const finalStream = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: allMessages,
              temperature: 0.7,
              stream: true,
            });

            // 串流回應內容
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
          }

          // 發送完成事件
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'done',
              totalToolCalls: toolCallCount,
              confidence: collectedInfo.length > 0 ? 80 : 50
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

// 簡單的主題識別函數
function identifyThemes(notes: any[]): string[] {
  const themes: Set<string> = new Set();
  const keywordMap: Record<string, string> = {
    '付費': '商業模式',
    '價格': '商業模式',
    '訂閱': '商業模式',
    '用戶': '使用者研究',
    '客戶': '使用者研究',
    'UI': '設計',
    'UX': '設計',
    '介面': '設計',
    'API': '技術架構',
    '資料庫': '技術架構',
    '功能': '產品規劃',
    '需求': '產品規劃',
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

// 執行工具呼叫（從原本的 stream-multi/route.ts 複製）
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

// 以下是工具實作函數（從原本的 stream-multi/route.ts 複製）
async function searchNotes(
  params: {
    keywords: string[];
    match_type?: 'any' | 'all';
    in_group?: string;
  },
  whiteboardData: WhiteboardData
) {
  let notes = whiteboardData.notes || [];
  
  if (params.in_group) {
    notes = notes.filter(note => note.groupId === params.in_group);
  }
  
  const matchedNotes = notes.filter(note => {
    const content = note.content.toLowerCase();
    const keywords = params.keywords.map(k => k.toLowerCase());
    
    if (params.match_type === 'all') {
      return keywords.every(keyword => content.includes(keyword));
    } else {
      return keywords.some(keyword => content.includes(keyword));
    }
  });
  
  const enhancedNotes = matchedNotes.map(note => {
    const edges = whiteboardData.edges || [];
    const allNotes = whiteboardData.notes || [];
    const groups = whiteboardData.groups || [];
    
    const incoming = edges
      .filter(edge => edge.to === note.id)
      .map(edge => {
        const sourceNote = allNotes.find(n => n.id === edge.from);
        return {
          noteId: edge.from,
          noteContent: sourceNote?.content.substring(0, 50) || ''
        };
      });
    
    const outgoing = edges
      .filter(edge => edge.from === note.id)
      .map(edge => {
        const targetNote = allNotes.find(n => n.id === edge.to);
        return {
          noteId: edge.to,
          noteContent: targetNote?.content.substring(0, 50) || ''
        };
      });
    
    const group = groups.find(g => 
      g.noteIds && g.noteIds.includes(note.id)
    );
    
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
    searchSummary: `找到 ${enhancedNotes.length} 個符合「${params.keywords.join('、')}」的便利貼`
  };
}

async function getNoteById(
  params: {
    note_id: string;
    include_connections?: boolean;
    include_group?: boolean;
  },
  whiteboardData: WhiteboardData
) {
  const note = (whiteboardData.notes || []).find(n => n.id === params.note_id);
  
  if (!note) {
    return {
      note: null,
      error: `找不到 ID 為 ${params.note_id} 的便利貼`
    };
  }
  
  const connections: any = { incoming: [], outgoing: [] };
  let group = undefined;
  
  if (params.include_connections !== false) {
    const edges = whiteboardData.edges || [];
    const allNotes = whiteboardData.notes || [];
    
    connections.incoming = edges
      .filter(edge => edge.to === note.id)
      .map(edge => {
        const sourceNote = allNotes.find(n => n.id === edge.from);
        return {
          noteId: edge.from,
          noteContent: sourceNote?.content.substring(0, 50) || ''
        };
      });
    
    connections.outgoing = edges
      .filter(edge => edge.from === note.id)
      .map(edge => {
        const targetNote = allNotes.find(n => n.id === edge.to);
        return {
          noteId: edge.to,
          noteContent: targetNote?.content.substring(0, 50) || ''
        };
      });
  }
  
  if (params.include_group !== false) {
    const foundGroup = (whiteboardData.groups || []).find(g => 
      g.noteIds && g.noteIds.includes(note.id)
    );
    if (foundGroup) {
      group = { id: foundGroup.id, name: foundGroup.name };
    }
  }
  
  return {
    note: {
      id: note.id,
      content: note.content,
      color: note.color,
      position: { x: note.x, y: note.y },
      connections,
      group
    }
  };
}

async function searchGroups(
  params: {
    keywords: string[];
    match_type?: 'any' | 'all';
    include_nested?: boolean;
  },
  whiteboardData: WhiteboardData
) {
  const groups = whiteboardData.groups || [];
  
  const matchedGroups = groups.filter(group => {
    const name = group.name.toLowerCase();
    const keywords = params.keywords.map(k => k.toLowerCase());
    
    if (params.match_type === 'all') {
      return keywords.every(keyword => name.includes(keyword));
    } else {
      return keywords.some(keyword => name.includes(keyword));
    }
  });
  
  const enhancedGroups = matchedGroups.map(group => {
    const notes = (whiteboardData.notes || [])
      .filter(note => group.noteIds?.includes(note.id))
      .map(note => ({
        id: note.id,
        content: note.content.substring(0, 50)
      }));
    
    const childGroups = groups
      .filter(g => g.parentGroupId === group.id)
      .map(g => ({
        id: g.id,
        name: g.name
      }));
    
    const parentGroup = groups.find(g => g.id === group.parentGroupId);
    
    const totalNotes = group.noteIds?.length || 0;
    const totalGroups = childGroups.length;
    const depth = calculateGroupDepth(group.id, groups);
    
    return {
      id: group.id,
      name: group.name,
      color: group.color,
      contains: {
        notes,
        groups: childGroups
      },
      parentGroup: parentGroup ? {
        id: parentGroup.id,
        name: parentGroup.name
      } : undefined,
      stats: {
        totalNotes,
        totalGroups,
        depth
      }
    };
  });
  
  return {
    results: enhancedGroups,
    totalMatches: enhancedGroups.length,
    groupHierarchy: buildGroupHierarchy(enhancedGroups)
  };
}

async function getGroupById(
  params: {
    group_id: string;
    include_contents?: boolean;
    include_parent?: boolean;
    max_depth?: number;
  },
  whiteboardData: WhiteboardData
) {
  const group = (whiteboardData.groups || []).find(g => g.id === params.group_id);
  
  if (!group) {
    return {
      group: null,
      error: `找不到 ID 為 ${params.group_id} 的群組`
    };
  }
  
  let contains = { notes: [], groups: [] };
  let parentGroup = undefined;
  
  if (params.include_contents !== false) {
    const notes = (whiteboardData.notes || [])
      .filter(note => group.noteIds?.includes(note.id))
      .map(note => ({
        id: note.id,
        content: note.content.substring(0, 50)
      }));
    
    const childGroups = (whiteboardData.groups || [])
      .filter(g => g.parentGroupId === group.id)
      .map(g => ({
        id: g.id,
        name: g.name
      }));
    
    contains = { notes, groups: childGroups };
  }
  
  if (params.include_parent !== false && group.parentGroupId) {
    const parent = (whiteboardData.groups || []).find(g => g.id === group.parentGroupId);
    if (parent) {
      parentGroup = { id: parent.id, name: parent.name };
    }
  }
  
  const totalNotes = group.noteIds?.length || 0;
  const totalGroups = contains.groups.length;
  const depth = calculateGroupDepth(group.id, whiteboardData.groups || []);
  
  return {
    group: {
      id: group.id,
      name: group.name,
      color: group.color,
      contains,
      parentGroup,
      stats: {
        totalNotes,
        totalGroups,
        depth
      }
    }
  };
}

async function getWhiteboardOverview(
  params: {
    include_top_groups?: boolean;
    include_recent_notes?: boolean;
  },
  whiteboardData: WhiteboardData
) {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  const edges = whiteboardData.edges || [];
  const images = whiteboardData.images || [];
  
  const stats = {
    totalNotes: notes.length,
    totalGroups: groups.length,
    totalEdges: edges.length,
    totalImages: images.length
  };
  
  let topGroups = undefined;
  let recentNotes = undefined;
  
  if (params.include_top_groups !== false) {
    topGroups = groups
      .map(g => ({
        id: g.id,
        name: g.name,
        noteCount: g.noteIds?.length || 0
      }))
      .sort((a, b) => b.noteCount - a.noteCount)
      .slice(0, 5);
  }
  
  if (params.include_recent_notes) {
    recentNotes = notes
      .slice(-5)
      .reverse()
      .map(note => {
        const group = groups.find(g => g.noteIds?.includes(note.id));
        return {
          id: note.id,
          content: note.content.substring(0, 50),
          groupName: group?.name
        };
      });
  }
  
  const summary = `白板包含 ${stats.totalNotes} 個便利貼、${stats.totalGroups} 個群組、${stats.totalEdges} 條連接線${stats.totalImages > 0 ? `和 ${stats.totalImages} 張圖片` : ''}。`;
  
  return {
    stats,
    topGroups,
    recentNotes,
    summary
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

function buildGroupHierarchy(groups: any[]): string {
  const topLevel = groups.filter(g => !g.parentGroup);
  if (topLevel.length === 0) return '無群組階層';
  
  return topLevel
    .map(g => `${g.name} (${g.stats.totalNotes} 個便利貼)`)
    .join('、');
}