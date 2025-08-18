import { useState, useCallback, useRef, useEffect } from 'react';
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
  isEditing?: boolean; // 標記訊息是否正在編輯
  originalContent?: string; // 保存原始內容以便取消編輯
}

interface UseAIAgentOptions {
  onError?: (error: string) => void;
  maxHistoryLength?: number;
  persistKey?: string; // 用於 localStorage 的 key
}

const STORAGE_PREFIX = 'ai_chat_history_';
const MAX_STORAGE_MESSAGES = 100; // 最多儲存的訊息數量

export function useAIAgent(
  whiteboardData: WhiteboardData,
  options: UseAIAgentOptions = {}
) {
  const storageKey = options.persistKey || `${STORAGE_PREFIX}default`;
  
  // 從 localStorage 載入對話記錄
  const loadMessages = useCallback(() => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 轉換 timestamp 字串回 Date 物件
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
    return [];
  }, [storageKey]);
  
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 儲存對話記錄到 localStorage
  const saveMessages = useCallback((msgs: ChatMessage[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      // 只保留最近的訊息以避免超過 localStorage 限制
      const toSave = msgs.slice(-MAX_STORAGE_MESSAGES);
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }, [storageKey]);
  
  // 當 messages 改變時自動儲存
  useEffect(() => {
    saveMessages(messages);
  }, [messages, saveMessages]);

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

  // 重新生成指定的 AI 訊息
  const regenerateMessage = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // 找到這個 AI 訊息之前最近的使用者訊息
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
      userMessageIndex--;
    }
    
    if (userMessageIndex < 0) return;
    
    const userMessage = messages[userMessageIndex];
    
    // 移除從這個 AI 訊息開始的所有後續訊息
    setMessages(prev => prev.slice(0, messageIndex));
    
    // 重新發送使用者訊息以獲得新的回應
    await sendMessage(userMessage.content);
  }, [messages, sendMessage]);

  // 編輯訊息
  const editMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          content: newContent,
          isEditing: false,
          originalContent: undefined
        };
      }
      return msg;
    }));
    
    // 如果編輯的是使用者訊息，移除後續的所有訊息並重新發送
    const messageIndex = messages.findIndex(m => m.id === messageId);
    const message = messages[messageIndex];
    
    if (message && message.role === 'user') {
      // 移除這條訊息之後的所有訊息
      setMessages(prev => prev.slice(0, messageIndex + 1));
      
      // 延遲發送以確保狀態已更新
      setTimeout(() => {
        sendMessage(newContent);
      }, 100);
    }
  }, [messages, sendMessage]);

  // 開始編輯訊息
  const startEditMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          isEditing: true,
          originalContent: msg.content
        };
      }
      return msg;
    }));
  }, []);

  // 取消編輯訊息
  const cancelEditMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.originalContent) {
        return {
          ...msg,
          content: msg.originalContent,
          isEditing: false,
          originalContent: undefined
        };
      }
      return msg;
    }));
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    cancelRequest,
    retryLastMessage,
    regenerateMessage,
    editMessage,
    startEditMessage,
    cancelEditMessage,
    isLoading
  };
}