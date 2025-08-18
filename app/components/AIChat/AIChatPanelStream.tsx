'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, User, Loader2, Sparkles, Wrench, CheckCircle, AlertCircle, Search, FileText, FolderOpen, Eye, Brain, ChevronDown, ChevronRight, Plus, Link, StopCircle } from 'lucide-react';
import { useAIAgentStream, ChatMessage, ToolCall, ProcessInfo } from '@/app/hooks/useAIAgentStream';
import { WhiteboardData } from '@/app/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIChatPanelStreamProps {
  whiteboardData: WhiteboardData;
  // 從上層元件傳遞的問題狀態（避免重複載入）
  preloadedQuestions?: string[];
  isLoadingQuestions?: boolean;
  onWhiteboardUpdate?: (updater: WhiteboardData | ((prev: WhiteboardData) => WhiteboardData)) => void;
}

// 工具圖標對應
const toolIcons: Record<string, React.ElementType> = {
  'search_notes': Search,
  'get_note_by_id': FileText,
  'search_groups': FolderOpen,
  'get_group_by_id': FolderOpen,
  'get_whiteboard_overview': Eye,
  'create_note': Plus,
  'create_connected_note': Plus,
  'create_edge': Link
};

// 工具名稱對應
const toolNames: Record<string, string> = {
  'search_notes': '搜尋便利貼',
  'get_note_by_id': '查詢便利貼',
  'search_groups': '搜尋群組',
  'get_group_by_id': '查詢群組',
  'get_whiteboard_overview': '白板概覽',
  'create_note': '創建便利貼',
  'create_connected_note': '創建連接便利貼',
  'create_edge': '創建連線'
};

