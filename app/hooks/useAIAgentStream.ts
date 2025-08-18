import { useState, useCallback, useRef, useEffect } from 'react';
import { WhiteboardData } from '@/app/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'process';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  processInfo?: ProcessInfo;
}

export interface ProcessInfo {
  type: 'whiteboard_summary_ready' | 'intent_analysis_complete' | 'planning_actions' | 'action_plan_ready' | 'reflection_complete' | 'analyzing_intent' | 'intent_analyzed' | 'generating_context' | 'context_ready' | 'reflecting' | 'decision' | 'thinking' | 'tool_call_start' | 'tool_call_result' | 'tool_call_combined' | 'stop_reason';
  data?: any;
  title?: string;
  description?: string;
}

export interface ToolCall {
  tool: string;
  args?: any;
  result?: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  attempt?: number;
  maxAttempts?: number;
}

interface UseAIAgentStreamOptions {
  onError?: (error: string) => void;
  maxHistoryLength?: number;
  persistKey?: string; // 用於 localStorage 的 key
}

const STORAGE_PREFIX = 'ai_chat_stream_';
const MAX_STORAGE_MESSAGES = 200; // 增加儲存上限以容納 process/tool 訊息

// 簡單的 token 估算函數（粗略估算：1 token ≈ 4 字符）
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// 智能對話歷史準備函數
function prepareConversationHistory(messages: ChatMessage[], maxMessages: number = 5) {
  // 過濾有效的訊息（排除 tool 和 process 角色）
  const validMessages = messages
    .filter(msg => msg.role !== 'tool' && msg.role !== 'process')
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }));

  // 從最新訊息開始，限制總 token 數
  const maxTokens = 8000; // 保留空間給系統 prompt 和白板數據
  let totalTokens = 0;
  const result = [];
  
  // 從最後往前取訊息，直到達到 token 限制或訊息數限制
  for (let i = validMessages.length - 1; i >= 0 && result.length < maxMessages; i--) {
    const msg = validMessages[i];
    const msgTokens = estimateTokens(msg.content);
    
    if (totalTokens + msgTokens > maxTokens) {
      break; // 超出 token 限制，停止添加更多訊息
    }
    
    result.unshift(msg); // 添加到開頭
    totalTokens += msgTokens;
  }
  
  return result;
}

