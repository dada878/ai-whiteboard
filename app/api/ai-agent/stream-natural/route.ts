import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { WhiteboardData } from '@/app/types';
import { aiAgentTools } from '../tools';
import { promptService } from '@/app/services/promptService';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
});

// 最大工具呼叫次數
const MAX_TOOL_CALLS = 20;

// Token 估算和管理
// 更準確的 token 估算（考慮中文字符通常佔用更多 tokens）
function estimateTokens(text: string): number {
  // 簡單估算：英文約 4 字符 = 1 token，中文約 2 字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2 + englishChars / 4);
}

// GPT-4o 支援 128K context，我們可以大幅增加限制
function truncateMessages(messages: any[], maxTokens: number = 50000) {
  let totalTokens = 0;
  const result = [];
  
  // 保留系統訊息
  const systemMessages = messages.filter(m => m.role === 'system');
  for (const msg of systemMessages) {
    const msgTokens = estimateTokens(JSON.stringify(msg));
    if (totalTokens + msgTokens < maxTokens * 0.2) { // 系統訊息最多佔 20%
      result.push(msg);
      totalTokens += msgTokens;
    }
  }
  
  // 確保保留最後的用戶訊息
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (lastUserMessage) {
    const msgTokens = estimateTokens(JSON.stringify(lastUserMessage));
    result.push(lastUserMessage);
    totalTokens += msgTokens;
  }
  
  // 收集 tool call 和 tool response 的配對
  const toolPairs: Map<string, { call: any, response: any }> = new Map();
  
  for (const msg of messages) {
    if (msg.tool_calls) {
      // 這是一個包含 tool_calls 的 assistant 訊息
      for (const toolCall of msg.tool_calls) {
        toolPairs.set(toolCall.id, { call: msg, response: null });
      }
    } else if (msg.role === 'tool' && msg.tool_call_id) {
      // 這是一個 tool response
      const pair = toolPairs.get(msg.tool_call_id);
      if (pair) {
        pair.response = msg;
      }
    }
  }
  
  // 從後往前添加訊息，保持 tool call/response 配對
  const processedIds = new Set();
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    
    // 跳過已處理的訊息
    if (result.includes(msg) || processedIds.has(i)) continue;
    
    // 如果是 tool response，必須確保對應的 tool call 也被包含
    if (msg.role === 'tool' && msg.tool_call_id) {
      const pair = Array.from(toolPairs.values()).find(p => p.response === msg);
      if (pair && pair.call) {
        const callIndex = messages.indexOf(pair.call);
        const callTokens = estimateTokens(JSON.stringify(pair.call));
        const responseTokens = estimateTokens(JSON.stringify(msg));
        
        if (totalTokens + callTokens + responseTokens < maxTokens) {
          // 添加配對（保持順序）
          if (!result.includes(pair.call)) {
            result.push(pair.call);
            processedIds.add(callIndex);
            totalTokens += callTokens;
          }
          result.push(msg);
          processedIds.add(i);
          totalTokens += responseTokens;
        }
      }
      continue;
    }
    
    // 如果是包含 tool_calls 的訊息，檢查是否有對應的 response
    if (msg.tool_calls) {
      const responses = [];
      let pairTokens = estimateTokens(JSON.stringify(msg));
      
      for (const toolCall of msg.tool_calls) {
        const pair = toolPairs.get(toolCall.id);
        if (pair && pair.response) {
          responses.push(pair.response);
          pairTokens += estimateTokens(JSON.stringify(pair.response));
        }
      }
      
      if (totalTokens + pairTokens < maxTokens) {
        result.push(msg);
        processedIds.add(i);
        totalTokens += estimateTokens(JSON.stringify(msg));
        
        for (const response of responses) {
          const responseIndex = messages.indexOf(response);
          if (!result.includes(response)) {
            result.push(response);
            processedIds.add(responseIndex);
            totalTokens += estimateTokens(JSON.stringify(response));
          }
        }
      }
      continue;
    }
    
    // 其他類型的訊息
    const msgTokens = estimateTokens(JSON.stringify(msg));
    if (totalTokens + msgTokens < maxTokens) {
      result.push(msg);
      processedIds.add(i);
      totalTokens += msgTokens;
    } else {
      break;
    }
  }
  
  // 按原始順序排序
  return result.sort((a, b) => {
    const aIndex = messages.indexOf(a);
    const bIndex = messages.indexOf(b);
    return aIndex - bIndex;
  });
}

