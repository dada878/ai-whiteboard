import { useState, useCallback, useRef } from 'react';
import { WhiteboardData } from '@/app/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{
    tool: string;
    result: any;
  }>;
}

interface UseAIAgentOptions {
  onError?: (error: string) => void;
  maxHistoryLength?: number;
}

export function useAIAgent(
  whiteboardData: WhiteboardData,
  options: UseAIAgentOptions = {}
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 發送訊息
  const sendMessage = useCallback(async (message: string) => {
    // 取消之前的請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 建立新的 AbortController
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    
    // 添加使用者訊息到對話歷史
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    try {
      // 準備對話歷史（限制長度以節省 token）
      const conversationHistory = messages
        .slice(-(options.maxHistoryLength || 10))
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const response = await fetch('/api/ai-agent', {
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      
      // 添加 AI 回應到對話歷史
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
        toolCalls: data.toolCalls
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      return data;
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
      
      // 添加錯誤訊息
      const errorAssistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: `抱歉，發生錯誤：${errorMessage}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [whiteboardData, messages, options]);

  // 清除對話歷史
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // 取消當前請求
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // 重新發送最後一條訊息
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      // 移除最後的錯誤訊息（如果有）
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.role === 'assistant' && lastMessage.content.includes('發生錯誤')) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      
      await sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  return {
    messages,
    sendMessage,
    clearMessages,
    cancelRequest,
    retryLastMessage,
    isLoading
  };
}