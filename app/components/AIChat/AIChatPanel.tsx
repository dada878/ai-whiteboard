'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, RotateCcw, Bot, User, Loader2, Sparkles, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { useAIAgent, ChatMessage } from '@/app/hooks/useAIAgent';
import { WhiteboardData } from '@/app/types';

interface AIChatPanelProps {
  whiteboardData: WhiteboardData;
  onClose?: () => void;
}

export function AIChatPanel({ whiteboardData, onClose }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { 
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
  } = useAIAgent(whiteboardData, {
    onError: (error) => {
      console.error('AI Agent error:', error);
    },
    maxHistoryLength: 20,
    persistKey: 'ai_assistant' // 使用固定的 key 來持久化對話
  });

  // 自動滾動到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 處理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input;
    setInput('');
    await sendMessage(userInput);
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 快速提問
  const quickQuestions = [
    '白板上有哪些內容？',
    '有哪些群組？',
    '找出所有待辦事項',
    '分析白板結構'
  ];

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* 標題列 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI 助手
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="清除對話"
            >
              <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* 對話區域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              我是你的 AI 助手，可以幫你查詢和分析白板內容
            </p>
            
            {/* 快速提問 */}
            <div className="space-y-2">
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">快速提問：</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickQuestion(question)}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                message={msg}
                onRegenerate={regenerateMessage}
                onEdit={editMessage}
                onStartEdit={startEditMessage}
                onCancelEdit={cancelEditMessage}
                isLastAssistant={msg.role === 'assistant' && 
                  messages[messages.length - 1].id === msg.id}
              />
            ))}
            
            {/* 載入中指示器 */}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI 正在思考...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 錯誤重試 */}
      {messages.length > 0 && 
       messages[messages.length - 1].role === 'assistant' && 
       messages[messages.length - 1].content.includes('發生錯誤') && (
        <div className="px-4 pb-2">
          <button
            onClick={retryLastMessage}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            重試
          </button>
        </div>
      )}

      {/* 輸入區域 */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入訊息... (Shift+Enter 換行)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// 訊息氣泡元件
interface MessageBubbleProps {
  message: ChatMessage;
  onRegenerate?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
  onStartEdit?: (id: string) => void;
  onCancelEdit?: (id: string) => void;
  isLastAssistant?: boolean;
}

function MessageBubble({ 
  message, 
  onRegenerate, 
  onEdit, 
  onStartEdit, 
  onCancelEdit,
  isLastAssistant 
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showTools, setShowTools] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (message.isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [message.isEditing]);
  
  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit(message.id, editContent);
    }
  };
  
  const handleCancelEdit = () => {
    setEditContent(message.content);
    if (onCancelEdit) {
      onCancelEdit(message.id);
    }
  };
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* 頭像 */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
        }`}>
          {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>
        
        {/* 訊息內容 */}
        <div className="flex flex-col gap-1">
          <div className={`relative group px-4 py-2 rounded-lg ${
            isUser 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
          }`}>
            {message.isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={editInputRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 resize-none"
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                    title="儲存"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    title="取消"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
                
                {/* 操作按鈕 */}
                <div className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                  {isUser && onStartEdit && (
                    <button
                      onClick={() => onStartEdit(message.id)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-800"
                      title="編輯訊息"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isUser && onRegenerate && (
                    <button
                      onClick={() => onRegenerate(message.id)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-800"
                      title="重新生成"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* 工具呼叫資訊 */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setShowTools(!showTools)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showTools ? '隱藏' : '顯示'}工具呼叫 ({message.toolCalls.length})
              </button>
              
              {showTools && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs">
                  {message.toolCalls.map((call, idx) => (
                    <div key={idx} className="mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {call.tool}
                      </span>
                      {call.result && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          - {typeof call.result === 'object' 
                            ? `${call.result.totalMatches || 0} 個結果`
                            : '已執行'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* 時間戳記 */}
          <div className="text-xs text-gray-400 dark:text-gray-500 px-1">
            {new Date(message.timestamp).toLocaleTimeString('zh-TW', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    </div>
  );
}