// 注意：所有 prompts 已移至 /prompts 資料夾的 .md 檔案
// 使用 PromptService 載入和管理
// 詳見 /prompts/INDEX.md 了解所有 prompts 的位置和用途

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
          // ============ 階段 1: 白板整體摘要 ============
          // 直接執行白板分析並發送完整結果
          const { summary: whiteboardSummary, prompts: whiteboardPrompts } = await generateComprehensiveOverview(whiteboardData);
          
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'whiteboard_summary_ready',
              summary: whiteboardSummary,
              prompts: whiteboardPrompts
            })}\n\n`
          ));

          // ============ 階段 2: 自然語言意圖分析 ============
          // 使用 Markdown prompt 系統
          const { analysis: naturalIntentAnalysis, prompt: intentPrompt } = await analyzeIntentNaturally(
            message, 
            whiteboardSummary,
            conversationHistory,
            whiteboardData
          );
          
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'intent_analysis_complete',
              analysis: naturalIntentAnalysis,
              prompt: intentPrompt
            })}\n\n`
          ));

          // ============ 階段 3: 準備系統 prompt（但不顯示計劃） ============
          // 使用 Markdown prompt
          const systemPromptWithContext = await promptService.compilePrompt('agent/main.md', {
            whiteboardSummary: whiteboardSummary,
            intentAnalysis: naturalIntentAnalysis,
            userMessage: message
          });

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

          // ============ 階段 4: 交替的思考和工具調用循環 ============
          let toolCallCount = 0;
          const allMessages = [...messages];
          let shouldContinue = true;
          const collectedInfo: any[] = [];

          while (shouldContinue && toolCallCount < MAX_TOOL_CALLS) {
            // 智能截斷訊息以避免 context 過長 (GPT-4o 可以處理更多)
            const truncatedMessages = truncateMessages(allMessages, 50000);
            
            // 呼叫 OpenAI 決定下一步行動
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o',  // 升級到 GPT-4o (128K context)
              messages: truncatedMessages,
              tools: aiAgentTools,
              tool_choice: 'auto',
              temperature: 0.7,
            });

            const responseMessage = completion.choices[0].message;

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
              allMessages.push(responseMessage);

              // 處理所有工具呼叫，確保每個 tool_call_id 都有對應的回應
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

                collectedInfo.push({
                  tool: toolCall.function.name,
                  args: JSON.parse(toolCall.function.arguments),
                  result: result
                });

                // 發送工具呼叫結果（包含 prompt 信息）
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call_result',
                    tool: toolCall.function.name,
                    result: result,
                    attempt: toolCallCount,
                    prompt: result.prompt || null // 如果工具返回了 prompt 信息
                  })}\n\n`
                ));

                // 添加工具結果到訊息歷史 - 重要：必須包含正確的 tool_call_id
                allMessages.push({
                  role: 'tool' as const,
                  content: typeof result === 'string' ? result : JSON.stringify(result),
                  tool_call_id: toolCall.id
                });
              }

              // ============ 立即進行反思（在每個工具調用後） ============
              if (toolCallCount < MAX_TOOL_CALLS) {
                // 直接執行反思並合併顯示結果
                const { reflection: naturalReflection, prompt: reflectionPrompt } = await reflectNaturally(
                  message,
                  collectedInfo,
                  toolCallCount
                );

                // 一次性發送完整的反思結果
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'reflection_complete',
                    reflection: naturalReflection,
                    prompt: reflectionPrompt
                  })}\n\n`
                ));

                // 決定是否繼續（從反思中提取）
                shouldContinue = naturalReflection.includes('需要') || 
                               naturalReflection.includes('還要') || 
                               naturalReflection.includes('繼續') ||
                               naturalReflection.includes('再找');
                
                if (shouldContinue) {
                  allMessages.push({
                    role: 'assistant',
                    content: `反思：${naturalReflection}`
                  });
                }
              } else {
                shouldContinue = false;
              }
            } else {
              // AI 沒有調用工具，但可能是因為 prompt 不夠明確
              // 如果上次的反思說需要繼續，我們應該給更明確的指示
              if (toolCallCount > 0 && collectedInfo.length > 0) {
                // 檢查最近的反思是否提到需要繼續
                const lastMessages = allMessages.slice(-3); // 檢查最後幾條訊息
                const hasRecentReflection = lastMessages.some(m => 
                  m.role === 'assistant' && 
                  typeof m.content === 'string' &&
                  m.content.includes('反思：')
                );
                
                if (hasRecentReflection) {
                  // 找到最近的反思內容
                  const recentReflection = lastMessages
                    .filter(m => m.role === 'assistant' && typeof m.content === 'string')
                    .map(m => m.content)
                    .join(' ');
                  
                  // 檢查是否需要繼續
                  const needsContinue = recentReflection.includes('需要') || 
                                      recentReflection.includes('還要') || 
                                      recentReflection.includes('繼續') ||
                                      recentReflection.includes('再找') ||
                                      recentReflection.includes('進一步') ||
                                      recentReflection.includes('探索');
                  
                  if (needsContinue) {
                    // 添加更明確的指示，強制 AI 使用工具
                    allMessages.push({
                      role: 'user' as const,
                      content: '根據你的反思，你提到需要繼續探索。請使用適當的工具（search_notes 或 get_note_by_id）繼續搜尋或探索相關資訊。'
                    });
                    shouldContinue = true; // 繼續循環
                  } else {
                    shouldContinue = false; // 反思說不需要繼續
                  }
                } else {
                  shouldContinue = false; // 沒有反思，停止
                }
              } else {
                shouldContinue = false; // 第一次就沒工具調用，停止
              }
            }
          }

          // ============ 階段 7: 生成最終回應 ============
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'response_start' })}\n\n`
          ));

          // 最終提醒
          allMessages.push({
            role: 'system',
            content: `請基於所有收集的資訊，用自然友善的語氣回答使用者的原始問題：「${message}」