export function useAIAgentStream(
  whiteboardData: WhiteboardData,
  options: UseAIAgentStreamOptions = {}
) {
  const storageKey = options.persistKey || `${STORAGE_PREFIX}default`;
  
  // 從 localStorage 載入對話記錄
  const loadMessages = useCallback(() => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 轉換 timestamp 字串回 Date 物件，保留所有訊息類型
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          isStreaming: false, // 確保載入的訊息不是串流狀態
          // 確保 toolCalls 陣列正確還原
          toolCalls: msg.toolCalls || [],
          // 確保 processInfo 正確還原
          processInfo: msg.processInfo || undefined
        }));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
    return [];
  }, [storageKey]);
  
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 追蹤正在進行的工具調用，用於合併顯示
  const activeToolCallsRef = useRef<Map<string, string>>(new Map());
  
  // 儲存對話記錄到 localStorage
  const saveMessages = useCallback((msgs: ChatMessage[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      // 保存所有訊息類型，包含 process 和 tool 訊息
      const toSave = msgs.slice(-MAX_STORAGE_MESSAGES);
      // 清理某些不需要持久化的暫時性屬性
      const cleanedMessages = toSave.map(msg => ({
        ...msg,
        isStreaming: false // 不儲存串流狀態
      }));
      localStorage.setItem(storageKey, JSON.stringify(cleanedMessages));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }, [storageKey]);
  
  // 當 messages 改變時自動儲存
  useEffect(() => {
    saveMessages(messages);
  }, [messages, saveMessages]);

  // 發送訊息（使用 SSE 串流）
  const sendMessage = useCallback(async (message: string) => {
    // 取消之前的請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 建立新的 AbortController
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setCurrentToolCalls([]);
    
    // 添加使用者訊息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // 準備 AI 回應訊息 ID（但不立即添加到訊息列表）
    const assistantMessageId = `msg_${Date.now()}_assistant`;
    let assistantMessageAdded = false;
    
    try {
      // 準備對話歷史（智能 token 管理）
      const conversationHistory = prepareConversationHistory(messages, options.maxHistoryLength || 5);

      const response = await fetch('/api/ai-agent/stream-natural', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          whiteboardData,
          conversationHistory
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // 讀取 SSE 串流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }

      let currentContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              
              switch (event.type) {
                case 'tool_call_start':
                  // 創建合併的工具調用訊息
                  const toolMessageId = `process_${Date.now()}_tool_${event.tool}_${event.attempt}`;
                  const toolKey = `${event.tool}_${event.attempt}`;
                  
                  const toolMsg: ChatMessage = {
                    id: toolMessageId,
                    role: 'process',
                    content: `執行工具：${event.tool}`,
                    timestamp: new Date(),
                    processInfo: {
                      type: 'tool_call_combined',
                      title: '🔧 工具調用',
                      description: `使用 ${event.tool} 搜尋相關資訊`,
                      data: {
                        tool: event.tool,
                        args: event.args,
                        attempt: event.attempt,
                        maxAttempts: event.maxAttempts,
                        status: 'running',
                        result: null
                      }
                    }
                  };
                  setMessages(prev => [...prev, toolMsg]);
                  
                  // 記錄這個工具調用的 ID，以便後續更新
                  activeToolCallsRef.current.set(toolKey, toolMessageId);
                  break;

                case 'tool_call_result':
                  // 更新對應的工具調用訊息，添加結果
                  const resultToolKey = `${event.tool}_${event.attempt}`;
                  const existingMessageId = activeToolCallsRef.current.get(resultToolKey);
                  
                  if (existingMessageId) {
                    setMessages(prev => prev.map(msg => {
                      if (msg.id === existingMessageId && msg.processInfo) {
                        return {
                          ...msg,
                          content: `工具執行完成：${event.tool}`,
                          processInfo: {
                            ...msg.processInfo,
                            title: '✅ 工具完成',
                            description: `${event.tool} 執行完成`,
                            data: {
                              ...msg.processInfo.data,
                              status: 'completed',
                              result: event.result,
                              prompt: event.prompt || null // 添加 prompt 信息
                            }
                          }
                        };
                      }
                      return msg;
                    }));
                    
                    // 清除追蹤
                    activeToolCallsRef.current.delete(resultToolKey);
                  }
                  break;

                case 'response_start':
                  // 開始接收回應 - 現在才添加 assistant 訊息
                  if (!assistantMessageAdded) {
                    const assistantMessage: ChatMessage = {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: '',
                      timestamp: new Date(),
                      isStreaming: true
                      // 不再包含 toolCalls，因為它們現在是獨立的 process 訊息
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    assistantMessageAdded = true;
                  }
                  break;

                case 'response_chunk':
                  // 累積回應內容
                  currentContent += event.content;
                  
                  // 更新訊息內容（只有在 assistant 訊息已添加時）
                  if (assistantMessageAdded) {
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMessageId
                        ? { ...msg, content: currentContent }
                        : msg
                    ));
                  }
                  break;

                case 'thinking':
                  // AI 正在思考
                  const thinkingMsg: ChatMessage = {
                    id: `process_${Date.now()}_thinking`,
                    role: 'process',
                    content: event.message || '正在思考下一步...',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'thinking',
                      title: '💭 思考中',
                      description: '評估工具調用結果並決定下一步行動'
                    }
                  };
                  setMessages(prev => [...prev, thinkingMsg]);
                  break;
                
                case 'reflecting':
                  // AI 正在反思是否已回答原始問題
                  const reflectingMsg: ChatMessage = {
                    id: `process_${Date.now()}_reflecting`,
                    role: 'process',
                    content: event.message || '正在反思是否已回答您的問題...',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'reflecting',
                      title: '🤔 反思檢查',
                      description: '檢查是否已經收集足夠資訊回答原始問題'
                    }
                  };
                  setMessages(prev => [...prev, reflectingMsg]);
                  break;
                  
                case 'decision':
                  // AI 的決策結果
                  const decisionMsg: ChatMessage = {
                    id: `process_${Date.now()}_decision`,
                    role: 'process',
                    content: `決策：${event.decision?.continue ? '繼續搜尋' : '開始回答'}`,
                    timestamp: new Date(),
                    processInfo: {
                      type: 'decision',
                      title: '⚖️ 決策結果',
                      description: `理由：${event.decision?.reason || '未知'}`,
                      data: event.decision
                    }
                  };
                  setMessages(prev => [...prev, decisionMsg]);
                  break;
                  
                case 'analyzing_intent':
                  // 正在分析意圖 - 顯示過程訊息
                  const intentAnalyzingMsg: ChatMessage = {
                    id: `process_${Date.now()}_intent_analyzing`,
                    role: 'process',
                    content: event.message || '正在分析您的問題意圖...',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'analyzing_intent',
                      title: '🧠 意圖分析',
                      description: '理解您真正想要查詢的內容'
                    }
                  };
                  setMessages(prev => [...prev, intentAnalyzingMsg]);
                  break;
                  
                case 'intent_analyzed':
                  // 意圖分析完成 - 顯示結果
                  const intentAnalyzedMsg: ChatMessage = {
                    id: `process_${Date.now()}_intent_analyzed`,
                    role: 'process',
                    content: `意圖分析完成`,
                    timestamp: new Date(),
                    processInfo: {
                      type: 'intent_analyzed',
                      title: '✅ 意圖理解',
                      description: `識別為：${event.intent?.intent_type || '未知'}類型查詢`,
                      data: event.intent
                    }
                  };
                  setMessages(prev => [...prev, intentAnalyzedMsg]);
                  break;
                  
                case 'generating_context':
                  // 正在生成 context
                  const contextGeneratingMsg: ChatMessage = {
                    id: `process_${Date.now()}_context_generating`,
                    role: 'process',
                    content: event.message || '準備相關的白板資訊...',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'generating_context',
                      title: '📊 準備資料',
                      description: '基於您的意圖篩選相關資訊'
                    }
                  };
                  setMessages(prev => [...prev, contextGeneratingMsg]);
                  break;
                  
                case 'context_ready':
                  // Context 準備完成，顯示初步概覽
                  const contextReadyMsg: ChatMessage = {
                    id: `process_${Date.now()}_context_ready`,
                    role: 'process',
                    content: event.overview || '相關資訊已準備完成',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'context_ready',
                      title: '📋 初步概覽',
                      description: '基於白板內容的相關資訊摘要'
                    }
                  };
                  setMessages(prev => [...prev, contextReadyMsg]);
                  break;
                  
                // ========== 新的自然流程事件 ==========
                case 'whiteboard_summary_ready':
                  // 白板摘要完成
                  const whiteboardSummaryMsg: ChatMessage = {
                    id: `process_${Date.now()}_whiteboard_summary`,
                    role: 'process',
                    content: '白板內容分析完成',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'whiteboard_summary_ready',
                      title: '✅ 白板摘要',
                      description: '已完成白板內容的全面分析',
                      data: {
                        summary: event.summary,
                        prompts: event.prompts || []
                      }
                    }
                  };
                  setMessages(prev => [...prev, whiteboardSummaryMsg]);
                  break;
                  
                case 'intent_analysis_complete':
                  // 意圖分析完成
                  const intentCompleteMsg: ChatMessage = {
                    id: `process_${Date.now()}_intent_complete`,
                    role: 'process',
                    content: '意圖理解完成',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'intent_analysis_complete',
                      title: '💡 理解完成',
                      description: '已理解您的真正需求',
                      data: {
                        analysis: event.analysis,
                        prompt: event.prompt || null
                      }
                    }
                  };
                  setMessages(prev => [...prev, intentCompleteMsg]);
                  break;
                  
                case 'planning_actions':
                  // 制定行動計劃
                  const planningMsg: ChatMessage = {
                    id: `process_${Date.now()}_planning`,
                    role: 'process',
                    content: event.message || '制定查詢計劃...',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'planning_actions',
                      title: '📋 規劃行動',
                      description: '決定使用什麼工具和策略'
                    }
                  };
                  setMessages(prev => [...prev, planningMsg]);
                  break;
                  
                case 'action_plan_ready':
                  // 行動計劃完成
                  const planReadyMsg: ChatMessage = {
                    id: `process_${Date.now()}_plan_ready`,
                    role: 'process',
                    content: '行動計劃制定完成',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'action_plan_ready',
                      title: '🎯 計劃就緒',
                      description: '已制定具體的查詢策略',
                      data: event.plan
                    }
                  };
                  setMessages(prev => [...prev, planReadyMsg]);
                  break;
                  
                case 'reflection_complete':
                  // 反思完成
                  const reflectionCompleteMsg: ChatMessage = {
                    id: `process_${Date.now()}_reflection_complete`,
                    role: 'process',
                    content: '反思完成',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'reflection_complete',
                      title: '💭 反思結果',
                      description: '對當前資訊的評估結果',
                      data: {
                        reflection: event.reflection,
                        prompt: event.prompt || null
                      }
                    }
                  };
                  setMessages(prev => [...prev, reflectionCompleteMsg]);
                  break;
                  
                case 'stop_reason':
                  // 顯示停止原因
                  const stopReasonMsg: ChatMessage = {
                    id: `process_${Date.now()}_stop_reason`,
                    role: 'process',
                    content: event.description || '探索階段結束',
                    timestamp: new Date(),
                    processInfo: {
                      type: 'stop_reason',
                      title: '🏁 停止探索',
                      description: event.description,
                      data: {
                        reason: event.reason,
                        toolCallCount: event.toolCallCount
                      }
                    }
                  };
                  setMessages(prev => [...prev, stopReasonMsg]);
                  break;
                  
                case 'done':
                  // 完成串流（只有在 assistant 訊息已添加時）
                  if (assistantMessageAdded) {
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    ));
                  }
                  break;

                case 'error':
                  throw new Error(event.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (error: any) {
      // 如果是取消請求，不處理錯誤
      if (error.name === 'AbortError') {
        return;
      }
      
      console.error('Failed to send message:', error);
      
      // 錯誤處理
      const errorMessage = error.message || '無法取得回應，請稍後再試';
      if (options.onError) {
        options.onError(errorMessage);
      }
      
      // 更新錯誤訊息
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { 
              ...msg, 
              content: `抱歉，發生錯誤：${errorMessage}`,
              isStreaming: false 
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
      setCurrentToolCalls([]);
      abortControllerRef.current = null;
    }
  }, [whiteboardData, messages, options]);

  // 清除對話歷史
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentToolCalls([]);
    activeToolCallsRef.current.clear();
    // 同時清除 localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // 取消當前請求
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setCurrentToolCalls([]);
      activeToolCallsRef.current.clear();
    }
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    cancelRequest,
    isLoading,
    currentToolCalls
  };
}