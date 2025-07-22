'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StickyNote } from '../types';

interface StickyNoteComponentProps {
  note: StickyNote;
  isSelected: boolean;
  isSingleSelected?: boolean; // 是否為唯一選取的項目
  isMultiSelected?: boolean; // 是否為多選狀態
  isPreviewSelected?: boolean;
  isConnecting?: boolean;
  isConnectTarget?: boolean;
  isHoveredForConnection?: boolean;
  zoomLevel?: number;
  panOffset?: { x: number; y: number };
  autoEdit?: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<StickyNote>) => void;
  onDelete: () => void;
  onAIBrainstorm: () => void;
  onStartConnection: () => void;
  onBatchColorChange?: (color: string) => void; // 批量顏色變更
  onBatchCopy?: () => void; // 批量複製
  onBatchMove?: (deltaX: number, deltaY: number) => void; // 批量移動
  onInitBatchDrag?: () => void; // 初始化批量拖曳
  onCreateGroup?: () => void; // 建立群組
  onUngroupNotes?: () => void; // 取消群組
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  viewportToLogical?: (viewportX: number, viewportY: number) => { x: number; y: number };
}

const COLORS = [
  { color: '#FEF3C7', name: '溫暖黃', border: '#F59E0B' }, // 淺黃色背景，深黃色邊框
  { color: '#FCE7F3', name: '粉嫩紅', border: '#EC4899' }, // 淺粉色背景，深粉色邊框
  { color: '#DBEAFE', name: '清爽藍', border: '#3B82F6' }, // 淺藍色背景，深藍色邊框
  { color: '#D1FAE5', name: '自然綠', border: '#10B981' }, // 淺綠色背景，深綠色邊框
  { color: '#EDE9FE', name: '優雅紫', border: '#8B5CF6' }, // 淺紫色背景，深紫色邊框
  { color: '#FED7AA', name: '活力橙', border: '#F97316' }, // 淺橙色背景，深橙色邊框
  { color: '#F3F4F6', name: '簡潔灰', border: '#6B7280' }, // 淺灰色背景，深灰色邊框
  { color: '#FECACA', name: '溫暖紅', border: '#EF4444' }, // 淺紅色背景，深紅色邊框
];