如果資訊不完整，請誠實說明找到了什麼，還缺什麼。請用具體的例子和引用來支持你的答案。`
          });

          // 生成最終回應（GPT-4o 可以處理更多 context）
          const finalMessages = truncateMessages(allMessages, 50000);
          const finalStream = await openai.chat.completions.create({
            model: 'gpt-4o',  // 升級到 GPT-4o
            messages: finalMessages,
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

// ============ 輔助函數 ============

// 生成完整的白板概覽 - 直接使用 OpenAI SDK 和優化的 prompt
async function generateComprehensiveOverview(whiteboardData: WhiteboardData): Promise<{summary: string, prompts: any[]}> {
  try {
    // 限制便利貼數量以避免 context 過長
    const maxNotes = 20;
    const notes = whiteboardData.notes.slice(0, maxNotes);
    const hasMoreNotes = whiteboardData.notes.length > maxNotes;
    
    // 準備精簡的摘要數據
    const summaryData = {
      notes: notes.map(note => note.content.substring(0, 100)), // 限制每個便利貼長度
      connections: whiteboardData.edges.length,
      groups: whiteboardData.groups?.length || 0,
      images: whiteboardData.images?.length || 0,
      totalNotes: whiteboardData.notes.length
    };

    // 準備 prompt 內容（精簡版）
    const summaryPrompt = [
      {
        role: 'system',
        content: '你是一個內容摘要專家，請為白板內容生成詳細且有洞察力的摘要，限制在500字以內。'
      },
      {
        role: 'user',
        content: `請為這張白板生成簡潔摘要：

主要內容：${summaryData.notes.slice(0, 10).join('、')}${hasMoreNotes ? '...(還有更多)' : ''}
統計：${summaryData.totalNotes}個便利貼、${summaryData.connections}個連接、${summaryData.groups}個群組
請提取核心主題和關鍵概念，限制500字以內。`
      }
    ];

    // 只進行簡潔的摘要生成，不做複雜的結構分析
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o',  // 升級到 GPT-4o
      messages: summaryPrompt,
      max_tokens: 500,  // GPT-4o 可以生成更詳細的摘要
      temperature: 0.5,
    });

    const aiSummary = summaryResponse.choices[0].message.content;
    
    // 返回簡潔的摘要
    const summary = `📝 **白板摘要**: ${aiSummary}

📊 **統計**: ${summaryData.totalNotes}個便利貼、${summaryData.connections}個連接、${summaryData.groups}個群組`;

    // 返回摘要和使用的 prompts
    return {
      summary,
      prompts: [
        { type: '簡潔摘要', model: 'gpt-4o', messages: summaryPrompt }
      ]
    };
  } catch (error) {
    console.error('Failed to generate AI overview:', error);
    // 如果 AI 分析失敗，使用基礎統計作為備案
    const basicOverview = generateBasicOverview(whiteboardData);
    return {
      summary: basicOverview,
      prompts: []
    };
  }
}

// 基礎概覽作為備案
function generateBasicOverview(whiteboardData: WhiteboardData): string {
  const notes = whiteboardData.notes || [];
  const groups = whiteboardData.groups || [];
  const edges = whiteboardData.edges || [];
  const images = whiteboardData.images || [];
  
  // 統計資訊
  const stats = {
    notes: notes.length,
    groups: groups.length,
    edges: edges.length,
    images: images.length
  };
  
  // 主題識別
  const themes = identifyThemes(notes);
  
  // 主要群組
  const topGroups = groups
    .map(g => ({ name: g.name, noteCount: g.noteIds?.length || 0 }))
    .sort((a, b) => b.noteCount - a.noteCount)
    .slice(0, 5);
  
  // 重要節點 (連接最多的)
  const importantNotes = findImportantNotes(notes, edges);
  
  // 內容樣本
  const contentSamples = notes
    .slice(0, 8)
    .map(n => n.content.length > 40 ? n.content.substring(0, 40) + '...' : n.content);
  
  return `
=== 白板整體概覽 ===

📊 基本統計：
這個白板目前有 ${stats.notes} 個便利貼、${stats.groups} 個群組、${stats.edges} 條連接線${stats.images > 0 ? `和 ${stats.images} 張圖片` : ''}。

🎯 主要主題：
${themes.length > 0 ? 
  `識別到以下主題：${themes.join('、')}` : 
  '沒有識別到明確的主題分類'}

📁 主要群組：
${topGroups.length > 0 ? 
  topGroups.map(g => `• ${g.name} (${g.noteCount} 個便利貼)`).join('\n') :
  '目前沒有群組'}

💡 重要節點：
${importantNotes.length > 0 ?
  importantNotes.slice(0, 3).map(n => `• ${n.content.substring(0, 50)}`).join('\n') :
  '沒有特別重要的連接節點'}

📝 內容樣本：
${contentSamples.map(c => `• ${c}`).join('\n')}

這就是目前白板的整體情況。`;
}

// 自然語言意圖分析（整合 Markdown prompt 系統）
async function analyzeIntentNaturally(
  question: string,
  whiteboardSummary: string,
  conversationHistory: any[] = [],
  whiteboardData?: WhiteboardData
): Promise<{analysis: string, prompt: any}> {
  try {
    // 準備變數
    const conversationHistoryText = conversationHistory.length > 0 
      ? conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : null;

    // 準備白板上下文
    let whiteboardContext = whiteboardSummary;
    if (whiteboardData) {
      const statsInfo = `
