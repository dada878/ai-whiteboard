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

// 系統提示詞
const SYSTEM_PROMPT = `你是一個智能白板助手。你可以幫助使用者查詢和分析白板上的內容。

重要指引：

1. **先理解意圖，再使用工具**：
   - 思考使用者的真正問題是什麼
   - 判斷是否需要查詢白板內容
   - 如果是一般性問題，直接回答即可
   - 只有關於白板內容的問題才使用工具

2. **智慧搜尋與反思策略**：
   - 如果第一次搜尋沒有找到結果，請反思並嘗試其他策略
   - 例如：使用同義詞、相關詞、變體詞彙
   - 如果用戶問「付費方案」找不到，可以試試「付費方式」「價格」「費用」「訂閱」等
   - 如果用戶問「TA」找不到，可以試試「目標客戶」「目標受眾」「客群」「target audience」等
   - 不要輕易放棄，至少嘗試 2-3 種不同的搜尋策略

3. **連續工具使用**：
   - 可以根據前一個工具的結果決定是否需要使用下一個工具
   - 例如：先搜尋便利貼，如果找到相關內容，可以再查詢詳細資訊
   - 例如：先搜尋群組，再查詢群組內的具體內容

4. **回答方式**：
   - 根據白板內容給出具體答案
   - 如果經過多次嘗試仍找不到，誠實告知並提供建議
   - 提供有用的分析和洞察

你可以：
1. 搜尋便利貼和群組
2. 查詢特定元素的詳細資訊
3. 分析便利貼之間的關係
4. 提供白板內容的摘要和洞察

回答時請：
- 使用繁體中文
- 保持友善和專業
- 提供具體和有用的資訊`;

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
        .map((g: any) => `「${g.name}」(${g.noteIds?.length || 0} 個便利貼)`)
        .join('、');
      
      // 獲取一些關鍵便利貼內容（前10個）
      const sampleNotes = notes
        .slice(0, 10)
        .map((n: any) => {
          const content = n.content.length > 30 ? 
            n.content.substring(0, 30) + '...' : 
            n.content;
          return content;
        });
      
      return `
白板內容摘要：

基本統計：
- 便利貼數量：${notes.length}
- 群組數量：${groups.length}
- 連接線數量：${edges.length}
- 圖片數量：${images.length}

${groups.length > 0 ? `主要群組：
${topGroups}
` : ''}${sampleNotes.length > 0 ? `
部分便利貼內容：
${sampleNotes.map((s: any) => `- ${s}`).join('\n')}
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
                
                // Type guard for tool calls with function property
                if (!('function' in toolCall)) continue;
                
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

              // 如果還沒達到上限，讓 AI 決定是否需要繼續
              if (toolCallCount < MAX_TOOL_CALLS) {
                // 發送思考事件
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'thinking',
                    message: '評估結果並決定下一步...'
                  })}\n\n`
                ));
                
                // 繼續循環，讓 AI 決定是否要呼叫更多工具
                continue;
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
              totalToolCalls: toolCallCount 
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

// 執行工具呼叫（從原本的 stream/route.ts 複製）
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

// 以下是工具實作函數（從原本的 stream/route.ts 複製）
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
  
  let contains: any = { notes: [], groups: [] };
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