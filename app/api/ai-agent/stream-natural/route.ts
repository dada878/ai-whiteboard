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
    
    // 診斷接收到的白板資料
    console.log('=== 接收到的白板資料 ===');
    console.log(`便利貼數量: ${whiteboardData.notes?.length || 0}`);
    console.log(`連接數量: ${whiteboardData.edges?.length || 0}`);
    console.log(`群組數量: ${whiteboardData.groups?.length || 0}`);
    if (whiteboardData.notes?.length > 0) {
      console.log(`第一個便利貼: ${whiteboardData.notes[0].content.substring(0, 100)}`);
    }
    console.log('========================');

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
          const systemPromptWithContext = await promptService.compilePrompt('agent/stream-natural.md', {
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
                    prompt: (result as any).prompt || null // 如果工具返回了 prompt 信息
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
                // 達到最大工具調用次數
                shouldContinue = false;
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'stop_reason',
                    reason: 'max_tools_reached',
                    description: `已達到最大工具調用次數限制 (${MAX_TOOL_CALLS} 次)`,
                    toolCallCount
                  })}\n\n`
                ));
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
                    // 反思說不需要繼續
                    shouldContinue = false;
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'stop_reason',
                        reason: 'sufficient_information',
                        description: '根據反思判斷已收集足夠資訊',
                        toolCallCount
                      })}\n\n`
                    ));
                  }
                } else {
                  // 沒有反思，停止
                  shouldContinue = false;
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'stop_reason',
                      reason: 'no_reflection',
                      description: 'AI 決定不需要進一步探索',
                      toolCallCount
                    })}\n\n`
                  ));
                }
              } else {
                // 第一次就沒工具調用，停止
                shouldContinue = false;
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'stop_reason',
                    reason: 'no_tools_needed',
                    description: toolCallCount === 0 
                      ? 'AI 判斷不需要使用工具即可回答'
                      : 'AI 判斷已有足夠資訊回答問題',
                    toolCallCount
                  })}\n\n`
                ));
              }
            }
          }

          // ============ 階段 7: 生成最終回應 ============
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'response_start' })}\n\n`
          ));

          // 使用 promptService 載入最終回應 prompt
          const finalResponsePrompt = await promptService.compilePrompt('agent/final-response.md', {
            originalQuestion: message
          });
          
          // 最終提醒
          allMessages.push({
            role: 'system',
            content: finalResponsePrompt
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
    const maxNotes = 30;  // 增加到 30 個
    const notes = whiteboardData.notes.slice(0, maxNotes);
    const hasMoreNotes = whiteboardData.notes.length > maxNotes;
    
    // 準備精簡的摘要數據
    const summaryData = {
      notes: notes.map(note => note.content), // 使用完整內容
      connections: whiteboardData.edges?.length || 0,
      groups: whiteboardData.groups?.length || 0,
      images: whiteboardData.images?.length || 0,
      totalNotes: whiteboardData.notes?.length || 0
    };
    
    // 獲取群組名稱
    const groupNames = whiteboardData.groups?.slice(0, 10).map(g => g.name).join('、') || '無';

    // 診斷資料
    console.log('=== 白板摘要資料診斷 ===');
    console.log(`總便利貼數: ${whiteboardData.notes.length}`);
    console.log(`實際處理的便利貼數: ${notes.length}`);
    console.log(`前 5 個便利貼內容:`, notes.slice(0, 5).map(n => n.content.substring(0, 50)));
    console.log(`群組資訊:`, whiteboardData.groups?.slice(0, 5).map(g => ({ id: g.id, name: g.name })));

    // 準備主要內容 - 選擇最重要的便利貼
    const mainNotes = summaryData.notes.slice(0, 20);
    const mainContent = mainNotes.map((content, idx) => 
      `${idx + 1}. ${content.length > 150 ? content.substring(0, 150) + '...' : content}`
    ).join('\n');
    
    // 使用 promptService 載入白板摘要 prompt
    const summaryPromptContent = await promptService.compilePrompt('agent/whiteboard-summary.md', {
      mainContent: mainContent,
      hasMore: hasMoreNotes ? '\n...還有更多內容' : '',
      totalNotes: summaryData.totalNotes.toString(),
      connections: summaryData.connections.toString(),
      groups: summaryData.groups.toString(),
      groupNames: groupNames
    });
    
    console.log('傳遞給 AI 的主要內容長度:', mainContent.length);
    console.log('群組名稱:', groupNames);
    console.log('======================');
    
    const summaryPrompt = [
      {
        role: 'system',
        content: '你是一個內容摘要專家。'
      },
      {
        role: 'user',
        content: summaryPromptContent
      }
    ];

    // 只進行簡潔的摘要生成，不做複雜的結構分析
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o',  // 升級到 GPT-4o
      messages: summaryPrompt as any,
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
      messages: intentMessages as any,
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
    // 使用 promptService 載入行動計劃 prompt
    const actionPlanPrompt = await promptService.compilePrompt('agent/action-plan.md', {
      question,
      intentAnalysis,
      whiteboardSummary
    });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一個善於制定行動計劃的助手。'
        },
        {
          role: 'user',
          content: actionPlanPrompt
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
    
    // 準備詳細便利貼資訊
    const detailedNotesInfo = detailedNotes
      .map(note => `  * ${note.id}: ${note.content?.substring(0, 30)}...`)
      .join('\n  ');
    
    // 準備圖探索狀況
    const graphExplorationStatus = detailedNotes.map(note => {
      // 檢查新的連接格式：connections.incoming 和 connections.outgoing 現在是物件陣列
      const incomingNodes = note.connections?.incoming || [];
      const outgoingNodes = note.connections?.outgoing || [];
      
      if (incomingNodes.length > 0 || outgoingNodes.length > 0) {
        const incomingIds = incomingNodes.map((conn: any) => conn.noteId);
        const outgoingIds = outgoingNodes.map((conn: any) => conn.noteId);
        const allConnectedIds = [...incomingIds, ...outgoingIds];
        
        const alreadyExplored = allConnectedIds.filter(id => detailedNotes.some(n => n.id === id));
        const notExplored = allConnectedIds.filter(id => !detailedNotes.some(n => n.id === id));
        
        // 顯示相鄰節點的內容預覽
        const notExploredWithContent = notExplored.map(id => {
          const incomingMatch = incomingNodes.find((n: any) => n.noteId === id);
          const outgoingMatch = outgoingNodes.find((n: any) => n.noteId === id);
          const content = incomingMatch?.noteContent || outgoingMatch?.noteContent || '未知';
          return `${id.substring(0, 8)}...(${content.substring(0, 20)}...)`;
        });
        
        return `  * ${note.id.substring(0, 8)}...(${note.content?.substring(0, 20)}...) 的相鄰節點：
    - 已探索 [${alreadyExplored.map(id => id.substring(0, 8) + '...').join(', ') || '無'}]
    - 🎯 未探索 [${notExploredWithContent.join(', ') || '無'}]`;
      }
      return `  * ${note.id.substring(0, 8)}...(${note.content?.substring(0, 20)}...): 無連接關係`;
    }).join('\n');
    
    // 使用 promptService 載入反思 prompt
    const reflectionPrompt = await promptService.compilePrompt('agent/natural-reflection.md', {
      originalQuestion,
      toolCount: toolCount.toString(),
      collectedInfo: JSON.stringify(collectedInfo, null, 2),  // 傳遞完整的收集資訊
      foundNoteIds: foundNoteIds.join(', ') || '無',
      detailedNotes: detailedNotes.length.toString(),
      detailedNotesInfo,
      graphExplorationStatus
    });

    const reflectionMessages = [
      {
        role: 'system',
        content: '你是一個智能白板助手，正在反思你收集的資訊是否足夠。'
      },
      {
        role: 'user',
        content: reflectionPrompt
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: reflectionMessages as any,
      temperature: 0.7
    });

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
    // 新的創建工具
    case 'create_connected_note':
      return await createConnectedNote(args, whiteboardData);
    case 'create_edge':
      return await createEdge(args, whiteboardData);
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
    .filter((k: any) => k && typeof k === 'string' && k.trim().length > 0)
    .map((k: any) => k.toLowerCase().trim());
  
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
    const matchResults = keywords.map((keyword: any, keywordIndex: number) => {
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
      const contentWords = cleanContent.split(/\s+/).filter((w: any) => w.length > 0);
      const keywordWords = cleanKeyword.split(/\s+/).filter((w: any) => w.length > 0);
      
      const wordMatch = keywordWords.some((kw: any) => 
        contentWords.some((cw: any) => cw.includes(kw) || kw.includes(cw))
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
    const finalMatch = matchResults.some((result: any) => result); // 永遠使用 'any' 模式
    
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
      matchedKeywords: keywords.filter((keyword: any) => 
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
        description: (group as any).description
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
    const keywords = params.keywords.map((k: any) => k.toLowerCase());
    // 強制使用 any 模式
    return keywords.some((keyword: any) => name.includes(keyword));
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

// ============ 新的創建工具函數 ============

// 🌟 主要創建功能：從現有節點延伸創建便利貼
async function createConnectedNote(params: any, whiteboardData: WhiteboardData) {
  try {
    // 驗證參數
    if (!params.source_note_id || !params.content) {
      return { success: false, error: '必須提供來源便利貼ID和內容' };
    }

    if (params.content.length > 500) {
      return { success: false, error: '便利貼內容不能超過500字元' };
    }

    // 查找來源便利貼
    const sourceNote = (whiteboardData.notes || []).find(n => n.id === params.source_note_id);
    if (!sourceNote) {
      return { success: false, error: `找不到ID為 ${params.source_note_id} 的來源便利貼` };
    }

    // 智能位置計算
    const position = calculateOptimalPosition(
      sourceNote,
      whiteboardData,
      params.direction || 'auto',
      params.distance || 250
    );

    // 智能顏色選擇
    const color = selectColorByRelationship(
      params.color || 'auto',
      params.relationship || 'leads_to',
      sourceNote.color
    );

    // 生成新便利貼ID
    const newNoteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 創建新便利貼
    const newNote = {
      id: newNoteId,
      x: position.x,
      y: position.y,
      width: 200,
      height: 150,
      content: params.content,
      color: color,
      groupId: sourceNote.groupId
    };

    // 添加到白板數據
    if (!whiteboardData.notes) {
      whiteboardData.notes = [];
    }
    whiteboardData.notes.push(newNote);

    // 自動建立連接
    const connectionDirection = determineConnectionDirection(params.relationship);
    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newEdge = {
      id: edgeId,
      from: connectionDirection === 'forward' ? params.source_note_id : newNoteId,
      to: connectionDirection === 'forward' ? newNoteId : params.source_note_id
    };

    if (!whiteboardData.edges) {
      whiteboardData.edges = [];
    }
    whiteboardData.edges.push(newEdge);

    return {
      success: true,
      newNote: {
        id: newNote.id,
        content: newNote.content,
        x: newNote.x,
        y: newNote.y,
        color: newNote.color,
        groupId: newNote.groupId
      },
      connection: {
        id: newEdge.id,
        from: newEdge.from,
        to: newEdge.to,
        relationship: params.relationship || 'leads_to'
      },
      sourceNote: {
        id: sourceNote.id,
        content: sourceNote.content.substring(0, 50)
      },
      positioning: {
        direction: (position as any).chosenDirection || 'auto',
        distance: params.distance || 250,
        calculatedPosition: { x: position.x, y: position.y }
      },
    };

  } catch (error) {
    return { success: false, error: `創建相關便利貼時發生錯誤: ${error}` };
  }
}

async function createNote(params: any, whiteboardData: WhiteboardData) {
  try {
    if (!params.content || typeof params.content !== 'string') {
      return { success: false, error: '便利貼內容不能為空' };
    }

    if (params.content.length > 500) {
      return { success: false, error: '便利貼內容不能超過500字元' };
    }

    const newNoteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (params.group_id) {
      const groupExists = (whiteboardData.groups || []).find(g => g.id === params.group_id);
      if (!groupExists) {
        return { success: false, error: `找不到ID為 ${params.group_id} 的群組` };
      }
    }

    // 計算智能位置：如果沒有指定座標，找一個合適的位置
    let finalX = params.x;
    let finalY = params.y;
    
    if (finalX === undefined || finalY === undefined) {
      const smartPosition = findAvailablePositionNatural(whiteboardData);
      finalX = finalX || smartPosition.x;
      finalY = finalY || smartPosition.y;
    }

    const newNote = {
      id: newNoteId,
      x: finalX,
      y: finalY,
      width: 200,
      height: 150,
      content: params.content,
      color: params.color || 'yellow',
      groupId: params.group_id || undefined
    };

    if (!whiteboardData.notes) {
      whiteboardData.notes = [];
    }
    whiteboardData.notes.push(newNote);

    if (params.group_id) {
      const group = whiteboardData.groups?.find(g => g.id === params.group_id);
      if (group) {
        if (!group.noteIds) {
          group.noteIds = [];
        }
        group.noteIds.push(newNoteId);
      }
    }

    return {
      success: true,
      note: {
        id: newNote.id,
        content: newNote.content,
        x: newNote.x,
        y: newNote.y,
        color: newNote.color,
        groupId: newNote.groupId
      },
    };

  } catch (error) {
    return { success: false, error: `創建便利貼時發生錯誤: ${error}` };
  }
}

async function createEdge(params: any, whiteboardData: WhiteboardData) {
  try {
    if (!params.from_note_id || !params.to_note_id) {
      return { success: false, error: '必須提供起始和目標便利貼ID' };
    }

    if (params.from_note_id === params.to_note_id) {
      return { success: false, error: '無法創建自己指向自己的連結' };
    }

    const fromNote = (whiteboardData.notes || []).find(n => n.id === params.from_note_id);
    const toNote = (whiteboardData.notes || []).find(n => n.id === params.to_note_id);

    if (!fromNote) {
      return { success: false, error: `找不到ID為 ${params.from_note_id} 的起始便利貼` };
    }

    if (!toNote) {
      return { success: false, error: `找不到ID為 ${params.to_note_id} 的目標便利貼` };
    }

    const existingEdge = (whiteboardData.edges || []).find(
      e => e.from === params.from_note_id && e.to === params.to_note_id
    );

    if (existingEdge) {
      return { success: false, error: '這兩個便利貼之間已經存在連結' };
    }

    const newEdgeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newEdge = {
      id: newEdgeId,
      from: params.from_note_id,
      to: params.to_note_id
    };

    if (!whiteboardData.edges) {
      whiteboardData.edges = [];
    }
    whiteboardData.edges.push(newEdge);

    return {
      success: true,
      edge: {
        id: newEdge.id,
        from: newEdge.from,
        to: newEdge.to,
        fromNoteContent: fromNote.content.substring(0, 50),
        toNoteContent: toNote.content.substring(0, 50)
      },
    };

  } catch (error) {
    return { success: false, error: `創建連結時發生錯誤: ${error}` };
  }
}

// 輔助函數
function calculateOptimalPosition(sourceNote: any, whiteboardData: WhiteboardData, direction: string, distance: number) {
  const baseX = sourceNote.x;
  const baseY = sourceNote.y;
  const noteWidth = sourceNote.width || 200;
  const noteHeight = sourceNote.height || 150;

  if (direction !== 'auto') {
    return calculateDirectionalPosition(baseX, baseY, noteWidth, noteHeight, direction, distance);
  }

  const candidates = [
    { dir: 'right', pos: calculateDirectionalPosition(baseX, baseY, noteWidth, noteHeight, 'right', distance) },
    { dir: 'down', pos: calculateDirectionalPosition(baseX, baseY, noteWidth, noteHeight, 'down', distance) },
    { dir: 'left', pos: calculateDirectionalPosition(baseX, baseY, noteWidth, noteHeight, 'left', distance) },
    { dir: 'up', pos: calculateDirectionalPosition(baseX, baseY, noteWidth, noteHeight, 'up', distance) }
  ];

  const existingNotes = whiteboardData.notes || [];
  
  for (const candidate of candidates) {
    const hasOverlap = existingNotes.some(note => 
      note.id !== sourceNote.id && 
      isOverlapping(candidate.pos, { x: note.x, y: note.y, width: note.width || 200, height: note.height || 150 })
    );
    
    if (!hasOverlap) {
      return { ...candidate.pos, chosenDirection: candidate.dir };
    }
  }

  const rightPos = candidates[0].pos;
  return { 
    x: rightPos.x + 50, 
    y: rightPos.y, 
    chosenDirection: 'right_adjusted' 
  };
}

function calculateDirectionalPosition(baseX: number, baseY: number, noteWidth: number, noteHeight: number, direction: string, distance: number) {
  switch (direction) {
    case 'right':
      return { x: baseX + noteWidth + distance, y: baseY };
    case 'left':
      return { x: baseX - distance - 200, y: baseY };
    case 'down':
      return { x: baseX, y: baseY + noteHeight + distance };
    case 'up':
      return { x: baseX, y: baseY - distance - 150 };
    default:
      return { x: baseX + noteWidth + distance, y: baseY };
  }
}

function isOverlapping(rect1: any, rect2: any) {
  const margin = 20;
  return !(
    rect1.x + 200 + margin < rect2.x ||
    rect2.x + (rect2.width || 200) + margin < rect1.x ||
    rect1.y + 150 + margin < rect2.y ||
    rect2.y + (rect2.height || 150) + margin < rect1.y
  );
}

function selectColorByRelationship(colorParam: string, relationship: string, sourceColor: string) {
  if (colorParam !== 'auto') {
    return colorParam;
  }

  switch (relationship) {
    case 'leads_to':
      return sourceColor === 'blue' ? 'green' : 'blue';
    case 'derives_from':
      return sourceColor === 'yellow' ? 'orange' : 'yellow';
    case 'relates_to':
      return sourceColor === 'pink' ? 'purple' : 'pink';
    default:
      return 'yellow';
  }
}

function determineConnectionDirection(relationship: string) {
  switch (relationship) {
    case 'leads_to':
      return 'forward';
    case 'derives_from':
      return 'backward';
    case 'relates_to':
      return 'forward';
    default:
      return 'forward';
  }
}

// 找到可用的位置（避免重疊）
function findAvailablePositionNatural(whiteboardData: WhiteboardData): { x: number; y: number } {
  const notes = whiteboardData.notes || [];
  const NOTE_WIDTH = 200;
  const NOTE_HEIGHT = 120;
  const MARGIN = 20;
  
  // 如果沒有任何便利貼，返回中心附近的位置
  if (notes.length === 0) {
    return { x: 300, y: 300 };
  }
  
  // 找到現有便利貼的邊界
  const bounds = {
    minX: Math.min(...notes.map(n => n.x)),
    maxX: Math.max(...notes.map(n => n.x + NOTE_WIDTH)),
    minY: Math.min(...notes.map(n => n.y)),
    maxY: Math.max(...notes.map(n => n.y + NOTE_HEIGHT))
  };
  
  // 嘗試在右側找位置
  const rightX = bounds.maxX + MARGIN;
  const centerY = (bounds.minY + bounds.maxY) / 2 - NOTE_HEIGHT / 2;
  
  if (!hasCollisionNatural(rightX, centerY, notes, NOTE_WIDTH, NOTE_HEIGHT)) {
    return { x: rightX, y: centerY };
  }
  
  // 嘗試在下方找位置
  const centerX = (bounds.minX + bounds.maxX) / 2 - NOTE_WIDTH / 2;
  const bottomY = bounds.maxY + MARGIN;
  
  if (!hasCollisionNatural(centerX, bottomY, notes, NOTE_WIDTH, NOTE_HEIGHT)) {
    return { x: centerX, y: bottomY };
  }
  
  // 如果右側和下方都有衝突，就用網格搜索找空位
  return findGridPositionNatural(bounds, notes, NOTE_WIDTH, NOTE_HEIGHT, MARGIN);
}

// 檢查是否有碰撞
function hasCollisionNatural(
  x: number, 
  y: number, 
  notes: any[], 
  width: number, 
  height: number
): boolean {
  const BUFFER = 10;
  
  return notes.some(note => {
    const noteWidth = 200;
    const noteHeight = 120;
    
    return !(
      x + width + BUFFER < note.x ||
      x > note.x + noteWidth + BUFFER ||
      y + height + BUFFER < note.y ||
      y > note.y + noteHeight + BUFFER
    );
  });
}

// 網格搜索找空位
function findGridPositionNatural(
  bounds: any, 
  notes: any[], 
  noteWidth: number, 
  noteHeight: number, 
  margin: number
): { x: number; y: number } {
  const GRID_SIZE = 250;
  const startX = Math.max(0, bounds.minX - GRID_SIZE);
  const startY = Math.max(0, bounds.minY - GRID_SIZE);
  const endX = bounds.maxX + GRID_SIZE;
  const endY = bounds.maxY + GRID_SIZE;
  
  for (let y = startY; y <= endY; y += GRID_SIZE) {
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      if (!hasCollisionNatural(x, y, notes, noteWidth, noteHeight)) {
        return { x, y };
      }
    }
  }
  
  // 如果都找不到，就隨機找個位置
  return {
    x: bounds.maxX + margin + Math.random() * 200,
    y: bounds.minY + Math.random() * 200
  };
}