- 便利貼：${whiteboardData.notes?.length || 0} 個
- 群組：${whiteboardData.groups?.length || 0} 個  
- 連接：${whiteboardData.edges?.length || 0} 條
- 圖片：${whiteboardData.images?.length || 0} 張`;

      const sampleNotes = whiteboardData.notes?.slice(0, 5)
        .map((note, idx) => `${idx + 1}. "${note.content}"`)
        .join('\n');

      const mainGroups = whiteboardData.groups?.slice(0, 5)
        .map(g => g.name).join('、');

      whiteboardContext = `${whiteboardSummary}\n\n📊 **白板統計**：${statsInfo}${
        sampleNotes ? `\n\n📝 **內容樣本**：\n${sampleNotes}` : ''
      }${
        mainGroups ? `\n\n📁 **主要群組**：${mainGroups}` : ''
      }`;
    }

    // 使用 PromptService 載入並編譯 prompt
    const compiledPrompt = await promptService.compilePrompt('agent/intent-analysis.md', {
      userQuestion: question,
      whiteboardContext: whiteboardContext,
      conversationHistory: conversationHistoryText
    });

    const intentMessages = [
      {
        role: 'system',
        content: '你是一個善於理解人類意圖的助手。請用自然的第一人稱思考方式分析使用者的問題。'
      },
      {
        role: 'user',
        content: compiledPrompt
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',  // 升級到 GPT-4o
      messages: intentMessages,
      temperature: 0.7
    });

    return {
      analysis: response.choices[0].message.content || '無法分析意圖',
      prompt: { type: '意圖分析', model: 'gpt-4o', messages: intentMessages }
    };
  } catch (error) {
    console.error('Natural intent analysis failed:', error);
    return {
      analysis: `我看到使用者問：「${question}」，但我在分析意圖時遇到了問題。讓我直接嘗試幫助他們。`,
      prompt: null
    };
  }
}

// 制定行動計劃
async function createActionPlan(
  question: string,
  intentAnalysis: string,
  whiteboardSummary: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `基於意圖分析，制定具體的行動計劃。說明你會使用什麼工具、為什麼、以什麼順序。

可用工具：
1. search_notes - 搜尋便利貼內容
2. get_note_by_id - 取得特定便利貼詳細資訊
3. search_groups - 搜尋群組
4. get_group_by_id - 取得特定群組詳細資訊
5. get_whiteboard_overview - 取得白板概覽統計`
        },
        {
          role: 'user',
          content: `原始問題：${question}

意圖分析：
${intentAnalysis}

白板摘要：
${whiteboardSummary}

請制定行動計劃：我應該使用什麼工具，按什麼順序，為什麼？`
        }
      ],
      temperature: 0.5
    });

    return response.choices[0].message.content || '制定行動計劃時發生錯誤';
  } catch (error) {
    console.error('Action planning failed:', error);
    return '我會先嘗試搜尋相關的便利貼，然後根據結果決定是否需要更多資訊。';
  }
}

// 自然語言反思
async function reflectNaturally(
  originalQuestion: string,
  collectedInfo: any[],
  toolCount: number
): Promise<{reflection: string, prompt: any}> {
  try {
    // 分析已收集的資訊，提取便利貼 ID 和連接關係
    const foundNoteIds = collectedInfo
      .filter(info => info.tool === 'search_notes' && info.result?.results)
      .flatMap(info => info.result.results.map((note: any) => note.id));
    
    const detailedNotes = collectedInfo
      .filter(info => info.tool === 'get_note_by_id' && info.result?.note)
      .map(info => info.result.note);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',  // 升級到 GPT-4o
      messages: [
        {
          role: 'system',
          content: `請用自然的第一人稱思考方式反思：我收集的資訊是否足以回答使用者的問題？特別要考慮圖探索策略。

🔗 **圖探索檢查重點**：
- 我是否找到了有連接關係的便利貼（connections.total > 0）？
- 我是否對那些便利貼的**相鄰節點**（connections 中的其他 noteId）進行了探索？
- **錯誤檢查**：我是否重複對同一個便利貼使用 get_note_by_id？應該避免！
- **正確做法**：應該對 connections.incoming 和 connections.outgoing 中的 noteId 使用 get_note_by_id
- 相鄰節點可能包含更深入或相關的資訊，是圖探索的核心價值

如果需要繼續搜尋，要同時考慮發散性搜尋和圖探索策略。`
        },
        {
          role: 'user',
          content: `原始問題：${originalQuestion}

我已經使用了 ${toolCount} 個工具，收集到以下資訊：
${JSON.stringify(collectedInfo, null, 2)}

📊 **資訊分析**：
- 找到的便利貼 ID：${foundNoteIds.length > 0 ? foundNoteIds.join(', ') : '無'}
- 已詳細探索的便利貼：${detailedNotes.length} 個
  ${detailedNotes.map(note => `  * ${note.id}: ${note.content?.substring(0, 30)}...`).join('\n  ')}
