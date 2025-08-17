import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { WhiteboardData } from '@/app/types';
import { aiAgentTools } from './tools';
import type { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
});

// 系統提示詞
const SYSTEM_PROMPT = `你是一個智能白板助手。你可以幫助使用者查詢和分析白板上的內容。

重要指引：

1. **先理解意圖，再使用工具**：
   - 思考使用者的真正問題是什麼
   - 判斷是否需要查詢白板內容
   - 如果是一般性問題，直接回答即可
   - 只有關於白板內容的問題才使用工具

2. **智慧搜尋**：
   - 根據上下文理解使用者的意思
   - 例如：當使用者問「TA是誰」，他可能想問的是「目標客戶」或「Target Audience」
   - 使用相關的同義詞和變體進行搜尋
   - 避免只搜尋字面上的關鍵字

3. **回答方式**：
   - 根據白板內容給出具體答案
   - 如果找不到相關內容，誠實告知
   - 提供有用的建議和分析

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
      return NextResponse.json(
        { error: 'Whiteboard data is required' },
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

    console.log('Calling OpenAI with tools:', aiAgentTools.length);

    // 調用 OpenAI API with Function Calling
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // 使用 3.5 以降低成本
      messages: messages,
      tools: aiAgentTools,
      tool_choice: 'auto', // 讓 AI 自動決定是否使用工具
      temperature: 0.7,
    });

    const responseMessage = completion.choices[0].message;
    console.log('OpenAI response:', responseMessage);

    // 處理工具呼叫
    if (responseMessage.tool_calls) {
      console.log('Processing tool calls:', responseMessage.tool_calls.length);
      
      const toolResults = await handleToolCalls(
        responseMessage.tool_calls,
        whiteboardData
      );

      // 構建工具訊息
      const toolMessages: ChatCompletionToolMessageParam[] = toolResults.map(result => ({
        role: 'tool' as const,
        content: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
        tool_call_id: result.tool_call_id
      }));

      // 將工具結果回傳給 AI 生成最終回應
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          ...messages,
          responseMessage,
          ...toolMessages
        ],
        temperature: 0.7,
      });

      return NextResponse.json({
        reply: finalCompletion.choices[0].message.content,
        toolCalls: toolResults.map(r => ({
          tool: r.tool_name,
          result: r.data
        }))
      });
    }

    // 沒有工具呼叫，直接返回回應
    return NextResponse.json({
      reply: responseMessage.content
    });

  } catch (error) {
    console.error('AI Agent error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}

// 處理工具呼叫
async function handleToolCalls(
  toolCalls: any[],
  whiteboardData: WhiteboardData
) {
  const results = [];

  for (const toolCall of toolCalls) {
    const args = JSON.parse(toolCall.function.arguments);
    let result;

    console.log(`Executing tool: ${toolCall.function.name}`, args);

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
      case 'get_whiteboard_overview':
        result = await getWhiteboardOverview(args, whiteboardData);
        break;
      default:
        result = { error: `Unknown tool: ${toolCall.function.name}` };
    }

    results.push({
      tool_call_id: toolCall.id,
      tool_name: toolCall.function.name,
      data: result
    });
  }

  return results;
}

// 搜尋便利貼
async function searchNotes(
  params: {
    keywords: string[];
    match_type?: 'any' | 'all';
    in_group?: string;
  },
  whiteboardData: WhiteboardData
) {
  let notes = whiteboardData.notes || [];
  
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
  
  // 增強資料
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

// 根據 ID 取得便利貼
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

// 搜尋群組
async function searchGroups(
  params: {
    keywords: string[];
    match_type?: 'any' | 'all';
    include_nested?: boolean;
  },
  whiteboardData: WhiteboardData
) {
  const groups = whiteboardData.groups || [];
  
  // 關鍵字搜尋
  const matchedGroups = groups.filter(group => {
    const name = group.name.toLowerCase();
    const keywords = params.keywords.map(k => k.toLowerCase());
    
    if (params.match_type === 'all') {
      return keywords.every(keyword => name.includes(keyword));
    } else {
      return keywords.some(keyword => name.includes(keyword));
    }
  });
  
  // 增強資料
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
    
    // 計算統計
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

// 根據 ID 取得群組
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

// 取得白板概覽
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

// 輔助函數：計算群組深度
function calculateGroupDepth(groupId: string, groups: any[]): number {
  let depth = 0;
  let currentGroup = groups.find(g => g.id === groupId);
  
  while (currentGroup?.parentGroupId) {
    depth++;
    currentGroup = groups.find(g => g.id === currentGroup.parentGroupId);
    if (depth > 10) break; // 防止無限循環
  }
  
  return depth;
}

// 輔助函數：建立群組階層文字
function buildGroupHierarchy(groups: any[]): string {
  const topLevel = groups.filter(g => !g.parentGroup);
  if (topLevel.length === 0) return '無群組階層';
  
  return topLevel
    .map(g => `${g.name} (${g.stats.totalNotes} 個便利貼)`)
    .join('、');
}