const StickyNoteComponent: React.FC<StickyNoteComponentProps> = ({
  note,
  isSelected,
  isSingleSelected = false,
  isMultiSelected = false,
  isPreviewSelected = false,
  isConnecting = false,
  isConnectTarget = false,
  isHoveredForConnection = false,
  zoomLevel = 1,
  panOffset = { x: 0, y: 0 },
  autoEdit = false,
  onSelect,
  onUpdate,
  onDelete,
  onAIBrainstorm,
  onStartConnection,
  onBatchColorChange,
  onBatchCopy,
  onBatchMove,
  onInitBatchDrag,
  onCreateGroup,
  onUngroupNotes,
  onMouseEnter,
  onMouseLeave,
  viewportToLogical
}) => {
  // 狀態管理
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // 引用
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialNoteX: number;
    initialNoteY: number;
  } | null>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const element = textareaRef.current;
      
      // 設置內容
      element.innerText = content || '';
      
      // 使用更長的延遲確保 DOM 完全更新並獲得焦點
      setTimeout(() => {
        element.focus();
        
        // 確保元素真的獲得了焦點
        if (document.activeElement !== element) {
          element.focus();
        }
        
        // 設置光標位置
        const range = document.createRange();
        const selection = window.getSelection();
        
        if (element.childNodes.length > 0) {
          // 有內容時，將光標移到內容末尾
          const lastNode = element.childNodes[element.childNodes.length - 1];
          if (lastNode.nodeType === Node.TEXT_NODE) {
            range.setStart(lastNode, lastNode.textContent?.length || 0);
            range.setEnd(lastNode, lastNode.textContent?.length || 0);
          } else {
            range.selectNodeContents(element);
            range.collapse(false);
          }
        } else {
          // 沒有內容時，在元素內部設置光標
          range.setStart(element, 0);
          range.setEnd(element, 0);
        }
        
        selection?.removeAllRanges();
        selection?.addRange(range);
      }, 50); // 增加延遲時間
    }
  }, [isEditing, content]);

  // 自動編輯效果
  useEffect(() => {
    if (autoEdit && !isEditing) {
      setIsEditing(true);
    }
  }, [autoEdit, isEditing]);

  // 全域滑鼠移動處理
  useEffect(() => {
    if (!dragState || !viewportToLogical) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) {
        // 檢查是否超過拖曳閾值
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.hypot(dx, dy) > 5) {
          setDragState(prev => prev ? { ...prev, isDragging: true } : null);
          // 如果是多選狀態且當前便利貼被選中，初始化批量拖曳位置
          if (isMultiSelected && isSelected && onInitBatchDrag) {
            onInitBatchDrag();
          }
        }
        return;
      }

      // 計算位移
      const currentPos = viewportToLogical(e.clientX, e.clientY);
      const startPos = viewportToLogical(dragState.startX, dragState.startY);
      
      const deltaX = currentPos.x - startPos.x;
      const deltaY = currentPos.y - startPos.y;
      
      if (isMultiSelected && isSelected && onBatchMove) {
        // 多選狀態下且當前便利貼被選中時，使用批量移動
        onBatchMove(deltaX, deltaY);
      } else {
        // 單選狀態下，只移動當前便利貼
        const newX = dragState.initialNoteX + deltaX;
        const newY = dragState.initialNoteY + deltaY;
        onUpdate({ x: newX, y: newY });
      }
    };

    const handleGlobalMouseUp = () => {
      const wasDragging = dragState.isDragging;
      setDragState(null);
      
      // 如果沒有拖曳，檢查點擊前是否已選取來決定是否進入編輯模式
      if (!wasDragging && !isConnecting && !isConnectTarget && !isHoveredForConnection) {
        if (wasSelectedOnMouseDown) {
          // 點擊前已選取的便利貼，點擊後進入編輯模式
          setIsEditing(true);
        } else {
          // 點擊前未選取的便利貼，只進行選取（已在 handleMouseDown 中完成）
        }
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, viewportToLogical, onUpdate, isConnecting, isConnectTarget, isHoveredForConnection]);

  // 當 note.content 更新時，同步本地 content 狀態
  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  // 記錄點擊時的選取狀態
  const [wasSelectedOnMouseDown, setWasSelectedOnMouseDown] = useState(false);
  
  // 中文輸入法狀態
  const [isComposing, setIsComposing] = useState(false);

  // 滑鼠按下事件
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只處理左鍵
    if (isEditing) return; // 編輯模式不處理拖曳
    if (!viewportToLogical) return; // 需要轉換函數
    
    e.preventDefault();
    e.stopPropagation();
    
    // 記錄點擊時是否已選取
    setWasSelectedOnMouseDown(isSelected);
    
    // 開始拖曳狀態
    setDragState({
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY,
      initialNoteX: note.x,
      initialNoteY: note.y
    });
    
    // 選中便利貼
    onSelect();
  };


  const handleContentSave = () => {
    onUpdate({ content });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleContentSave();
    } else if (e.key === 'Enter') {
      // 讓純 Enter 正常換行，不做任何處理
      // contentEditable 會自動處理換行
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setContent(note.content);
      setIsEditing(false);
    }
  };

  const handleColorChange = (colorObj: { color: string; border: string }) => {
    if (isMultiSelected && onBatchColorChange) {
      // 批量變更顏色
      onBatchColorChange(colorObj.color);
    } else {
      // 單個變更顏色
      onUpdate({ color: colorObj.color });
    }
    setShowContextMenu(false); // 關閉右鍵選單
  };

  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 使用滑鼠的實際屏幕位置（不受縮放影響）
    setMenuPosition({
      x: e.clientX,
      y: e.clientY
    });
    
    setShowContextMenu(true);
    
    // 如果不是多選狀態或目前便利貼未被選取，才執行選取
    if (!isMultiSelected || !isSelected) {
      onSelect();
    }
  };

  const handleContextMenuAction = (action: string) => {
    setShowContextMenu(false);
    switch (action) {
      case 'ai':
        onAIBrainstorm();
        break;
      case 'connect':
        onStartConnection();
        break;
      case 'copy':
        if (isMultiSelected && onBatchCopy) {
          onBatchCopy();
        }
        break;
      case 'group':
        if (isMultiSelected && onCreateGroup) {
          onCreateGroup();
        }
        break;
      case 'ungroup':
        if (onUngroupNotes) {
          onUngroupNotes();
        }
        break;
      case 'delete':
        onDelete();
        break;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 雙擊直接進入編輯模式
    if (!isConnecting && !isConnectTarget && !isHoveredForConnection) {
      onSelect(); // 確保選取狀態
      setIsEditing(true);
    }
  };

  // 根據便利貼大小和文字排列計算自適應字體大小
  const getAdaptiveFontSize = () => {
    const minSize = 16;
    const maxSize = 120;
    
    // 計算可用的內容區域（扣除 padding）
    const contentWidth = note.width - 24; // 左右 padding: 12px each
    const contentHeight = note.height - 24; // 上下 padding: 12px each
    
    const text = isEditing ? content : (note.content || '');
    
    if (!text) {
      // 沒有文字時使用大字體
      return Math.min(Math.max(contentWidth * 0.4, minSize), maxSize);
    }
    
    // 分割成行
    const lines = text.split('\n');
    const lineCount = lines.length;
    
    // 計算每行的字符數（考慮中英文寬度）
    const lineLengths = lines.map(line => {
      return Array.from(line).reduce((count, char) => {
        // 中文、日文、韓文字符算作 2 個英文字符的寬度
        if (/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]/.test(char)) {
          return count + 2;
        }
        // 其他字符算作 1 個單位
        return count + 1;
      }, 0);
    });
    
    // 找出最長的行
    const maxLineLength = Math.max(...lineLengths, 1);
    
    // 使用 max(行數, 單行最多字數) 作為限制因子
    const limitingFactor = Math.max(lineCount, maxLineLength);
    
    // 基於限制因子計算字體大小
    let fontSize;
    
    if (limitingFactor <= 1) {
      // 1個字符或1行很短的文字：超大
      fontSize = Math.min(contentWidth * 0.8, contentHeight * 0.8);
    } else if (limitingFactor <= 2) {
      // 2個字符或2行：很大
      fontSize = Math.min(contentWidth * 0.6, contentHeight * 0.4);
    } else if (limitingFactor <= 4) {
      // 3-4個字符或3-4行：大
      fontSize = Math.min(contentWidth * 0.4, contentHeight * 0.25);
    } else if (limitingFactor <= 8) {
      // 5-8個字符或5-8行：中等
      fontSize = Math.min(contentWidth * 0.2, contentHeight * 0.15);
    } else if (limitingFactor <= 15) {
      // 9-15個字符或9-15行：偏小
      fontSize = Math.min(contentWidth * 0.12, contentHeight * 0.08);
    } else {
      // 更多字符或行數：小字體
      fontSize = Math.min(contentWidth * 0.08, contentHeight * 0.05);
    }
    
    // 確保字體大小在合理範圍內
    return Math.min(Math.max(fontSize, minSize), maxSize);
  };

  // 計算內容區域高度
  const getContentHeight = () => {
    return note.height; // 使用完整高度
  };

  return (
    <>
      <div
        ref={nodeRef}
        className={`sticky-note absolute select-none ${(isSelected || isPreviewSelected) ? 'z-20' : 'z-10'} ${
          dragState?.isDragging ? 'cursor-grabbing' : 'cursor-pointer'
        }`}
        data-note-id={note.id}
        style={{
          width: note.width,
          height: note.height,
          left: note.x,
          top: note.y,
        }}
        onContextMenu={handleRightClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
          <div
            className={`w-full h-full rounded-lg shadow-lg border-2 transition-all ${
              dragState?.isDragging
                ? 'cursor-grabbing'
                : isConnecting 
                ? 'border-green-500 shadow-xl ring-2 ring-green-300' 
                : isHoveredForConnection
                ? 'border-purple-500 shadow-xl ring-2 ring-purple-300 cursor-pointer'
                : isSelected 
                ? 'border-blue-500 shadow-xl' 
                : isPreviewSelected
                ? 'border-blue-300 shadow-lg border-dashed'
                : 'border-gray-300'
            }`}
            style={{ backgroundColor: note.color }}
          >
            
            {/* 內容區域 */}
            <div 
              className="w-full h-full p-3"
              style={{ 
                height: getContentHeight(),
                display: isEditing ? 'table' : 'flex',
                alignItems: isEditing ? 'unset' : 'center',
                justifyContent: isEditing ? 'unset' : 'center'
              }}
            >
              {isEditing ? (
                <div
                  ref={textareaRef as any}
                  contentEditable="true"
                  suppressContentEditableWarning={true}
                  onInput={(e) => {
                    // 如果正在使用中文輸入法，不要更新內容
                    if (isComposing) return;
                    
                    const target = e.target as HTMLDivElement;
                    let newContent = target.innerText || '';
                    
                    // 移除零寬度空格
                    newContent = newContent.replace(/\u200B/g, '');
                    
                    setContent(newContent);
                  }}
                  onCompositionStart={() => {
                    // 開始中文輸入法組成
                    setIsComposing(true);
                  }}
                  onCompositionUpdate={() => {
                    // 中文輸入法組成中
                    setIsComposing(true);
                  }}
                  onCompositionEnd={(e) => {
                    // 中文輸入法組成完成
                    setIsComposing(false);
                    
                    // 手動觸發內容更新
                    const target = e.target as HTMLDivElement;
                    let newContent = target.innerText || '';
                    
                    // 移除零寬度空格
                    newContent = newContent.replace(/\u200B/g, '');
                    
                    setContent(newContent);
                  }}
                  onBlur={handleContentSave}
                  onKeyDown={handleKeyDown}
                  onMouseDown={(e) => {
                    // 阻止事件傳播到父元素，避免觸發拖曳
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    // 阻止事件傳播，確保正常的文字選取功能
                    e.stopPropagation();
                  }}
                  onMouseUp={(e) => {
                    // 阻止事件傳播
                    e.stopPropagation();
                  }}
                  className="w-full h-full border-none outline-none bg-transparent text-gray-800 leading-relaxed cursor-text text-center contenteditable-placeholder"
                  style={{ 
                    fontSize: `${getAdaptiveFontSize()}px`,
                    lineHeight: '1.2',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    textAlign: 'center',
                    width: '100%',
                    height: '100%',
                    padding: '0',
                    margin: '0'
                  }}
                  data-placeholder={!content ? '點擊編輯...' : ''}
                />
              ) : (
                <div
                  className={`w-full h-full text-gray-800 overflow-hidden leading-relaxed transition-all duration-200 flex items-center justify-center text-center ${
                    dragState?.isDragging 
                      ? 'cursor-grabbing' 
                      : isHoveredForConnection 
                        ? 'cursor-pointer' 
                        : 'cursor-pointer'
                  }`}
                  style={{ 
                    fontSize: `${getAdaptiveFontSize()}px`,
                    lineHeight: '1.2',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                  onDoubleClick={handleDoubleClick}
                >
                  {note.content || (
                    <span className="text-gray-500 text-2xl">點擊編輯...</span>
                  )}
                </div>
              )}
              
            </div>

            {/* 連接點 */}
            {isSelected && isSingleSelected && !isEditing && (
              <>
                {/* 上方連接點 */}
                <div
                  className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-8 h-8 cursor-pointer flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md hover:bg-green-600 hover:scale-110 transition-all" />
                </div>
                
                {/* 右方連接點 */}
                <div
                  className="absolute -right-6 top-1/2 transform -translate-y-1/2 w-8 h-8 cursor-pointer flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md hover:bg-green-600 hover:scale-110 transition-all" />
                </div>
                
                {/* 下方連接點 */}
                <div
                  className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-8 h-8 cursor-pointer flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md hover:bg-green-600 hover:scale-110 transition-all" />
                </div>
                
                {/* 左方連接點 */}
                <div
                  className="absolute -left-6 top-1/2 transform -translate-y-1/2 w-8 h-8 cursor-pointer flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md hover:bg-green-600 hover:scale-110 transition-all" />
                </div>
                
                {/* 調整大小控制點 */}
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 調整大小邏輯將在後續實現
                  }}
                >
                  <div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-500 rounded-sm opacity-60"></div>
                </div>
              </>
            )}
          </div>
        </div>

      {/* 右鍵選單 - 使用 Portal 渲染到 body */}
      {showContextMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="context-menu fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-40 backdrop-blur-sm"
            style={{
              left: Math.min(menuPosition.x + 10, window.innerWidth - 200),
              top: Math.min(menuPosition.y + 10, window.innerHeight - 200),
            }}
          >
            <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b border-gray-100 mb-1">
              {isMultiSelected ? '批量操作' : '便利貼操作'}
            </div>
            {!isMultiSelected && (
              <>
                <button
                  className="w-full px-4 py-2.5 text-left hover:bg-blue-50 text-sm flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
                  onClick={() => handleContextMenuAction('ai')}
                >
                  <span className="text-base">🧠</span>
                  <span>AI 發想</span>
                </button>
                <button
                  className="w-full px-4 py-2.5 text-left hover:bg-green-50 text-sm flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors"
                  onClick={() => handleContextMenuAction('connect')}
                >
                  <span className="text-base">🔗</span>
                  <span>開始連線</span>
                </button>
              </>
            )}
            {isMultiSelected && (
              <>
                <button
                  className="w-full px-4 py-2.5 text-left hover:bg-orange-50 text-sm flex items-center gap-2 text-gray-700 hover:text-orange-600 transition-colors"
                  onClick={() => handleContextMenuAction('copy')}
                >
                  <span className="text-base">📋</span>
                  <span>複製選取項目</span>
                </button>
                <button
                  className="w-full px-4 py-2.5 text-left hover:bg-purple-50 text-sm flex items-center gap-2 text-gray-700 hover:text-purple-600 transition-colors"
                  onClick={() => handleContextMenuAction('group')}
                >
                  <span className="text-base">📦</span>
                  <span>建立群組</span>
                </button>
              </>
            )}
            {/* 如果便利貼屬於群組，顯示取消群組選項 */}
            {note.groupId && (
              <button
                className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 text-sm flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition-colors"
                onClick={() => handleContextMenuAction('ungroup')}
              >
                <span className="text-base">📂</span>
                <span>取消群組</span>
              </button>
            )}
            {/* 顏色選擇區域 */}
            <div className="px-3 py-2">
              <div className="grid grid-cols-4 gap-1.5">
                {COLORS.map((colorObj, index) => (
                  <button
                    key={index}
                    className="w-6 h-6 rounded border-2 hover:scale-110 transition-all shadow-sm hover:shadow-md"
                    style={{ 
                      backgroundColor: colorObj.color,
                      borderColor: note.color === colorObj.color ? colorObj.border : '#D1D5DB'
                    }}
                    onClick={() => handleColorChange(colorObj)}
                    title={colorObj.name}
                  >
                    {note.color === colorObj.color && (
                      <div className="flex items-center justify-center w-full h-full">
                        <span className="text-xs font-bold text-gray-700">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <hr className="my-1 border-gray-100" />
            <button
              className="w-full px-4 py-2.5 text-left hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors"
              onClick={() => handleContextMenuAction('delete')}
            >
              <span className="text-base">🗑️</span>
              <span>刪除</span>
            </button>
          </div>
        </>,
        document.body
      )}

    </>
  );
};

export default StickyNoteComponent;