- 🔗 **圖探索狀況檢查**：
${detailedNotes.map(note => {
  // 檢查新的連接格式：connections.incoming 和 connections.outgoing 現在是物件陣列
  const incomingNodes = note.connections?.incoming || [];
  const outgoingNodes = note.connections?.outgoing || [];
  
  if (incomingNodes.length > 0 || outgoingNodes.length > 0) {
    const incomingIds = incomingNodes.map(conn => conn.noteId);
    const outgoingIds = outgoingNodes.map(conn => conn.noteId);
    const allConnectedIds = [...incomingIds, ...outgoingIds];
    
    const alreadyExplored = allConnectedIds.filter(id => detailedNotes.some(n => n.id === id));
    const notExplored = allConnectedIds.filter(id => !detailedNotes.some(n => n.id === id));
    
    // 顯示相鄰節點的內容預覽
    const notExploredWithContent = notExplored.map(id => {
      const incomingMatch = incomingNodes.find(n => n.noteId === id);
      const outgoingMatch = outgoingNodes.find(n => n.noteId === id);
      const content = incomingMatch?.noteContent || outgoingMatch?.noteContent || '未知';
      return `${id.substring(0, 8)}...(${content.substring(0, 20)}...)`;
    });
    
    return `  * ${note.id.substring(0, 8)}...(${note.content?.substring(0, 20)}...) 的相鄰節點：
    - 已探索 [${alreadyExplored.map(id => id.substring(0, 8) + '...').join(', ') || '無'}]
    - 🎯 未探索 [${notExploredWithContent.join(', ') || '無'}]`;
  }
  return `  * ${note.id.substring(0, 8)}...(${note.content?.substring(0, 20)}...): 無連接關係`;
}).join('\n')}

請思考：
1. 我找到的資訊是否能回答使用者的問題？
2. 我對這個答案有多確信？
3. **🔗 圖探索檢查**：
   - 我有沒有重複對同一個便利貼使用 get_note_by_id？（這是錯誤的）
   - 我有沒有對相鄰節點（connections 中的 noteId）使用 get_note_by_id？
   - 上面的「未探索」列表中有沒有值得探索的相鄰節點？
4. 我是否需要尋找更多資訊？
5. 如果需要搜尋，應該從哪些角度進行？（發散性思考 + 正確的圖探索）

🔍 **策略提醒**：
- 發散性搜尋：嘗試不同關鍵字、同義詞、相關概念
- **正確的圖探索**：對 connections.incoming 和 connections.outgoing 中的**其他便利貼 ID** 使用 get_note_by_id
- **避免錯誤**：不要重複對同一個便利貼使用 get_note_by_id
- 組合策略：搜尋新關鍵字的同時，探索未探索的相鄰節點

請用自然的語氣回答，就像在思考一樣。`
        }
      ],
      temperature: 0.7
    });

    const reflectionMessages = [
      {
        role: 'system',
        content: `請用自然的第一人稱思考方式反思：我收集的資訊是否足以回答使用者的問題？特別要考慮圖探索策略。

🔗 **圖探索檢查重點**：
- 我是否找到了有連接關係的便利貼（connections.total > 0）？
- 我是否對那些便利貼的**相鄰節點**（connections 中的其他 noteId）進行了探索？
- **錯誤檢查**：我是否重複對同一個便利貼使用 get_note_by_id？應該避免！
- **正確做法**：應該對 connections.incoming 和 connections.outgoing 中的 noteId 使用 get_note_by_id
- 相鄰節點可能包含更深入或相關的資訊，是圖探索的核心價值

如果需要繼續搜尋，要同時考慮發散性搜尋和圖探索策略。`
      },
      {
        role: 'user',
        content: `原始問題：${originalQuestion}

我已經使用了 ${toolCount} 個工具，收集到以下資訊：
${JSON.stringify(collectedInfo, null, 2)}

📊 **資訊分析**：
- 找到的便利貼 ID：${foundNoteIds.length > 0 ? foundNoteIds.join(', ') : '無'}
- 已詳細探索的便利貼：${detailedNotes.length} 個
  ${detailedNotes.map(note => `  * ${note.id}: ${note.content?.substring(0, 30)}...`).join('\n  ')}
- 🔗 **圖探索狀況檢查**：
${detailedNotes.map(note => {
  // 檢查新的連接格式：connections.incoming 和 connections.outgoing 現在是物件陣列
  const incomingNodes = note.connections?.incoming || [];
  const outgoingNodes = note.connections?.outgoing || [];
  
  if (incomingNodes.length > 0 || outgoingNodes.length > 0) {
    const incomingIds = incomingNodes.map(conn => conn.noteId);
    const outgoingIds = outgoingNodes.map(conn => conn.noteId);
    const allConnectedIds = [...incomingIds, ...outgoingIds];
    
    const alreadyExplored = allConnectedIds.filter(id => detailedNotes.some(n => n.id === id));
    const notExplored = allConnectedIds.filter(id => !detailedNotes.some(n => n.id === id));
    
    // 顯示相鄰節點的內容預覽
    const notExploredWithContent = notExplored.map(id => {
      const incomingMatch = incomingNodes.find(n => n.noteId === id);
      const outgoingMatch = outgoingNodes.find(n => n.noteId === id);
      const content = incomingMatch?.noteContent || outgoingMatch?.noteContent || '未知';
      return `${id.substring(0, 8)}...(${content.substring(0, 20)}...)`;
    });
    
    return `  * ${note.id.substring(0, 8)}...(${note.content?.substring(0, 20)}...) 的相鄰節點：
    - 已探索 [${alreadyExplored.map(id => id.substring(0, 8) + '...').join(', ') || '無'}]
    - 🎯 未探索 [${notExploredWithContent.join(', ') || '無'}]`;
  }
  return `  * ${note.id.substring(0, 8)}...(${note.content?.substring(0, 20)}...): 無連接關係`;
}).join('\n')}