// Markdown 內容渲染組件（強制亮色模式）
function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`${className || ''} prose prose-sm max-w-none prose-gray prose-p:text-gray-800 prose-headings:text-gray-900 prose-code:text-blue-600 prose-pre:bg-gray-100 prose-blockquote:border-gray-300`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
      components={{
        // 自定義程式碼區塊樣式
        code: ({ inline, children, ...props }) => {
          if (inline) {
            return (
              <code 
                className="px-1 py-0.5 rounded text-xs font-mono bg-gray-100 text-blue-600"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <pre className="rounded-lg p-3 overflow-x-auto bg-gray-100">
              <code className="text-sm font-mono" {...props}>
                {children}
              </code>
            </pre>
          );
        },
        // 自定義列表樣式
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 my-2">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 my-2">
            {children}
          </ol>
        ),
        // 自定義標題樣式
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">
            {children}
          </h3>
        ),
        // 自定義段落樣式
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">
            {children}
          </p>
        ),
        // 自定義引用樣式
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 pl-3 py-1 my-2 italic border-gray-300 bg-gray-50">
            {children}
          </blockquote>
        ),
        // 自定義表格樣式
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border-collapse border border-gray-300">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border px-2 py-1 text-xs font-medium border-gray-300 bg-gray-100">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border px-2 py-1 text-xs border-gray-300">
            {children}
          </td>
        )
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function AIChatPanelStream({ 
  whiteboardData, 
  preloadedQuestions, 
  isLoadingQuestions: externalIsLoadingQuestions,
  onWhiteboardUpdate
}: AIChatPanelStreamProps) {
  const [input, setInput] = useState('');
  
  // 使用外部傳入的問題（不再提供預設問題）
  const quickQuestions = preloadedQuestions || [];
  const isLoadingQuestions = externalIsLoadingQuestions !== undefined ? externalIsLoadingQuestions : false;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { 
    messages, 
    sendMessage, 
    clearMessages, 
    cancelRequest,
    isLoading,
    currentToolCalls
  } = useAIAgentStream(whiteboardData, {
    onError: (error) => {
      console.error('AI Agent error:', error);
    },
    maxHistoryLength: 20,
    persistKey: 'ai_assistant_stream' // 使用固定的 key 來持久化對話
  });

  // 監聽創建工具的完成，並更新白板狀態
  useEffect(() => {
    if (!onWhiteboardUpdate) return;

    // 檢查最新的訊息中是否有已完成的創建工具
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.toolCalls) return;

    latestMessage.toolCalls.forEach(toolCall => {
      console.log('[AI創建工具] 檢查工具調用:', toolCall.tool, 'status:', toolCall.status);
      
      if (toolCall.status !== 'completed' || !toolCall.result) {
        console.log('[AI創建工具] 工具未完成或無結果，跳過');
        return;
      }

      console.log('[AI創建工具] 工具結果:', toolCall.result);

      // 處理創建便利貼工具
      if (toolCall.tool === 'create_note' && toolCall.result.success) {
        // 檢查兩種可能的結構
        const newNote = toolCall.result.note || toolCall.result.newNote;
        console.log('[AI創建工具] create_note - 找到便利貼:', newNote);
        
        if (newNote) {
          console.log('[AI創建工具] 添加新便利貼到白板:', newNote.id);
          onWhiteboardUpdate(prev => ({
            ...prev,
            notes: [...prev.notes, newNote]
          }));
        }
      }

      // 處理創建連接便利貼工具
      if (toolCall.tool === 'create_connected_note' && toolCall.result.success) {
        // 檢查兩種可能的結構
        const newNote = toolCall.result.note || toolCall.result.newNote;
        const newEdge = toolCall.result.edge || toolCall.result.connection;
        
        console.log('[AI創建工具] create_connected_note - 便利貼:', newNote, '連線:', newEdge);
        
        if (newNote) {
          console.log('[AI創建工具] 添加連接便利貼到白板:', newNote.id, '連線:', newEdge?.id);
          onWhiteboardUpdate(prev => {
            const updatedData = {
              ...prev,
              notes: [...prev.notes, newNote]
            };
            
            // 如果有連線，也添加連線
            if (newEdge) {
              updatedData.edges = [...prev.edges, newEdge];
            }
            
            console.log('[AI創建工具] 更新後的白板資料 - 便利貼數量:', updatedData.notes.length, '連線數量:', updatedData.edges.length);
            return updatedData;
          });
        }
      }

      // 處理創建連線工具
      if (toolCall.tool === 'create_edge' && toolCall.result.success) {
        // 檢查兩種可能的結構
        const newEdge = toolCall.result.edge || toolCall.result.connection;
        console.log('[AI創建工具] create_edge - 找到連線:', newEdge);
        
        if (newEdge) {
          console.log('[AI創建工具] 添加新連線到白板:', newEdge.id);
          onWhiteboardUpdate(prev => ({
            ...prev,
            edges: [...prev.edges, newEdge]
          }));
        }
      }
    });
  }, [messages, onWhiteboardUpdate]);

  // 自動滾動到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentToolCalls]);

  // 處理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 如果正在載入，則停止請求
    if (isLoading) {
      cancelRequest();
      return;
    }
    
    // 否則發送新訊息
    if (!input.trim()) return;

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


  const handleQuickQuestion = async (question: string) => {
    if (isLoading) return;
    
    // 直接發送問題，無需先填入輸入框
    setInput(''); // 清空輸入框
    await sendMessage(question);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 簡化的頂部操作欄 */}
      {messages.length > 0 && (
        <div className="flex justify-end p-2 border-b border-gray-100">
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-gray-50 rounded-md transition-colors text-gray-400 hover:text-gray-600"
            title="清除對話"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 對話區域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <div className="mb-4">
              <Bot className="w-10 h-10 text-blue-500 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                探索白板內容，分析想法連結
              </p>
            </div>
            
            {/* 快速提問 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-gray-500">快速開始：</p>
                {isLoadingQuestions && (
                  <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                )}
              </div>
              {isLoadingQuestions ? (
                // 載入中顯示骨架屏或載入提示
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((idx) => (
                    <div 
                      key={idx} 
                      className="px-2.5 py-1.5 bg-gray-100 rounded-md border border-gray-200 animate-pulse"
                    >
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : quickQuestions.length > 0 ? (
                // 顯示生成的問題
                <div className="grid grid-cols-2 gap-2">
                  {quickQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(question)}
                      disabled={isLoading}
                      className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              ) : (
                // 沒有問題時顯示提示（通常不會發生）
                <div className="text-xs text-gray-400 text-center py-2">
                  正在分析白板內容...
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubbleStream key={msg.id} message={msg} />
            ))}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 輸入區域 */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="詢問白板內容... (Shift+Enter 換行)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md resize-none bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            rows={2}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!isLoading && !input.trim()}
            className={`px-3 py-2 rounded-md transition-colors flex items-center justify-center min-w-[44px] ${
              isLoading 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={isLoading ? '停止 AI 回應' : '發送訊息'}
          >
            {isLoading ? (
              <StopCircle className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// 訊息氣泡元件（支援串流）
function MessageBubbleStream({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isProcess = message.role === 'process';
  const isStreaming = message.isStreaming;
  
  // 如果是過程訊息，使用特殊的顯示方式
  if (isProcess) {
    return <ProcessMessageDisplay message={message} />;
  }
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`flex gap-2 max-w-[90%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* 頭像 */}
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'
        }`}>
          {isUser ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
        </div>
        
        {/* 訊息內容 */}
        <div className="flex flex-col gap-1">
          {/* 工具呼叫 */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-1.5 mb-1.5">
              {message.toolCalls.map((toolCall, idx) => (
                <ToolCallDisplay key={idx} toolCall={toolCall} />
              ))}
            </div>
          )}
          
          {/* 訊息文字 */}
          {(message.content || isStreaming) && (
            <div className={`px-3 py-2 rounded-lg text-sm ${
              isUser 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-50 text-gray-800 border border-gray-200'
            }`}>
              {isUser ? (
                // 使用者訊息保持純文字
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {message.content}
                </div>
              ) : (
                // AI 回應使用 Markdown 渲染
                <div className="break-words leading-relaxed">
                  {message.content ? (
                    <div className="relative">
                      <MarkdownContent content={message.content} />
                      {isStreaming && (
                        <span className="inline-block w-0.5 h-4 ml-1 bg-current animate-pulse" />
                      )}
                    </div>
                  ) : (
                    isStreaming && (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        思考中...
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* 時間戳記 */}
          <div className="text-xs text-gray-400 px-1">
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

// 工具呼叫顯示元件
function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = toolIcons[toolCall.tool] || Wrench;
  const toolName = toolNames[toolCall.tool] || toolCall.tool;
  
  return (
    <div className="bg-blue-50 rounded-md p-2.5 border border-blue-200">
      <div className="flex items-start gap-2">
        {/* 狀態圖標 */}
        <div className="flex-shrink-0 mt-0.5">
          {toolCall.status === 'running' && (
            <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          )}
          {toolCall.status === 'completed' && (
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          )}
          {toolCall.status === 'error' && (
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          )}
          {toolCall.status === 'pending' && (
            <Icon className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
        
        {/* 工具資訊 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">
              {toolName}
            </span>
            {/* 顯示嘗試次數 */}
            {toolCall.attempt && toolCall.maxAttempts && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                {toolCall.attempt}/{toolCall.maxAttempts}
              </span>
            )}
            {toolCall.status === 'running' && (
              <span className="text-xs text-blue-500">
                執行中...
              </span>
            )}
          </div>
          
          {/* 參數顯示 */}
          {toolCall.args && (
            <div className="mt-1 text-xs text-blue-600">
              {toolCall.tool === 'search_notes' && toolCall.args.keywords && (
                <span>搜尋: {toolCall.args.keywords.join(', ')}</span>
              )}
              {toolCall.tool === 'get_note_by_id' && toolCall.args.note_id && (
                <span>ID: {toolCall.args.note_id.substring(0, 8)}...</span>
              )}
              {toolCall.tool === 'search_groups' && toolCall.args.keywords && (
                <span>搜尋: {toolCall.args.keywords.join(', ')}</span>
              )}
              {toolCall.tool === 'get_group_by_id' && toolCall.args.group_id && (
                <span>ID: {toolCall.args.group_id.substring(0, 8)}...</span>
              )}
            </div>
          )}
          
          {/* 結果顯示 */}
          {toolCall.result && (
            <div className="mt-1.5">
              {toolCall.result.totalMatches !== undefined && (
                <span className="text-xs text-green-600">
                  找到 {toolCall.result.totalMatches} 個結果
                </span>
              )}
              {toolCall.result.summary && (
                <span className="text-xs text-gray-600">
                  {toolCall.result.summary}
                </span>
              )}
              
              {/* 展開/收合按鈕 */}
              {toolCall.result.results && toolCall.result.results.length > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 text-xs text-blue-500 hover:text-blue-600"
                >
                  {isExpanded ? '收合' : '展開'}結果
                </button>
              )}
              
              {/* 展開的結果 */}
              {isExpanded && toolCall.result.results && (
                <div className="mt-1.5 p-2 bg-white rounded border border-gray-200 max-h-32 overflow-y-auto">
                  {toolCall.result.results.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-gray-600 py-0.5">
                      • {item.content || item.name || 'Item ' + (idx + 1)}
                    </div>
                  ))}
                  {toolCall.result.results.length > 5 && (
                    <div className="text-xs text-gray-500 pt-0.5">
                      還有 {toolCall.result.results.length - 5} 個結果...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 過程訊息顯示元件
function ProcessMessageDisplay({ message }: { message: ChatMessage }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const processInfo = message.processInfo;
  
  if (!processInfo) return null;

  // 根據過程類型選擇圖標和顏色
  const getProcessStyle = (type: string) => {
    switch (type) {
      // ========== 新的自然流程 ==========
      case 'whiteboard_summary_ready':
        return { 
          icon: CheckCircle, 
          bgColor: 'bg-green-50', 
          borderColor: 'border-green-200',
          iconColor: 'text-green-600'
        };
      case 'intent_analysis_complete':
        return { 
          icon: CheckCircle, 
          bgColor: 'bg-emerald-50', 
          borderColor: 'border-emerald-200',
          iconColor: 'text-emerald-600'
        };
      case 'planning_actions':
        return { 
          icon: Loader2, 
          bgColor: 'bg-blue-50', 
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600'
        };
      case 'action_plan_ready':
        return { 
          icon: CheckCircle, 
          bgColor: 'bg-teal-50', 
          borderColor: 'border-teal-200',
          iconColor: 'text-teal-600'
        };
      case 'reflection_complete':
        return { 
          icon: CheckCircle, 
          bgColor: 'bg-lime-50', 
          borderColor: 'border-lime-200',
          iconColor: 'text-lime-600'
        };
      // ========== 舊的結構化流程 ==========
      case 'analyzing_intent':
        return { 
          icon: Brain, 
          bgColor: 'bg-purple-50', 
          borderColor: 'border-purple-200',
          iconColor: 'text-purple-600'
        };
      case 'intent_analyzed':
        return { 
          icon: CheckCircle, 
          bgColor: 'bg-green-50', 
          borderColor: 'border-green-200',
          iconColor: 'text-green-600'
        };
      case 'generating_context':
        return { 
          icon: Loader2, 
          bgColor: 'bg-blue-50', 
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600'
        };
      case 'context_ready':
        return { 
          icon: Eye, 
          bgColor: 'bg-cyan-50', 
          borderColor: 'border-cyan-200',
          iconColor: 'text-cyan-600'
        };
      case 'thinking':
        return { 
          icon: Brain, 
          bgColor: 'bg-yellow-50', 
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-600'
        };
      case 'reflecting':
        return { 
          icon: Search, 
          bgColor: 'bg-orange-50', 
          borderColor: 'border-orange-200',
          iconColor: 'text-orange-600'
        };
      case 'decision':
        return { 
          icon: CheckCircle, 
          bgColor: 'bg-indigo-50', 
          borderColor: 'border-indigo-200',
          iconColor: 'text-indigo-600'
        };
      case 'tool_call_start':
        return { 
          icon: Wrench, 
          bgColor: 'bg-blue-50', 
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600'
        };
      case 'tool_call_result':
        return { 
          icon: CheckCircle, 
          bgColor: 'bg-green-50', 
          borderColor: 'border-green-200',
          iconColor: 'text-green-600'
        };
      case 'tool_call_combined':
        return { 
          icon: Wrench, 
          bgColor: 'bg-blue-50', 
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600'
        };
      case 'stop_reason':
        return { 
          icon: StopCircle, 
          bgColor: 'bg-amber-50', 
          borderColor: 'border-amber-200',
          iconColor: 'text-amber-600'
        };
      default:
        return { 
          icon: Wrench, 
          bgColor: 'bg-gray-50', 
          borderColor: 'border-gray-200',
          iconColor: 'text-gray-600'
        };
    }
  };

  const style = getProcessStyle(processInfo.type);
  const Icon = style.icon || Wrench; // Fallback to Wrench if icon is undefined

  return (
    <div className={`mb-2 border rounded-md ${style.bgColor} ${style.borderColor}`}>
      {/* 標題列 */}
      <div 
        className="flex items-center gap-2 p-2.5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* 圖標 */}
        <div className="flex-shrink-0">
          {processInfo.type === 'generating_context' ? (
            <Loader2 className={`w-3.5 h-3.5 animate-spin ${style.iconColor}`} />
          ) : Icon ? (
            <Icon className={`w-3.5 h-3.5 ${style.iconColor}`} />
          ) : (
            <Wrench className={`w-3.5 h-3.5 ${style.iconColor}`} />
          )}
        </div>
        
        {/* 標題和描述 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-800">
              {processInfo.title}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {processInfo.description}
          </div>
        </div>
        
        {/* 展開/收合按鈕 */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </div>
      
      {/* 展開內容 */}
      {isExpanded && (
        <div className="px-2.5 pb-2.5">
          {/* 主要內容 */}
          <div className="text-xs text-gray-700 mb-2 leading-relaxed">
            {message.content}
          </div>
          
          {/* 詳細資料 */}
          {processInfo.data && (
            <div className="mt-2">
              <details className="group">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  📋 詳細資料 (點擊展開)
                </summary>
                <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(processInfo.data, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
          
          {/* 特殊處理意圖分析結果 */}
          {processInfo.type === 'intent_analyzed' && processInfo.data && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-white rounded border">
                <div className="font-medium text-gray-700">查詢類型</div>
                <div className="text-gray-600">{processInfo.data.intent_type}</div>
              </div>
              <div className="p-2 bg-white rounded border">
                <div className="font-medium text-gray-700">信心度</div>
                <div className="text-gray-600">{processInfo.data.confidence}%</div>
              </div>
              {processInfo.data.key_entities && processInfo.data.key_entities.length > 0 && (
                <div className="col-span-2 p-2 bg-white  rounded border">
                  <div className="font-medium text-gray-700">關鍵實體</div>
                  <div className="text-gray-600 ">
                    {processInfo.data.key_entities.join(', ')}
                  </div>
                </div>
              )}
              {processInfo.data.search_keywords && processInfo.data.search_keywords.length > 0 && (
                <div className="col-span-2 p-2 bg-white  rounded border">
                  <div className="font-medium text-gray-700">搜尋關鍵字</div>
                  <div className="text-gray-600 ">
                    {processInfo.data.search_keywords.join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 特殊處理決策結果 */}
          {processInfo.type === 'decision' && processInfo.data && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 ">決策：</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  processInfo.data.continue 
                    ? 'bg-orange-100  text-orange-700 ' 
                    : 'bg-green-100  text-green-700 '
                }`}>
                  {processInfo.data.continue ? '繼續搜尋' : '開始回答'}
                </span>
              </div>
              {processInfo.data.confidence && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700 ">信心度：</span>
                  <div className="flex-1 bg-gray-200  rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${processInfo.data.confidence}%` }}
                    />
                  </div>
                  <span className="text-gray-600 ">{processInfo.data.confidence}%</span>
                </div>
              )}
              {processInfo.data.next_action && (
                <div className="p-2 bg-white rounded border">
                  <div className="font-medium text-gray-700">下一步行動</div>
                  <div className="text-gray-600 ">{processInfo.data.next_action}</div>
                </div>
              )}
            </div>
          )}
          
          {/* 特殊處理白板摘要 */}
          {processInfo.type === 'whiteboard_summary_ready' && processInfo.data && (
            <>
              <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                <div className="font-medium text-gray-700  mb-2">白板內容概覽</div>
                <MarkdownContent 
                  content={processInfo.data.summary || processInfo.data}
                  className="text-sm"
                />
              </div>
              
              {/* 顯示 Prompts */}
              {processInfo.data.prompts && processInfo.data.prompts.length > 0 && (
                <PromptDisplay prompts={processInfo.data.prompts} />
              )}
            </>
          )}
          
          {/* 特殊處理自然語言意圖分析 */}
          {processInfo.type === 'intent_analysis_complete' && processInfo.data && (
            <>
              <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                <div className="font-medium text-gray-700  mb-2">💭 我的思考過程</div>
                <MarkdownContent 
                  content={(typeof processInfo.data === 'object' && processInfo.data.analysis) ? processInfo.data.analysis : processInfo.data}
                  className="text-sm italic"
                />
              </div>
              
              {/* 顯示意圖分析 Prompt */}
              {(typeof processInfo.data === 'object' && processInfo.data.prompt) && (
                <PromptDisplay prompts={[processInfo.data.prompt]} />
              )}
            </>
          )}
          
          {/* 特殊處理行動計劃 */}
          {processInfo.type === 'action_plan_ready' && processInfo.data && (
            <div className="mt-2 p-3 bg-white rounded border border-gray-200">
              <div className="font-medium text-gray-700  mb-2">🎯 行動計劃</div>
              <MarkdownContent 
                content={processInfo.data}
                className="text-sm"
              />
            </div>
          )}
          
          {/* 特殊處理自然語言反思 */}
          {processInfo.type === 'reflection_complete' && processInfo.data && (
            <>
              <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                <div className="font-medium text-gray-700  mb-2">🤔 我的反思</div>
                <MarkdownContent 
                  content={typeof processInfo.data === 'string' ? processInfo.data : processInfo.data.reflection}
                  className="text-sm italic"
                />
              </div>
              
              {/* 顯示反思 Prompt（如果有） */}
              {(typeof processInfo.data === 'object' && processInfo.data.prompt) && (
                <PromptDisplay prompts={[processInfo.data.prompt]} />
              )}
            </>
          )}
          
          {/* 特殊處理停止原因 */}
          {processInfo.type === 'stop_reason' && processInfo.data && (
            <div className="mt-2 p-3 bg-white rounded border border-gray-200">
              <div className="font-medium text-gray-700 mb-2">🏁 停止探索原因</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">原因類型：</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    processInfo.data.reason === 'max_tools_reached' 
                      ? 'bg-red-100 text-red-700'
                      : processInfo.data.reason === 'sufficient_information'
                      ? 'bg-green-100 text-green-700'
                      : processInfo.data.reason === 'no_tools_needed'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {processInfo.data.reason === 'max_tools_reached' && '達到工具調用上限'}
                    {processInfo.data.reason === 'sufficient_information' && '資訊已足夠'}
                    {processInfo.data.reason === 'no_tools_needed' && '不需要工具'}
                    {processInfo.data.reason === 'no_reflection' && '無需繼續探索'}
                  </span>
                </div>
                {processInfo.data.toolCallCount !== undefined && (
                  <div>
                    <span className="font-medium text-gray-600">工具調用次數：</span>
                    <span className="text-gray-800 ml-2">{processInfo.data.toolCallCount} 次</span>
                  </div>
                )}
                <div className="text-gray-600 italic pt-1">
                  {processInfo.description}
                </div>
              </div>
            </div>
          )}
          
          {/* 特殊處理工具呼叫開始 */}
          {processInfo.type === 'tool_call_start' && processInfo.data && (
            <div className="mt-2 p-3 bg-white rounded border border-gray-200">
              <div className="font-medium text-gray-700  mb-2">🔧 工具參數</div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600 ">工具：</span>
                  <span className="text-gray-800 ">{processInfo.data.tool}</span>
                </div>
                {processInfo.data.args && processInfo.data.args.keywords && (
                  <div>
                    <span className="font-medium text-gray-600 ">搜尋關鍵字：</span>
                    <span className="text-gray-800 ">{processInfo.data.args.keywords.join(', ')}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-600 ">嘗試：</span>
                  <span className="text-gray-800 ">{processInfo.data.attempt}/{processInfo.data.maxAttempts}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* 特殊處理工具呼叫結果 */}
          {processInfo.type === 'tool_call_result' && processInfo.data && (
            <div className="mt-2 p-3 bg-white rounded border border-gray-200">
              <div className="font-medium text-gray-700  mb-2">📊 搜尋結果</div>
              <div className="space-y-2 text-sm">
                {processInfo.data.result?.totalMatches !== undefined && (
                  <div>
                    <span className="font-medium text-gray-600 ">找到：</span>
                    <span className="text-gray-800 ">{processInfo.data.result.totalMatches} 個結果</span>
                  </div>
                )}
                {processInfo.data.result?.searchSummary && (
                  <div className="text-gray-600 ">
                    {processInfo.data.result.searchSummary}
                  </div>
                )}
                {processInfo.data.result?.results && processInfo.data.result.results.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium text-gray-600  mb-1">結果預覽：</div>
                    <div className="space-y-1">
                      {processInfo.data.result.results.slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} className="text-xs text-gray-500  p-1 bg-gray-50  rounded">
                          • {item.content || item.name || `項目 ${idx + 1}`}
                        </div>
                      ))}
                      {processInfo.data.result.results.length > 3 && (
                        <div className="text-xs text-gray-400 ">
                          還有 {processInfo.data.result.results.length - 3} 個結果...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 特殊處理合併的工具調用 */}
          {processInfo.type === 'tool_call_combined' && processInfo.data && (
            <div className="mt-2 p-3 bg-white rounded border border-gray-200">
              <div className="space-y-3">
                {/* 工具參數 */}
                <div>
                  <div className="font-medium text-gray-700  mb-2">🔧 工具參數</div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-600 ">工具：</span>
                      <span className="text-gray-800 ">{processInfo.data.tool}</span>
                    </div>
                    {processInfo.data.args && processInfo.data.args.keywords && (
                      <div>
                        <span className="font-medium text-gray-600 ">搜尋關鍵字：</span>
                        <span className="text-gray-800 ">{processInfo.data.args.keywords.join(', ')}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-600 ">狀態：</span>
                      <span className={`text-sm px-2 py-1 rounded ${processInfo.data.status === 'completed' ? 'bg-green-100  text-green-700 ' : 'bg-blue-100  text-blue-700 '}`}>
                        {processInfo.data.status === 'completed' ? '已完成' : '執行中'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600 ">嘗試：</span>
                      <span className="text-gray-800 ">{processInfo.data.attempt}/{processInfo.data.maxAttempts}</span>
                    </div>
                  </div>
                </div>
                
                {/* 工具結果（如果已完成） */}
                {processInfo.data.status === 'completed' && processInfo.data.result && (
                  <div>
                    <div className="font-medium text-gray-700  mb-2">📊 執行結果</div>
                    <div className="space-y-2 text-sm">
                      {processInfo.data.result.totalMatches !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600 ">找到：</span>
                          <span className="text-gray-800 ">{processInfo.data.result.totalMatches} 個結果</span>
                        </div>
                      )}
                      {processInfo.data.result.searchSummary && (
                        <div className="text-gray-600 ">
                          {processInfo.data.result.searchSummary}
                        </div>
                      )}
                      {processInfo.data.result.results && processInfo.data.result.results.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium text-gray-600  mb-1">結果預覽：</div>
                          <div className="space-y-1">
                            {processInfo.data.result.results.slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx} className="text-xs text-gray-500  p-1 bg-gray-50  rounded">
                                • {item.content || item.name || `項目 ${idx + 1}`}
                              </div>
                            ))}
                            {processInfo.data.result.results.length > 3 && (
                              <div className="text-xs text-gray-400 ">
                                還有 {processInfo.data.result.results.length - 3} 個結果...
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 顯示工具 Prompt（如果有） */}
                {processInfo.data.status === 'completed' && processInfo.data.prompt && (
                  <PromptDisplay prompts={[processInfo.data.prompt]} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Prompt 顯示元件
function PromptDisplay({ prompts }: { prompts: any[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!prompts || prompts.length === 0) return null;
  
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700   transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        🔍 Prompt ({prompts.length})
      </button>
      
      {isExpanded && (
        <div className="mt-1.5 space-y-1.5">
          {prompts.map((prompt, idx) => (
            <div key={idx} className="p-2.5 bg-gray-50  rounded-md border border-gray-200 ">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-blue-600 ">
                  {prompt.type}
                </span>
                <span className="text-xs text-gray-500 ">
                  {prompt.model}
                </span>
              </div>
              
              <div className="space-y-1.5">
                {prompt.messages?.map((message: any, msgIdx: number) => (
                  <div key={msgIdx} className="p-2 bg-white  rounded border">
                    <div className="text-xs font-medium text-gray-600  mb-1">
                      {message.role === 'system' ? '🤖 System' : '👤 User'}
                    </div>
                    <div className="text-xs text-gray-700  whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}