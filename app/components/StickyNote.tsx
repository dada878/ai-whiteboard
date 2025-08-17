'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StickyNote } from '../types';
import { useTheme } from '../contexts/ThemeContext';

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
  onAskAI?: () => void;
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
  onDragStart?: () => void;
  onDragEnd?: () => void;
  // AI loading 狀態
  isAILoading?: boolean;
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
  onAskAI,
  onStartConnection,
  onBatchColorChange,
  onBatchCopy,
  onBatchMove,
  onInitBatchDrag,
  onCreateGroup,
  onUngroupNotes,
  onMouseEnter,
  onMouseLeave,
  viewportToLogical,
  onDragStart,
  onDragEnd,
  isAILoading = false
}) => {
  const { isDarkMode } = useTheme();
  
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
  
  // 調整大小狀態
  const [resizeState, setResizeState] = useState<{
    isResizing: boolean;
    direction: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
  } | null>(null);
  
  // 記錄點擊時的選取狀態
  const [wasSelectedOnMouseDown, setWasSelectedOnMouseDown] = useState(false);
  
  // 中文輸入法狀態
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const element = textareaRef.current;
      
      // 只在內容為空或元素內容與狀態不同步時設置內容
      // 避免打斷正在進行的 IME 輸入
      if (!element.innerText && content) {
        element.innerText = content;
      }
      
      // 使用更長的延遲確保 DOM 完全更新並獲得焦點
      setTimeout(() => {
        // 防止在元素被刪除或組件卸載時執行 focus
        if (!element.isConnected) {
          return;
        }
        
        element.focus();
        
        // 確保元素真的獲得了焦點
        if (document.activeElement !== element && element.isConnected) {
          element.focus();
        }
        
        // 只在沒有選取範圍時設置光標位置（避免干擾用戶操作）
        const selection = window.getSelection();
        if (selection && selection.rangeCount === 0) {
          const range = document.createRange();
          
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
          
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, 50); // 增加延遲時間
    }
  }, [isEditing]); // 移除 content 依賴，避免每次內容更新都重設

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
          // 觸發拖曳開始事件
          if (onDragStart) {
            onDragStart();
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
      
      // 如果正在拖曳，觸發拖曳結束事件
      if (wasDragging && onDragEnd) {
        onDragEnd();
      }
      
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
  }, [dragState, viewportToLogical, onUpdate, isConnecting, isConnectTarget, isHoveredForConnection, isMultiSelected, isSelected, onInitBatchDrag, onBatchMove, onDragStart, onDragEnd, wasSelectedOnMouseDown]);

  // 全域調整大小處理
  useEffect(() => {
    if (!resizeState) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!resizeState.isResizing) return;

      // 計算視窗座標的位移
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      
      // 將視窗座標的位移轉換為邏輯座標的位移（考慮縮放）
      const logicalDeltaX = deltaX / zoomLevel;
      const logicalDeltaY = deltaY / zoomLevel;
      
      let newX = resizeState.initialX;
      let newY = resizeState.initialY;
      let newWidth = resizeState.initialWidth;
      let newHeight = resizeState.initialHeight;
      
      // 檢查是否按住 Shift 鍵（保持比例）
      const maintainAspectRatio = e.shiftKey;
      const aspectRatio = resizeState.initialWidth / resizeState.initialHeight;
      
      // 根據方向計算新的位置和尺寸
      switch (resizeState.direction) {
        case 'n': // 上
          newY = resizeState.initialY + logicalDeltaY;
          newHeight = resizeState.initialHeight - logicalDeltaY;
          if (maintainAspectRatio) {
            newWidth = newHeight * aspectRatio;
            const widthDiff = newWidth - resizeState.initialWidth;
            newX = resizeState.initialX - widthDiff / 2;
          }
          break;
        case 'ne': // 右上
          if (maintainAspectRatio) {
            // 使用對角線距離來計算縮放
            const diagonal = Math.sqrt(logicalDeltaX * logicalDeltaX + logicalDeltaY * logicalDeltaY);
            const signX = logicalDeltaX >= 0 ? 1 : -1;
            const signY = logicalDeltaY >= 0 ? -1 : 1;
            
            newWidth = resizeState.initialWidth + diagonal * signX;
            newHeight = newWidth / aspectRatio;
            newY = resizeState.initialY + resizeState.initialHeight - newHeight;
          } else {
            newY = resizeState.initialY + logicalDeltaY;
            newHeight = resizeState.initialHeight - logicalDeltaY;
            newWidth = resizeState.initialWidth + logicalDeltaX;
          }
          break;
        case 'e': // 右
          newWidth = resizeState.initialWidth + logicalDeltaX;
          if (maintainAspectRatio) {
            newHeight = newWidth / aspectRatio;
            const heightDiff = newHeight - resizeState.initialHeight;
            newY = resizeState.initialY - heightDiff / 2;
          }
          break;
        case 'se': // 右下
          if (maintainAspectRatio) {
            // 使用對角線距離來計算縮放
            const diagonal = Math.sqrt(logicalDeltaX * logicalDeltaX + logicalDeltaY * logicalDeltaY);
            const sign = (logicalDeltaX >= 0 && logicalDeltaY >= 0) ? 1 : -1;
            
            newWidth = resizeState.initialWidth + diagonal * sign;
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = resizeState.initialWidth + logicalDeltaX;
            newHeight = resizeState.initialHeight + logicalDeltaY;
          }
          break;
        case 's': // 下
          newHeight = resizeState.initialHeight + logicalDeltaY;
          if (maintainAspectRatio) {
            newWidth = newHeight * aspectRatio;
            const widthDiff = newWidth - resizeState.initialWidth;
            newX = resizeState.initialX - widthDiff / 2;
          }
          break;
        case 'sw': // 左下
          if (maintainAspectRatio) {
            // 使用對角線距離來計算縮放
            const diagonal = Math.sqrt(logicalDeltaX * logicalDeltaX + logicalDeltaY * logicalDeltaY);
            const signX = logicalDeltaX >= 0 ? -1 : 1;
            const signY = logicalDeltaY >= 0 ? 1 : -1;
            
            newWidth = resizeState.initialWidth + diagonal * signX;
            newHeight = newWidth / aspectRatio;
            newX = resizeState.initialX + resizeState.initialWidth - newWidth;
          } else {
            newX = resizeState.initialX + logicalDeltaX;
            newWidth = resizeState.initialWidth - logicalDeltaX;
            newHeight = resizeState.initialHeight + logicalDeltaY;
          }
          break;
        case 'w': // 左
          newX = resizeState.initialX + logicalDeltaX;
          newWidth = resizeState.initialWidth - logicalDeltaX;
          if (maintainAspectRatio) {
            newHeight = newWidth / aspectRatio;
            const heightDiff = newHeight - resizeState.initialHeight;
            newY = resizeState.initialY - heightDiff / 2;
          }
          break;
        case 'nw': // 左上
          if (maintainAspectRatio) {
            // 使用對角線距離來計算縮放
            const diagonal = Math.sqrt(logicalDeltaX * logicalDeltaX + logicalDeltaY * logicalDeltaY);
            const sign = (logicalDeltaX <= 0 && logicalDeltaY <= 0) ? 1 : -1;
            
            newWidth = resizeState.initialWidth + diagonal * sign;
            newHeight = newWidth / aspectRatio;
            newX = resizeState.initialX + resizeState.initialWidth - newWidth;
            newY = resizeState.initialY + resizeState.initialHeight - newHeight;
          } else {
            newX = resizeState.initialX + logicalDeltaX;
            newY = resizeState.initialY + logicalDeltaY;
            newWidth = resizeState.initialWidth - logicalDeltaX;
            newHeight = resizeState.initialHeight - logicalDeltaY;
          }
          break;
      }
      
      // 限制最小尺寸
      const minSize = 120;
      if (newWidth < minSize) {
        if (resizeState.direction.includes('w')) {
          newX = resizeState.initialX + resizeState.initialWidth - minSize;
        }
        newWidth = minSize;
      }
      if (newHeight < minSize) {
        if (resizeState.direction.includes('n')) {
          newY = resizeState.initialY + resizeState.initialHeight - minSize;
        }
        newHeight = minSize;
      }
      
      // 限制最大尺寸
      const maxSize = 500;
      newWidth = Math.min(newWidth, maxSize);
      newHeight = Math.min(newHeight, maxSize);
      
      onUpdate({ x: newX, y: newY, width: newWidth, height: newHeight });
    };

    const handleGlobalMouseUp = () => {
      setResizeState(null);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [resizeState, onUpdate, zoomLevel]);

  // 當 note.content 更新時，同步本地 content 狀態
  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

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

  // 開始調整大小
  const handleResizeStart = (e: React.MouseEvent, direction: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw') => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    setResizeState({
      isResizing: true,
      direction,
      startX,
      startY,
      initialX: note.x,
      initialY: note.y,
      initialWidth: note.width,
      initialHeight: note.height
    });
    
    onSelect();
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
      case 'askAI':
        if (onAskAI) {
          onAskAI();
        }
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
    const minSize = 14;
    const maxSize = 80;
    const defaultSize = 24;
    
    // 計算可用的內容區域（扣除 padding）
    const contentWidth = note.width - 24; // 左右 padding: 12px each
    const contentHeight = note.height - 24; // 上下 padding: 12px each
    
    const text = isEditing ? content : (note.content || '');
    
    if (!text) {
      // 沒有文字時使用預設字體
      return defaultSize;
    }
    
    // 計算總字符數（考慮中英文寬度）
    const totalChars = Array.from(text).reduce((count, char) => {
      // 中文、日文、韓文字符算作 1.5 個英文字符的寬度
      if (/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]/.test(char)) {
        return count + 1.5;
      }
      // 其他字符算作 1 個單位
      return count + 1;
    }, 0);
    
    // 使用預設字體大小計算每行大約可容納的字符數
    const charsPerLine = Math.floor(contentWidth / (defaultSize * 0.6));
    
    // 估算需要的行數（考慮手動換行）
    const manualLines = text.split('\n');
    let estimatedLines = 0;
    
    manualLines.forEach(line => {
      const lineChars = Array.from(line).reduce((count, char) => {
        if (/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]/.test(char)) {
          return count + 1.5;
        }
        return count + 1;
      }, 0);
      
      // 計算這一行需要幾行來顯示
      estimatedLines += Math.max(1, Math.ceil(lineChars / charsPerLine));
    });
    
    // 基於內容量計算字體大小
    let fontSize = defaultSize;
    
    // 如果內容很少，保持預設大小
    if (totalChars <= 10 && estimatedLines <= 2) {
      fontSize = defaultSize;
    }
    // 根據估算的行數調整字體大小
    else if (estimatedLines > 8) {
      fontSize = minSize;
    } else if (estimatedLines > 6) {
      fontSize = 16;
    } else if (estimatedLines > 4) {
      fontSize = 18;
    } else if (estimatedLines > 3) {
      fontSize = 20;
    } else {
      fontSize = defaultSize;
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
        className={`sticky-note absolute select-none touch-manipulation ${(isSelected || isPreviewSelected) ? 'z-20' : 'z-10'} ${
          dragState?.isDragging ? 'cursor-grabbing' : 'cursor-pointer'
        } ${isAILoading ? 'ai-loading-effect' : ''}`}
        data-note-id={note.id}
        style={{
          width: note.width,
          height: note.height,
          left: note.x,
          top: note.y
        }}
        onContextMenu={handleRightClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
          <div
            className={`w-full h-full rounded-lg shadow-lg border-2 transition-all ${
              isAILoading
                ? `shadow-2xl ring-4 ring-offset-2 ${
                    isDarkMode 
                      ? 'border-blue-400 ring-blue-400/50 ring-offset-gray-900 shadow-blue-400/30' 
                      : 'border-blue-500 ring-blue-400/60 ring-offset-white shadow-blue-400/40'
                  }`
                : dragState?.isDragging
                ? 'cursor-grabbing border-blue-500'
                : isConnecting 
                ? `shadow-xl ring-2 ${
                    isDarkMode ? 'border-green-400 ring-green-400/30' : 'border-green-500 ring-green-300'
                  }` 
                : isHoveredForConnection
                ? `shadow-xl ring-2 cursor-pointer ${
                    isDarkMode ? 'border-purple-900 ring-purple-900/20' : 'border-purple-500 ring-purple-300'
                  }`
                : isSelected 
                ? `shadow-xl ${
                    isDarkMode ? 'border-blue-900' : 'border-blue-500'
                  }` 
                : isPreviewSelected
                ? `shadow-lg border-dashed ${
                    isDarkMode ? 'border-blue-900' : 'border-blue-300'
                  }`
                : isDarkMode 
                ? 'border-gray-700'
                : 'border-gray-300'
            }`}
            style={{ 
              backgroundColor: isDarkMode 
                ? note.color + 'CC' // 在暗色模式下使用較高的不透明度
                : note.color,
              borderColor: dragState?.isDragging 
                ? undefined // 拖曳時不設定 borderColor，讓 className 的 border-blue-500 生效
                : isDarkMode && !isSelected && !isPreviewSelected && !isConnecting && !isHoveredForConnection
                ? COLORS.find(c => c.color === note.color)?.border + '60' // 暗色模式下邊框顏色更淡
                : undefined
            }}
          >
            
            {/* 內容區域 */}
            <div 
              className="w-full h-full p-3"
              style={{ 
                height: getContentHeight(),
                display: isEditing ? 'table' : 'flex',
                alignItems: isEditing ? undefined : 'center',
                justifyContent: isEditing ? undefined : 'center'
              }}
            >
              {isEditing ? (
                <div
                  ref={textareaRef as unknown as React.RefObject<HTMLDivElement>}
                  contentEditable="true"
                  suppressContentEditableWarning={true}
                  onInput={(e) => {
                    // 如果正在使用中文輸入法，不要更新內容
                    if (isComposing) return;
                    
                    const target = e.target as HTMLDivElement;
                    let newContent = target.innerText || '';
                    
                    // 移除零寬度空格
                    newContent = newContent.replace(/\u200B/g, '');
                    
                    // 保存當前光標位置
                    const selection = window.getSelection();
                    let cursorPosition = 0;
                    let anchorNode = null;
                    let anchorOffset = 0;
                    
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      anchorNode = range.startContainer;
                      anchorOffset = range.startOffset;
                      
                      // 計算光標在整個文本中的位置
                      const walker = document.createTreeWalker(
                        target,
                        NodeFilter.SHOW_TEXT,
                        null
                      );
                      
                      let node;
                      while (node = walker.nextNode()) {
                        if (node === anchorNode) {
                          cursorPosition += anchorOffset;
                          break;
                        }
                        cursorPosition += (node.textContent?.length || 0);
                      }
                    }
                    
                    setContent(newContent);
                    
                    // 恢復光標位置
                    requestAnimationFrame(() => {
                      if (!selection || !target.childNodes.length) return;
                      
                      const walker = document.createTreeWalker(
                        target,
                        NodeFilter.SHOW_TEXT,
                        null
                      );
                      
                      let currentPosition = 0;
                      let targetNode = null;
                      let targetOffset = 0;
                      let node;
                      
                      while (node = walker.nextNode()) {
                        const nodeLength = node.textContent?.length || 0;
                        if (currentPosition + nodeLength >= cursorPosition) {
                          targetNode = node;
                          targetOffset = cursorPosition - currentPosition;
                          break;
                        }
                        currentPosition += nodeLength;
                      }
                      
                      if (targetNode) {
                        const range = document.createRange();
                        range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent?.length || 0));
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                      }
                    });
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
                    
                    // 延遲更新內容，確保 IME 輸入已完成
                    setTimeout(() => {
                      const target = e.target as HTMLDivElement;
                      let newContent = target.innerText || '';
                      
                      // 移除零寬度空格
                      newContent = newContent.replace(/\u200B/g, '');
                      
                      setContent(newContent);
                    }, 0);
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
                  className="border-none outline-none bg-transparent text-gray-800 leading-relaxed cursor-text text-center contenteditable-placeholder"
                  style={{ 
                    fontSize: `${getAdaptiveFontSize()}px`,
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    textAlign: 'center',
                    minHeight: `${getAdaptiveFontSize()}px`,
                    padding: '0',
                    margin: '0',
                    width: '100%',
                    height: '100%',
                    display: 'table-cell',
                    verticalAlign: 'middle'
                  }}
                  data-placeholder={!content ? '點擊編輯...' : ''}
                />
              ) : (
                <div
                  className={`w-full h-full text-gray-800 overflow-y-auto leading-relaxed transition-all duration-200 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent ${
                    note.content && note.content.length > 100 
                      ? 'p-2' 
                      : 'flex items-center justify-center text-center'
                  } ${
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
                    overflowWrap: 'break-word',
                    textAlign: note.content && note.content.length > 100 ? 'left' : 'center'
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
                  className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
                </div>
                
                {/* 右方連接點 */}
                <div
                  className="absolute -right-10 top-1/2 transform -translate-y-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
                </div>
                
                {/* 下方連接點 */}
                <div
                  className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
                </div>
                
                {/* 左方連接點 */}
                <div
                  className="absolute -left-10 top-1/2 transform -translate-y-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartConnection();
                  }}
                  title="開始連接"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
                </div>
                
                {/* 調整大小控制點 - 八個方向 */}
                {/* 上 */}
                <div
                  className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-6 h-3 cursor-ns-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 'n');
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-1 bg-blue-500 rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
                  </div>
                </div>
                
                {/* 右上 */}
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 cursor-nesw-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 'ne');
                  }}
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-60 transition-opacity" />
                </div>
                
                {/* 右 */}
                <div
                  className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-3 h-6 cursor-ew-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 'e');
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1 h-8 bg-blue-500 rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
                  </div>
                </div>
                
                {/* 右下 */}
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 'se');
                  }}
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-60 transition-opacity" />
                </div>
                
                {/* 下 */}
                <div
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-3 cursor-ns-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 's');
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-1 bg-blue-500 rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
                  </div>
                </div>
                
                {/* 左下 */}
                <div
                  className="absolute -bottom-1 -left-1 w-3 h-3 cursor-nesw-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 'sw');
                  }}
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-60 transition-opacity" />
                </div>
                
                {/* 左 */}
                <div
                  className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-3 h-6 cursor-ew-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 'w');
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1 h-8 bg-blue-500 rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
                  </div>
                </div>
                
                {/* 左上 */}
                <div
                  className="absolute -top-1 -left-1 w-3 h-3 cursor-nwse-resize group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, 'nw');
                  }}
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-60 transition-opacity" />
                </div>
              </>
            )}
          </div>
        </div>

      {/* AI Loading 動畫覆蓋層 - 移除背景遮罩，只保留 spinner */}
      {isAILoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            {/* 主要的 loading spinner */}
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-200/50 rounded-full" />
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-blue-500 border-r-blue-500 rounded-full animate-spin" />
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse ${
              isDarkMode 
                ? 'text-blue-100 bg-blue-600/90' 
                : 'text-white bg-blue-500/90'
            }`}>
              ✨ AI 發想中
            </span>
          </div>
        </div>
      )}

      {/* 右鍵選單 - 使用 Portal 渲染到 body */}
      {showContextMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className={`context-menu fixed z-50 rounded-xl shadow-2xl border py-2 min-w-40 backdrop-blur-sm ${
              isDarkMode 
                ? 'bg-dark-bg-secondary border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
            style={{
              left: Math.min(menuPosition.x + 10, window.innerWidth - 200),
              top: Math.min(menuPosition.y + 10, window.innerHeight - 200),
            }}
          >
            <div className={`px-3 py-1 text-xs font-medium border-b mb-1 ${
              isDarkMode 
                ? 'text-gray-400 border-gray-700' 
                : 'text-gray-500 border-gray-100'
            }`}>
              {isMultiSelected ? '批量操作' : '便利貼操作'}
            </div>
            {!isMultiSelected && (
              <>
                <button
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                    isAILoading
                      ? isDarkMode
                        ? 'bg-blue-900/30 text-blue-400 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-600 cursor-not-allowed'
                      : isDarkMode 
                        ? 'text-gray-300 hover:bg-blue-900/30 hover:text-blue-400' 
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                  onClick={isAILoading ? undefined : () => handleContextMenuAction('ai')}
                  disabled={isAILoading}
                >
                  {isAILoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin text-base" />
                      <span>AI 發想中...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">🧠</span>
                      <span>AI 發想</span>
                    </>
                  )}
                </button>
                <button
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-purple-900/30 hover:text-purple-400' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                  onClick={() => handleContextMenuAction('askAI')}
                >
                  <span className="text-base">💬</span>
                  <span>詢問 AI</span>
                </button>
                <button
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-green-900/30 hover:text-green-400' 
                      : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                  }`}
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
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-orange-900/30 hover:text-orange-400' 
                      : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                  onClick={() => handleContextMenuAction('copy')}
                >
                  <span className="text-base">📋</span>
                  <span>複製選取項目</span>
                </button>
                <button
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-purple-900/30 hover:text-purple-400' 
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`}
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
                className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                  isDarkMode 
                    ? 'text-gray-300 hover:bg-indigo-900/30 hover:text-indigo-400' 
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
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
            <hr className={`my-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`} />
            <button
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                isDarkMode 
                  ? 'text-red-400 hover:bg-red-900/30' 
                  : 'text-red-600 hover:bg-red-50'
              }`}
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