請思考：
1. 我找到的資訊是否能回答使用者的問題？
2. 我對這個答案有多確信？
3. **🔗 圖探索檢查**：
   - 我有沒有重複對同一個便利貼使用 get_note_by_id？（這是錯誤的）
   - 我有沒有對相鄰節點（connections 中的 noteId）使用 get_note_by_id？
   - 上面的「未探索」列表中有沒有值得探索的相鄰節點？
4. 我是否需要尋找更多資訊？
5. 如果需要搜尋，應該從哪些角度進行？（發散性思考 + 正確的圖探索）

🔍 **策略提醒**：
- 發散性搜尋：嘗試不同關鍵字、同義詞、相關概念
- **正確的圖探索**：對 connections.incoming 和 connections.outgoing 中的**其他便利貼 ID** 使用 get_note_by_id
- **避免錯誤**：不要重複對同一個便利貼使用 get_note_by_id
- 組合策略：搜尋新關鍵字的同時，探索未探索的相鄰節點

請用自然的語氣回答，就像在思考一樣。`
      }
    ];

    return {
      reflection: response.choices[0].message.content || '我覺得需要更多思考',
      prompt: { type: '反思分析', model: 'gpt-4o', messages: reflectionMessages }
    };
  } catch (error) {
    console.error('Natural reflection failed:', error);
    return {
      reflection: '我覺得目前的資訊應該足夠回答問題了',
      prompt: null
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
    '目標': '使用者研究',
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
    '策略': '策略規劃',
    '計劃': '策略規劃',
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

// ============ 工具執行函數 ============

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

// [改進的工具實作函數]
async function searchNotes(params: any, whiteboardData: WhiteboardData) {
  // 記錄使用的 prompt 信息
  const toolPrompt = {
    type: '工具調用',
    tool: 'search_notes',
    model: 'internal',
    description: '搜尋便利貼功能的內部邏輯',
    parameters: {
      keywords: params.keywords,
      match_type: params.match_type || 'any',
      in_group: params.in_group || null
    }
  };
  // 參數驗證
  if (!params.keywords || !Array.isArray(params.keywords) || params.keywords.length === 0) {
    return {
      results: [],
      totalMatches: 0,
      searchSummary: '錯誤：未提供搜尋關鍵字',
      error: 'Missing or invalid keywords'
    };
  }

  let notes = whiteboardData.notes || [];
  
  // 群組過濾
  if (params.in_group) {
    const originalCount = notes.length;
    notes = notes.filter(note => note.groupId === params.in_group);
    console.log(`群組過濾：從 ${originalCount} 個便利貼篩選到 ${notes.length} 個（群組 ID: ${params.in_group}）`);
  }

  // 改進的搜尋邏輯
  const keywords = params.keywords
    .filter(k => k && typeof k === 'string' && k.trim().length > 0)
    .map(k => k.toLowerCase().trim());
  
  if (keywords.length === 0) {
    return {
      results: [],
      totalMatches: 0,
      searchSummary: '錯誤：所有關鍵字都無效',
      error: 'All keywords are invalid'
    };
  }

  console.log(`搜尋參數：關鍵字 [${keywords.join(', ')}]，匹配模式：${params.match_type || 'any'}，總便利貼數：${notes.length}`);

  // 顯示前幾個便利貼內容作為調試資訊
  console.log(`便利貼內容樣本：`);
  notes.slice(0, Math.min(5, notes.length)).forEach((note, idx) => {
    console.log(`  ${idx + 1}. "${note.content}" (ID: ${note.id.substring(0, 8)}...)`);
  });

  const matchedNotes = notes.filter((note, noteIndex) => {
    if (!note.content || typeof note.content !== 'string') {
      console.log(`便利貼 ${noteIndex + 1} 內容無效：`, note);
      return false;
    }
    
    const content = note.content.toLowerCase();
    
    // 支援多種匹配方式
    const matchResults = keywords.map((keyword, keywordIndex) => {
      // 完全匹配
      const exactMatch = content.includes(keyword);
      if (exactMatch) {
        console.log(`✓ 便利貼 "${note.content}" 與關鍵字 "${keyword}" 完全匹配`);
        return true;
      }
      
      // 去除標點符號的匹配
      const cleanContent = content.replace(/[^\w\s\u4e00-\u9fff]/g, ' ');
      const cleanKeyword = keyword.replace(/[^\w\s\u4e00-\u9fff]/g, ' ');
      const cleanMatch = cleanContent.includes(cleanKeyword);
      if (cleanMatch) {
        console.log(`✓ 便利貼 "${note.content}" 與關鍵字 "${keyword}" 清理後匹配`);
        return true;
      }
      
      // 分詞匹配（適用於中文）
      const contentWords = cleanContent.split(/\s+/).filter(w => w.length > 0);
      const keywordWords = cleanKeyword.split(/\s+/).filter(w => w.length > 0);
      
      const wordMatch = keywordWords.some(kw => 
        contentWords.some(cw => cw.includes(kw) || kw.includes(cw))
      );
      
      if (wordMatch) {
        console.log(`✓ 便利貼 "${note.content}" 與關鍵字 "${keyword}" 分詞匹配`);
        return true;
      }
      
      // 調試：顯示不匹配的情況
      if (noteIndex < 3) { // 只顯示前3個便利貼的詳細調試
        console.log(`✗ 便利貼 "${note.content}" 與關鍵字 "${keyword}" 不匹配`);
        console.log(`    原始內容: "${content}"`);
        console.log(`    清理後內容: "${cleanContent}"`);
        console.log(`    內容詞彙: [${contentWords.join(', ')}]`);
        console.log(`    關鍵字詞彙: [${keywordWords.join(', ')}]`);
      }
      
      return false;
    });

    // 根據匹配模式決定 - 強制使用 'any' 模式以支援發散性搜尋
    const finalMatch = matchResults.some(result => result); // 永遠使用 'any' 模式
    
    if (finalMatch) {
      console.log(`📍 便利貼 "${note.content}" 最終匹配成功！`);
    }
    
    return finalMatch;
  });

  // 增強的結果資訊 - 包含詳細的相鄰節點資訊
  const results = matchedNotes.map(note => {
    // 獲取連接資訊，包含相鄰節點的詳細資訊
    const edges = whiteboardData.edges || [];
    const incomingConnections = edges.filter(edge => edge.to === note.id);
    const outgoingConnections = edges.filter(edge => edge.from === note.id);

    // 獲取相鄰節點的詳細資訊
    const incomingNodesInfo = incomingConnections.map(edge => {
      const sourceNote = whiteboardData.notes.find(n => n.id === edge.from);
      return {
        noteId: edge.from,
        noteContent: sourceNote ? sourceNote.content : '未知便利貼'
      };
    });

    const outgoingNodesInfo = outgoingConnections.map(edge => {
      const targetNote = whiteboardData.notes.find(n => n.id === edge.to);
      return {
        noteId: edge.to,
        noteContent: targetNote ? targetNote.content : '未知便利貼'
      };
    });

    // 獲取群組資訊
    let groupInfo = null;
    if (note.groupId && whiteboardData.groups) {
      const group = whiteboardData.groups.find(g => g.id === note.groupId);
      if (group) {
        groupInfo = {
          id: group.id,
          name: group.name
        };
      }
    }

    return {
      id: note.id,
      content: note.content,
      color: note.color,
      connections: {
        incoming: incomingNodesInfo,
        outgoing: outgoingNodesInfo,
        total: incomingConnections.length + outgoingConnections.length
      },
      group: groupInfo,
      // 加入匹配高亮資訊（可選）
      matchedKeywords: keywords.filter(keyword => 
        note.content.toLowerCase().includes(keyword)
      )
    };
  });

  const searchSummary = generateSearchSummary(keywords, matchedNotes.length, notes.length, params);

  console.log(`搜尋結果：找到 ${matchedNotes.length} 個匹配的便利貼`);

  return {
    results: results,
    totalMatches: matchedNotes.length,
    searchSummary: searchSummary,
    searchDetails: {
      totalSearched: notes.length,
      keywords: keywords,
      matchType: params.match_type || 'any',
      filteredByGroup: !!params.in_group
    },
    prompt: toolPrompt // 添加 prompt 信息
  };
}

// 生成詳細的搜尋摘要
function generateSearchSummary(keywords: string[], matchCount: number, totalCount: number, params: any): string {
  const keywordStr = keywords.join('、');
  const matchTypeStr = '發散搜尋'; // 永遠使用發散搜尋模式
  const groupStr = params.in_group ? '（限定群組內）' : '';
  
  if (matchCount === 0) {
    return `未找到包含「${keywordStr}」任一關鍵字的便利貼${groupStr}。已搜尋 ${totalCount} 個便利貼。`;
  }
  
  const percentage = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : 0;
  return `找到 ${matchCount} 個符合的便利貼${groupStr}（${matchTypeStr}「${keywordStr}」，共搜尋 ${totalCount} 個，命中率 ${percentage}%）`;
}

async function getNoteById(params: any, whiteboardData: WhiteboardData) {
  // 記錄使用的 prompt 信息
  const toolPrompt = {
    type: '工具調用',
    tool: 'get_note_by_id', 
    model: 'internal',
    description: '根據 ID 查詢特定便利貼的詳細資訊',
    parameters: {
      note_id: params.note_id,
      include_connections: params.include_connections,
      include_group: params.include_group
    }
  };

  // 參數驗證
  if (!params.note_id || typeof params.note_id !== 'string') {
    return { 
      note: null, 
      error: '錯誤：未提供有效的便利貼 ID',
      searchSummary: '參數錯誤：需要提供便利貼 ID',
      prompt: toolPrompt
    };
  }

  console.log(`查詢便利貼 ID: ${params.note_id}`);
  
  const notes = whiteboardData.notes || [];
  const note = notes.find(n => n.id === params.note_id);
  
  if (!note) {
    // 提供可能的建議
    const similarIds = notes
      .filter(n => n.id.includes(params.note_id.slice(-4)) || params.note_id.includes(n.id.slice(-4)))
      .slice(0, 3)
      .map(n => ({ id: n.id, content: n.content.substring(0, 30) + '...' }));
    
    return { 
      note: null, 
      error: `找不到 ID 為 ${params.note_id} 的便利貼`,
      searchSummary: `便利貼不存在（總共有 ${notes.length} 個便利貼）`,
      suggestions: similarIds.length > 0 ? `相似的便利貼：${similarIds.map(s => `${s.id}(${s.content})`).join(', ')}` : '無相似便利貼',
      prompt: toolPrompt
    };
  }

  // 獲取連接資訊 - 重要：包含相鄰節點的 ID 和內容
  const edges = whiteboardData.edges || [];
  const incomingConnections = edges.filter(edge => edge.to === note.id);
  const outgoingConnections = edges.filter(edge => edge.from === note.id);

  // 獲取相鄰節點的詳細資訊
  const incomingNodesInfo = incomingConnections.map(edge => {
    const sourceNote = whiteboardData.notes.find(n => n.id === edge.from);
    return {
      noteId: edge.from,
      noteContent: sourceNote ? sourceNote.content : '未知便利貼'
    };
  });

  const outgoingNodesInfo = outgoingConnections.map(edge => {
    const targetNote = whiteboardData.notes.find(n => n.id === edge.to);
    return {
      noteId: edge.to,
      noteContent: targetNote ? targetNote.content : '未知便利貼'
    };
  });

  // 獲取群組資訊
  let groupInfo = null;
  if (note.groupId && whiteboardData.groups) {
    const group = whiteboardData.groups.find(g => g.id === note.groupId);
    if (group) {
      groupInfo = {
        id: group.id,
        name: group.name,
        description: group.description
      };
    }
  }

  console.log(`找到便利貼：${note.content.substring(0, 50)}...（${incomingConnections.length} 個入連接，${outgoingConnections.length} 個出連接）`);
  console.log(`入連接節點：${incomingNodesInfo.map(n => `${n.noteId.substring(0, 8)}...(${n.noteContent})`).join(', ')}`);
  console.log(`出連接節點：${outgoingNodesInfo.map(n => `${n.noteId.substring(0, 8)}...(${n.noteContent})`).join(', ')}`);

  return { 
    note: { 
      id: note.id, 
      content: note.content, 
      color: note.color,
      position: { x: note.x, y: note.y },
      connections: {
        incoming: incomingNodesInfo,
        outgoing: outgoingNodesInfo,
        total: incomingConnections.length + outgoingConnections.length
      },
      group: groupInfo
    },
    searchSummary: `成功找到便利貼：「${note.content.substring(0, 30)}${note.content.length > 30 ? '...' : ''}」`,
    prompt: toolPrompt
  };
}

async function searchGroups(params: any, whiteboardData: WhiteboardData) {
  // 記錄使用的 prompt 信息
  const toolPrompt = {
    type: '工具調用',
    tool: 'search_groups',
    model: 'internal',
    description: '搜尋群組名稱功能的內部邏輯',
    parameters: {
      keywords: params.keywords,
      match_type: params.match_type || 'any',
      include_nested: params.include_nested
    }
  };

  const groups = whiteboardData.groups || [];
  const matchedGroups = groups.filter(group => {
    const name = group.name.toLowerCase();
    const keywords = params.keywords.map(k => k.toLowerCase());
    // 強制使用 any 模式
    return keywords.some(keyword => name.includes(keyword));
  });
  return {
    results: matchedGroups.map(g => ({
      id: g.id,
      name: g.name,
      noteCount: g.noteIds?.length || 0
    })),
    totalMatches: matchedGroups.length,
    prompt: toolPrompt
  };
}

async function getGroupById(params: any, whiteboardData: WhiteboardData) {
  // 記錄使用的 prompt 信息
  const toolPrompt = {
    type: '工具調用',
    tool: 'get_group_by_id',
    model: 'internal',
    description: '根據 ID 查詢特定群組的詳細資訊',
    parameters: {
      group_id: params.group_id,
      include_contents: params.include_contents,
      include_parent: params.include_parent,
      max_depth: params.max_depth
    }
  };

  const group = (whiteboardData.groups || []).find(g => g.id === params.group_id);
  if (!group) {
    return { 
      group: null, 
      error: `找不到 ID 為 ${params.group_id} 的群組`,
      prompt: toolPrompt
    };
  }
  return { 
    group: { 
      id: group.id, 
      name: group.name, 
      noteCount: group.noteIds?.length || 0 
    },
    prompt: toolPrompt
  };
}

async function getWhiteboardOverview(params: any, whiteboardData: WhiteboardData) {
  // 記錄使用的 prompt 信息
  const toolPrompt = {
    type: '工具調用',
    tool: 'get_whiteboard_overview',
    model: 'internal',
    description: '取得整個白板的概覽資訊，包含總體統計、主要群組、最近更新等',
    parameters: {
      include_top_groups: params.include_top_groups,
      include_recent_notes: params.include_recent_notes
    }
  };

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
    },
    prompt: toolPrompt
  };
}