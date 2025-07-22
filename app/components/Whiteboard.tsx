'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { StickyNote, Edge, Group, WhiteboardData, NetworkAnalysis, NetworkConnection } from '../types';
import StickyNoteComponent from './StickyNote';
import EdgeComponent from './Edge';
import GroupComponent from './Group';
import FloatingToolbar from './FloatingToolbar';
import SidePanel from './SidePanel';
import { StorageService } from '../services/storageService';

const Whiteboard: React.FC = () => {
  const [whiteboardData, setWhiteboardData] = useState<WhiteboardData>({
    notes: [],
    edges: [],
    groups: []
  });
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  // 歷史記錄系統
  const [history, setHistory] = useState<WhiteboardData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [clipboard, setClipboard] = useState<StickyNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]); // 多選便利貼
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null); // 選中的群組
  const [autoEditNoteId, setAutoEditNoteId] = useState<string | null>(null); // 需要自動編輯的便利貼 ID
  const [previewSelectedNotes, setPreviewSelectedNotes] = useState<string[]>([]); // 框選預覽
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string>('');
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  // 拖曳選取相關狀態
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomCenter, setZoomCenter] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 3;

  // 歷史記錄相關函數
  const saveToHistory = useCallback((data: WhiteboardData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(data))); // 深複製
      // 限制歷史記錄數量（最多50個）
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevData = history[historyIndex - 1];
      setWhiteboardData(prevData);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setWhiteboardData(nextData);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  const copySelectedNotes = useCallback(() => {
    const notesToCopy = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id) || note.id === selectedNote
    );
    if (notesToCopy.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(notesToCopy))); // 深複製
    }
  }, [whiteboardData.notes, selectedNotes, selectedNote]);

  const pasteNotes = useCallback(() => {
    if (clipboard.length > 0) {
      saveToHistory(whiteboardData);
      const newNotes = clipboard.map(note => ({
        ...note,
        id: uuidv4(),
        x: note.x + 20, // 稍微偏移避免完全重疊
        y: note.y + 20
      }));
      
      setWhiteboardData(prev => ({
        ...prev,
        notes: [...prev.notes, ...newNotes]
      }));
      
      // 選中新貼上的便利貼
      setSelectedNotes(newNotes.map(note => note.id));
      setSelectedNote(null);
    }
  }, [clipboard, whiteboardData, saveToHistory]);

  const duplicateSelectedNotes = useCallback(() => {
    const notesToDuplicate = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id) || note.id === selectedNote
    );
    if (notesToDuplicate.length > 0) {
      saveToHistory(whiteboardData);
      const newNotes = notesToDuplicate.map(note => ({
        ...note,
        id: uuidv4(),
        x: note.x + 20,
        y: note.y + 20
      }));
      
      setWhiteboardData(prev => ({
        ...prev,
        notes: [...prev.notes, ...newNotes]
      }));
      
      // 選中新複製的便利貼
      setSelectedNotes(newNotes.map(note => note.id));
      setSelectedNote(null);
    }
  }, [whiteboardData, selectedNotes, selectedNote, saveToHistory]);

  const selectAllNotes = useCallback(() => {
    const allNoteIds = whiteboardData.notes.map(note => note.id);
    setSelectedNotes(allNoteIds);
    setSelectedNote(null);
  }, [whiteboardData.notes]);

  const deleteSelectedItems = useCallback(() => {
    if (selectedNotes.length > 0 || selectedNote) {
      saveToHistory(whiteboardData);
      const notesToDelete = selectedNote ? [selectedNote] : selectedNotes;
      
      setWhiteboardData(prev => ({
        notes: prev.notes.filter(note => !notesToDelete.includes(note.id)),
        edges: prev.edges.filter(edge => 
          !notesToDelete.includes(edge.from) && !notesToDelete.includes(edge.to)
        )
      }));
      
      setSelectedNotes([]);
      setSelectedNote(null);
    } else if (selectedEdge) {
      saveToHistory(whiteboardData);
      setWhiteboardData(prev => ({
        ...prev,
        edges: prev.edges.filter(edge => edge.id !== selectedEdge)
      }));
      setSelectedEdge(null);
    }
  }, [selectedNotes, selectedNote, selectedEdge, whiteboardData, saveToHistory]);

  const moveSelectedNotes = useCallback((deltaX: number, deltaY: number) => {
    const notesToMove = selectedNote ? [selectedNote] : selectedNotes;
    if (notesToMove.length > 0) {
      setWhiteboardData(prev => ({
        ...prev,
        notes: prev.notes.map(note => 
          notesToMove.includes(note.id)
            ? { ...note, x: note.x + deltaX, y: note.y + deltaY }
            : note
        )
      }));
    }
  }, [selectedNote, selectedNotes]);

  // 批量變更顏色
  const handleBatchColorChange = useCallback((color: string) => {
    if (selectedNotes.length > 0) {
      saveToHistory(whiteboardData);
      setWhiteboardData(prev => ({
        ...prev,
        notes: prev.notes.map(note => 
          selectedNotes.includes(note.id)
            ? { ...note, color }
            : note
        )
      }));
    }
  }, [selectedNotes, whiteboardData, saveToHistory]);

  // 批量複製
  const handleBatchCopy = useCallback(() => {
    if (selectedNotes.length > 0) {
      copySelectedNotes();
    }
  }, [selectedNotes, copySelectedNotes]);

  // 群組管理功能
  const createGroup = useCallback((noteIds: string[]) => {
    if (noteIds.length < 2) return null;
    
    saveToHistory(whiteboardData);
    const groupId = uuidv4();
    const groupColors = ['#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0', '#FCE4EC'];
    const randomColor = groupColors[Math.floor(Math.random() * groupColors.length)];
    
    const newGroup: Group = {
      id: groupId,
      name: `群組 ${(whiteboardData.groups || []).length + 1}`,
      color: randomColor,
      createdAt: new Date(),
      noteIds: noteIds
    };

    setWhiteboardData(prev => ({
      ...prev,
      groups: [...(prev.groups || []), newGroup],
      notes: prev.notes.map(note => 
        noteIds.includes(note.id) 
          ? { ...note, groupId }
          : note
      )
    }));

    setSelectedGroup(groupId);
    setSelectedNotes([]);
    setSelectedNote(null);
    
    return groupId;
  }, [whiteboardData, saveToHistory]);

  const ungroupNotes = useCallback((groupId: string) => {
    saveToHistory(whiteboardData);
    const group = (whiteboardData.groups || []).find(g => g.id === groupId);
    if (!group) return;

    setWhiteboardData(prev => ({
      ...prev,
      groups: (prev.groups || []).filter(g => g.id !== groupId),
      notes: prev.notes.map(note => 
        note.groupId === groupId 
          ? { ...note, groupId: undefined }
          : note
      )
    }));

    // 取消群組後選中原本群組內的便利貼
    setSelectedNotes(group.noteIds);
    setSelectedGroup(null);
  }, [whiteboardData, saveToHistory]);

  const getGroupNotes = useCallback((groupId: string): StickyNote[] => {
    return whiteboardData.notes.filter(note => note.groupId === groupId);
  }, [whiteboardData.notes]);

  const getGroupBounds = useCallback((groupId: string) => {
    const groupNotes = getGroupNotes(groupId);
    if (groupNotes.length === 0) return null;

    const minX = Math.min(...groupNotes.map(note => note.x));
    const minY = Math.min(...groupNotes.map(note => note.y));
    const maxX = Math.max(...groupNotes.map(note => note.x + note.width));
    const maxY = Math.max(...groupNotes.map(note => note.y + note.height));

    return {
      x: minX - 10,
      y: minY - 10,
      width: maxX - minX + 20,
      height: maxY - minY + 20
    };
  }, [getGroupNotes]);

  const updateGroupName = useCallback((groupId: string, newName: string) => {
    saveToHistory(whiteboardData);
    setWhiteboardData(prev => ({
      ...prev,
      groups: (prev.groups || []).map(group => 
        group.id === groupId 
          ? { ...group, name: newName }
          : group
      )
    }));
  }, [whiteboardData, saveToHistory]);

  const updateGroupColor = useCallback((groupId: string, newColor: string) => {
    saveToHistory(whiteboardData);
    setWhiteboardData(prev => ({
      ...prev,
      groups: (prev.groups || []).map(group => 
        group.id === groupId 
          ? { ...group, color: newColor }
          : group
      )
    }));
  }, [whiteboardData, saveToHistory]);

  const deleteGroup = useCallback((groupId: string) => {
    saveToHistory(whiteboardData);
    const group = (whiteboardData.groups || []).find(g => g.id === groupId);
    if (!group) return;

    // 刪除群組內的所有便利貼和相關連線
    const noteIdsToDelete = group.noteIds;
    const edgesToDelete = whiteboardData.edges.filter(edge => 
      noteIdsToDelete.includes(edge.from) || noteIdsToDelete.includes(edge.to)
    );

    setWhiteboardData(prev => ({
      ...prev,
      notes: prev.notes.filter(note => !noteIdsToDelete.includes(note.id)),
      edges: prev.edges.filter(edge => !edgesToDelete.includes(edge)),
      groups: (prev.groups || []).filter(g => g.id !== groupId)
    }));

    setSelectedGroup(null);
  }, [whiteboardData, saveToHistory]);

  // 用於記錄多選拖曳的初始位置
  const [batchDragInitialPositions, setBatchDragInitialPositions] = useState<{[key: string]: {x: number, y: number}}>({});
  const [groupDragState, setGroupDragState] = useState<{
    isDragging: boolean;
    groupId: string;
    startX: number;
    startY: number;
    initialPositions: {[key: string]: {x: number, y: number}};
  } | null>(null);

  // 初始化批量拖曳位置
  const initBatchDragPositions = useCallback(() => {
    if (selectedNotes.length > 0) {
      const positions: {[key: string]: {x: number, y: number}} = {};
      selectedNotes.forEach(noteId => {
        const note = whiteboardData.notes.find(n => n.id === noteId);
        if (note) {
          positions[noteId] = { x: note.x, y: note.y };
        }
      });
      setBatchDragInitialPositions(positions);
    }
  }, [selectedNotes, whiteboardData.notes]);

  // 批量移動
  const handleBatchMove = useCallback((deltaX: number, deltaY: number) => {
    if (selectedNotes.length > 0) {
      setWhiteboardData(prev => ({
        ...prev,
        notes: prev.notes.map(note => {
          if (selectedNotes.includes(note.id)) {
            const initialPos = batchDragInitialPositions[note.id];
            if (initialPos) {
              return {
                ...note,
                x: initialPos.x + deltaX,
                y: initialPos.y + deltaY
              };
            }
          }
          return note;
        })
      }));
    }
  }, [selectedNotes, batchDragInitialPositions]);

  // 處理群組拖曳
  const handleGroupDrag = useCallback((groupId: string, deltaX: number, deltaY: number) => {
    if (!groupDragState || groupDragState.groupId !== groupId) return;
    
    setWhiteboardData(prev => ({
      ...prev,
      notes: prev.notes.map(note => {
        if (note.groupId === groupId) {
          const initialPos = groupDragState.initialPositions[note.id];
          if (initialPos) {
            return {
              ...note,
              x: initialPos.x + deltaX,
              y: initialPos.y + deltaY
            };
          }
        }
        return note;
      })
    }));
  }, [groupDragState]);

  // 載入儲存的資料
  useEffect(() => {
    const savedData = StorageService.loadWhiteboardData();
    if (savedData && (savedData.notes.length > 0 || savedData.edges.length > 0)) {
      // 確保 groups 陣列存在
      const dataWithGroups = {
        ...savedData,
        groups: savedData.groups || []
      };
      setWhiteboardData(dataWithGroups);
      setLastSaveTime(StorageService.getLastSaveTime());
      
      // 恢復視窗狀態
      if (savedData.viewport) {
        setZoomLevel(savedData.viewport.zoomLevel);
        setPanOffset(savedData.viewport.panOffset);
      }
      
      // 初始化歷史記錄
      setHistory([dataWithGroups]);
      setHistoryIndex(0);
    } else {
      // 沒有儲存資料時，初始化空的歷史記錄
      const initialData = { notes: [], edges: [], groups: [] };
      setHistory([initialData]);
      setHistoryIndex(0);
    }
  }, []);

  // 初始化畫布位置到中央（僅在沒有保存的視窗狀態時）
  useEffect(() => {
    if (canvasRef.current) {
      const savedData = StorageService.loadWhiteboardData();
      // 只有在沒有保存的視窗狀態時才設置預設位置
      if (!savedData?.viewport) {
        const canvas = canvasRef.current;
        // 將畫布定位到一個合理的初始位置
        // 由於畫布非常大，我們將視窗對準到 (0,0) 附近
        setPanOffset({ x: 100, y: 100 });
      }
    }
  }, []);

  // 清理定時器
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // 自動儲存 - 每當白板資料變更時
  useEffect(() => {
    // 防止初始載入時觸發儲存
    if (whiteboardData.notes.length === 0 && whiteboardData.edges.length === 0) {
      return;
    }

    // 使用 debounce 避免頻繁儲存
    const saveTimer = setTimeout(() => {
      const viewport = { zoomLevel, panOffset };
      StorageService.saveWhiteboardData(whiteboardData, viewport);
      setLastSaveTime(new Date());
    }, 1000); // 1秒後儲存

    return () => clearTimeout(saveTimer);
  }, [whiteboardData, zoomLevel, panOffset]);

  // 鍵盤快捷鍵處理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 檢查是否在輸入元素中，如果是則不處理快捷鍵
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.contentEditable === 'true') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      // 撤銷 (Ctrl/Cmd + Z)
      if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // 重做 (Ctrl/Cmd + Y 或 Ctrl/Cmd + Shift + Z)
      if ((isCtrlOrCmd && event.key === 'y') || (isCtrlOrCmd && event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
        return;
      }

      // 全選 (Ctrl/Cmd + A)
      if (isCtrlOrCmd && event.key === 'a') {
        event.preventDefault();
        selectAllNotes();
        return;
      }

      // 複製 (Ctrl/Cmd + C)
      if (isCtrlOrCmd && event.key === 'c') {
        event.preventDefault();
        copySelectedNotes();
        return;
      }

      // 貼上 (Ctrl/Cmd + V)
      if (isCtrlOrCmd && event.key === 'v') {
        event.preventDefault();
        pasteNotes();
        return;
      }

      // 快速複製 (Ctrl/Cmd + D)
      if (isCtrlOrCmd && event.key === 'd') {
        event.preventDefault();
        duplicateSelectedNotes();
        return;
      }

      // 建立群組 (Ctrl/Cmd + G)
      if (isCtrlOrCmd && (event.key === 'g' || event.key === 'G') && !event.shiftKey) {
        event.preventDefault();
        if (selectedNotes.length >= 2) {
          createGroup(selectedNotes);
        }
        return;
      }

      // 取消群組 (Ctrl/Cmd + Shift + G)
      if (isCtrlOrCmd && (event.key === 'g' || event.key === 'G') && event.shiftKey) {
        event.preventDefault();
        if (selectedGroup) {
          ungroupNotes(selectedGroup);
        } else if (selectedNotes.length === 1) {
          // 如果只選中一個便利貼，檢查它是否屬於某個群組
          const note = whiteboardData.notes.find(n => n.id === selectedNotes[0]);
          if (note?.groupId) {
            ungroupNotes(note.groupId);
          }
        }
        return;
      }

      // 刪除 (Delete 或 Backspace)
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedItems();
        return;
      }

      // 取消選擇 (Escape)
      if (event.key === 'Escape') {
        setSelectedNote(null);
        setSelectedNotes([]);
        setSelectedEdge(null);
        return;
      }

      // 方向鍵移動選中的便利貼
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const notesToMove = selectedNote ? [selectedNote] : selectedNotes;
        if (notesToMove.length > 0) {
          event.preventDefault();
          const step = event.shiftKey ? 20 : 5; // Shift + 方向鍵移動更快
          let deltaX = 0, deltaY = 0;
          
          switch (event.key) {
            case 'ArrowUp':
              deltaY = -step;
              break;
            case 'ArrowDown':
              deltaY = step;
              break;
            case 'ArrowLeft':
              deltaX = -step;
              break;
            case 'ArrowRight':
              deltaX = step;
              break;
          }
          
          moveSelectedNotes(deltaX, deltaY);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectAllNotes, copySelectedNotes, pasteNotes, duplicateSelectedNotes, deleteSelectedItems, moveSelectedNotes, selectedNote, selectedNotes, createGroup, ungroupNotes, selectedGroup, whiteboardData.notes]);

  const addStickyNote = useCallback((x: number, y: number) => {
    saveToHistory(whiteboardData); // 保存歷史記錄

    const newNote: StickyNote = {
      id: uuidv4(),
      x,
      y,
      width: 200,
      height: 200,
      content: '',
      color: '#FEF3C7'
    };

    setWhiteboardData(prev => ({
      ...prev,
      notes: [...prev.notes, newNote]
    }));

    // 自動選中新建的便利貼並進入編輯模式
    setSelectedNote(newNote.id);
    setSelectedNotes([]);
    // 用一個狀態標記需要自動編輯的便利貼
    setAutoEditNoteId(newNote.id);
  }, [whiteboardData, saveToHistory]);

  const updateStickyNote = useCallback((id: string, updates: Partial<StickyNote>) => {
    setWhiteboardData(prev => ({
      ...prev,
      notes: prev.notes.map(note => 
        note.id === id ? { ...note, ...updates } : note
      )
    }));
  }, []);

  const deleteStickyNote = useCallback((id: string) => {
    saveToHistory(whiteboardData); // 保存歷史記錄
    
    setWhiteboardData(prev => {
      // 找到被刪除便利貼所屬的群組
      const deletedNote = prev.notes.find(note => note.id === id);
      const groupId = deletedNote?.groupId;
      
      // 更新群組的 noteIds
      const updatedGroups = groupId 
        ? (prev.groups || []).map(group => 
            group.id === groupId 
              ? { ...group, noteIds: group.noteIds.filter(noteId => noteId !== id) }
              : group
          ).filter(group => group.noteIds.length > 0) // 移除空群組
        : (prev.groups || []);
      
      return {
        ...prev,
        notes: prev.notes.filter(note => note.id !== id),
        edges: prev.edges.filter(edge => edge.from !== id && edge.to !== id),
        groups: updatedGroups
      };
    });
  }, [whiteboardData, saveToHistory]);

  const deleteEdge = useCallback((id: string) => {
    saveToHistory(whiteboardData); // 保存歷史記錄
    
    setWhiteboardData(prev => ({
      ...prev,
      edges: prev.edges.filter(edge => edge.id !== id)
    }));
    setSelectedEdge(null);
  }, [whiteboardData, saveToHistory]);

  const addEdge = useCallback((fromId: string, toId: string) => {
    // 避免重複連線和自己連自己
    if (fromId === toId) return;
    
    const existingEdge = whiteboardData.edges.find(
      edge => edge.from === fromId && edge.to === toId
    );
    if (existingEdge) return;

    saveToHistory(whiteboardData); // 保存歷史記錄

    const newEdge: Edge = {
      id: uuidv4(),
      from: fromId,
      to: toId
    };

    setWhiteboardData(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge]
    }));
  }, [whiteboardData, saveToHistory]);

  // 坐標轉換輔助函數 - 將視口座標轉換為邏輯座標
  const viewportToLogical = useCallback((viewportX: number, viewportY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = viewportX - rect.left;
    const canvasY = viewportY - rect.top;
    
    // 考慮縮放和平移
    const logicalX = (canvasX - panOffset.x) / zoomLevel;
    const logicalY = (canvasY - panOffset.y) / zoomLevel;
    
    return { x: logicalX, y: logicalY };
  }, [zoomLevel, panOffset]);

  // 處理群組拖曳的全域滑鼠事件
  useEffect(() => {
    if (!groupDragState) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const currentPos = viewportToLogical(e.clientX, e.clientY);
      const startPos = viewportToLogical(groupDragState.startX, groupDragState.startY);
      
      const deltaX = currentPos.x - startPos.x;
      const deltaY = currentPos.y - startPos.y;
      
      handleGroupDrag(groupDragState.groupId, deltaX, deltaY);
    };

    const handleGlobalMouseUp = () => {
      setGroupDragState(null);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [groupDragState, viewportToLogical, handleGroupDrag]);

  // 畫布拖曳相關處理函數
  const handleCanvasMouseDown = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // 只檢查直接的便利貼點擊
    if (target.closest('.sticky-note')) {
      return;
    }

    // 清除所有選取狀態
    setSelectedNote(null);
    setSelectedNotes([]);
    setSelectedEdge(null);
    setSelectedGroup(null);
    setPreviewSelectedNotes([]);

    const logicalPos = viewportToLogical(event.clientX, event.clientY);

    if (event.button === 2 || event.ctrlKey || event.metaKey) {
      // 右鍵拖曳或 Ctrl+拖曳 = 畫板拖曳
      setIsDragging(true);
      setDragStart({ x: event.clientX, y: event.clientY });
      setScrollStart({ 
        left: panOffset.x, 
        top: panOffset.y 
      });
    } else {
      // 左鍵拖曳 = 框選
      setIsSelecting(true);
      setSelectionStart(logicalPos);
      setSelectionEnd(logicalPos);
    }
  }, [panOffset, viewportToLogical]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent) => {
    // 更新滑鼠位置（用於連接預覽線）
    if (connectingFrom && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const logicalPos = viewportToLogical(event.clientX, event.clientY);
      setMousePosition({ x: logicalPos.x, y: logicalPos.y });
    }

    // 處理拖曳選取
    if (isSelecting) {
      const logicalPos = viewportToLogical(event.clientX, event.clientY);
      setSelectionEnd(logicalPos);
      
      // 實時計算預覽選中的便利貼
      const minX = Math.min(selectionStart.x, logicalPos.x);
      const maxX = Math.max(selectionStart.x, logicalPos.x);
      const minY = Math.min(selectionStart.y, logicalPos.y);
      const maxY = Math.max(selectionStart.y, logicalPos.y);
      
      const previewNoteIds = whiteboardData.notes
        .filter(note => {
          const noteLeft = note.x;
          const noteRight = note.x + note.width;
          const noteTop = note.y;
          const noteBottom = note.y + note.height;
          
          // 檢查便利貼是否與選取框重疊
          return !(noteRight < minX || noteLeft > maxX || noteBottom < minY || noteTop > maxY);
        })
        .map(note => note.id);
      
      setPreviewSelectedNotes(previewNoteIds);
      return;
    }

    // 處理畫板拖曳
    if (isDragging) {
      event.preventDefault();
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;

      setPanOffset({
        x: scrollStart.left + deltaX,
        y: scrollStart.top + deltaY
      });
      return;
    }
  }, [connectingFrom, viewportToLogical, isDragging, dragStart, scrollStart, isSelecting]);

  const handleCanvasMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // 處理連接模式：如果正在連接且懸停在目標便利貼上，完成連接
    if (connectingFrom && hoveredNote && connectingFrom !== hoveredNote) {
      addEdge(connectingFrom, hoveredNote);
      setConnectingFrom(null);
      setHoveredNote(null);
      return;
    }
    
    // 如果正在連接但沒有有效目標，取消連接
    if (connectingFrom) {
      setConnectingFrom(null);
      setHoveredNote(null);
      return;
    }
    
    // 結束拖曳選取
    if (isSelecting) {
      // 計算選取範圍
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);
      
      // 找出範圍內的便利貼
      const selectedNoteIds = whiteboardData.notes
        .filter(note => {
          const noteLeft = note.x;
          const noteRight = note.x + note.width;
          const noteTop = note.y;
          const noteBottom = note.y + note.height;
          
          // 檢查便利貼是否與選取框重疊
          return !(noteRight < minX || noteLeft > maxX || noteBottom < minY || noteTop > maxY);
        })
        .map(note => note.id);
      
      setSelectedNotes(selectedNoteIds);
      setIsSelecting(false);
      setPreviewSelectedNotes([]); // 清除預覽狀態
    }
    
    // 重置畫板拖曳狀態
    setIsDragging(false);
  }, [isSelecting, selectionStart, selectionEnd, whiteboardData.notes, connectingFrom, hoveredNote, addEdge]);

  const handleCanvasRightClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    // 如果正在連接模式，取消連接
    if (connectingFrom) {
      setConnectingFrom(null);
      setHoveredNote(null);
      return;
    }
    
    // 右鍵現在用於拖曳，不做其他動作
  }, [connectingFrom]);

  // 雙擊新增便利貼
  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // 只檢查直接的便利貼點擊
    if (target.closest('.sticky-note')) {
      return;
    }

    if (canvasRef.current && containerRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      
      // 計算相對於 canvas 的位置
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      
      // 轉換為邏輯坐標並居中
      const logicalX = (canvasX - panOffset.x) / zoomLevel - 100;
      const logicalY = (canvasY - panOffset.y) / zoomLevel - 100;
      
      addStickyNote(logicalX, logicalY);
    }
  }, [addStickyNote, panOffset, zoomLevel]);

  // 縮放處理函數 - 高性能版本
  const handleZoom = useCallback((delta: number, centerX: number, centerY: number) => {
    if (!canvasRef.current) return;

    // 根據滾輪速度動態調整縮放因子，更靈敏
    const normalizedDelta = Math.max(-100, Math.min(100, delta));
    const intensity = Math.abs(normalizedDelta) / 100;
    const baseZoomFactor = 0.15; // 基礎縮放強度
    const zoomFactor = 1 + (normalizedDelta > 0 ? baseZoomFactor : -baseZoomFactor) * (0.5 + intensity * 0.5);
    
    const newZoom = Math.min(Math.max(zoomLevel * zoomFactor, MIN_ZOOM), MAX_ZOOM);
    
    if (Math.abs(newZoom - zoomLevel) < 0.001) return;

    // 計算縮放中心在畫布中的位置
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = centerX - rect.left;
    const canvasY = centerY - rect.top;
    
    // 計算縮放前的邏輯位置
    const oldLogicalX = (canvasX - panOffset.x) / zoomLevel;
    const oldLogicalY = (canvasY - panOffset.y) / zoomLevel;
    
    // 調整平移偏移以保持縮放中心不變
    const newPanX = canvasX - oldLogicalX * newZoom;
    const newPanY = canvasY - oldLogicalY * newZoom;
    
    // 直接更新狀態，不使用 requestAnimationFrame 以獲得最大響應性
    setZoomLevel(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [zoomLevel, panOffset, MIN_ZOOM, MAX_ZOOM]);


  // 滾輪事件處理（縮放和平移）
  const handleWheel = useCallback((event: WheelEvent) => {
    const target = event.target as HTMLElement;
    const isOnStickyNote = target.closest('.sticky-note, .context-menu, .color-picker');

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+滾輪 = 縮放 - 在便利貼上也允許縮放
      event.preventDefault();
      handleZoom(-event.deltaY, event.clientX, event.clientY);
    } else {
      // 純滾輪 = 平移畫板
      // 只有在便利貼內部的編輯區域才阻止，其他情況都允許平移
      const isInEditableArea = target.tagName === 'TEXTAREA' || 
                               target.contentEditable === 'true' ||
                               target.closest('textarea');
      
      if (!isInEditableArea) {
        event.preventDefault();
        setPanOffset(prev => ({
          x: prev.x - event.deltaX,
          y: prev.y - event.deltaY
        }));
      }
    }
  }, [handleZoom]);

  // 添加原生 wheel 事件監聽器以避免 passive 問題
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // 觸控板縮放處理（Mac 雙指縮放）
  const pinchDataRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    initialPanOffset: { x: number; y: number };
    centerX: number;
    centerY: number;
    lastUpdateTime: number;
  } | null>(null);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      pinchDataRef.current = {
        initialDistance: distance,
        initialZoom: zoomLevel,
        initialPanOffset: { ...panOffset },
        centerX,
        centerY,
        lastUpdateTime: Date.now()
      };
    }
  }, [zoomLevel, panOffset]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 2 && pinchDataRef.current && canvasRef.current) {
      event.preventDefault();
      
      const now = Date.now();
      if (now - pinchDataRef.current.lastUpdateTime < 16) return; // 60fps 限制
      
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
      const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
      
      const { initialDistance, initialZoom, initialPanOffset, centerX, centerY } = pinchDataRef.current;
      const scaleFactor = currentDistance / initialDistance;
      const newZoom = Math.min(Math.max(initialZoom * scaleFactor, MIN_ZOOM), MAX_ZOOM);
      
      // 計算平移偏移（雙指滑動）
      const panDeltaX = currentCenterX - centerX;
      const panDeltaY = currentCenterY - centerY;
      
      if (Math.abs(newZoom - zoomLevel) > 0.01) {
        // 處理縮放
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasX = centerX - rect.left;
        const canvasY = centerY - rect.top;
        
        const logicalX = (canvasX - initialPanOffset.x) / initialZoom;
        const logicalY = (canvasY - initialPanOffset.y) / initialZoom;
        
        const newPanX = canvasX - logicalX * newZoom + panDeltaX;
        const newPanY = canvasY - logicalY * newZoom + panDeltaY;
        
        setZoomLevel(newZoom);
        setPanOffset({ x: newPanX, y: newPanY });
      } else if (Math.abs(panDeltaX) > 2 || Math.abs(panDeltaY) > 2) {
        // 處理平移（雙指滑動）
        setPanOffset({
          x: initialPanOffset.x + panDeltaX,
          y: initialPanOffset.y + panDeltaY
        });
      }
      
      pinchDataRef.current.lastUpdateTime = now;
    }
  }, [zoomLevel, MIN_ZOOM, MAX_ZOOM]);

  const handleTouchEnd = useCallback(() => {
    pinchDataRef.current = null;
  }, []);

  const handleStartConnection = useCallback((noteId: string) => {
    setConnectingFrom(noteId);
    setSelectedNote(noteId);
    
    // 初始化滑鼠位置為起始便利貼位置
    const fromNote = whiteboardData.notes.find(note => note.id === noteId);
    if (fromNote) {
      setMousePosition({
        x: fromNote.x + fromNote.width / 2,
        y: fromNote.y + fromNote.height / 2
      });
    }
  }, [whiteboardData.notes]);

  // 縮放控制函數
  const zoomIn = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + canvas.clientWidth / 2;
    const centerY = rect.top + canvas.clientHeight / 2;
    handleZoom(1, centerX, centerY);
  }, [handleZoom]);

  const zoomOut = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + canvas.clientWidth / 2;
    const centerY = rect.top + canvas.clientHeight / 2;
    handleZoom(-1, centerX, centerY);
  }, [handleZoom]);

  const resetZoom = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const centerX = (canvas.clientWidth - 3000) / 2;
    const centerY = (canvas.clientHeight - 2000) / 2;
    
    setZoomLevel(1);
    setPanOffset({ x: centerX, y: centerY });
  }, []);

  // 計算多選便利貼的邊界框
  const getMultiSelectionBounds = useCallback(() => {
    const selectedNoteObjects = whiteboardData.notes.filter(note => selectedNotes.includes(note.id));
    if (selectedNoteObjects.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    selectedNoteObjects.forEach(note => {
      minX = Math.min(minX, note.x);
      minY = Math.min(minY, note.y);
      maxX = Math.max(maxX, note.x + note.width);
      maxY = Math.max(maxY, note.y + note.height);
    });

    const padding = 20; // 邊框與便利貼的間距
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding
    };
  }, [whiteboardData.notes, selectedNotes]);

  const handleCompleteConnection = useCallback((toId: string) => {
    if (connectingFrom && connectingFrom !== toId) {
      addEdge(connectingFrom, toId);
    }
    setConnectingFrom(null);
    setHoveredNote(null);
  }, [connectingFrom, addEdge]);

  // 分析與特定便利貼相關聯的整個網絡
  const analyzeRelatedNetwork = useCallback((targetNoteId: string): NetworkAnalysis | null => {
    const targetNote = whiteboardData.notes.find(n => n.id === targetNoteId);
    if (!targetNote) return null;

    // 找出所有與目標便利貼相關的連線
    const relatedEdges = whiteboardData.edges.filter(
      edge => edge.from === targetNoteId || edge.to === targetNoteId
    );

    // 找出所有相關的便利貼ID
    const relatedNoteIds = new Set<string>();
    relatedEdges.forEach(edge => {
      if (edge.from !== targetNoteId) relatedNoteIds.add(edge.from);
      if (edge.to !== targetNoteId) relatedNoteIds.add(edge.to);
    });

    // 取得相關便利貼的詳細資訊
    const relatedNotes = Array.from(relatedNoteIds).map(id => 
      whiteboardData.notes.find(note => note.id === id)
    ).filter(Boolean);

    // 分析關係類型
    const incomingConnections: NetworkConnection[] = relatedEdges
      .filter(edge => edge.to === targetNoteId)
      .map(edge => {
        const fromNote = whiteboardData.notes.find(n => n.id === edge.from);
        return { note: fromNote!, relationship: 'leads_to' as const }; // 指向目標
      })
      .filter(conn => conn.note);

    const outgoingConnections: NetworkConnection[] = relatedEdges
      .filter(edge => edge.from === targetNoteId)
      .map(edge => {
        const toNote = whiteboardData.notes.find(n => n.id === edge.to);
        return { note: toNote!, relationship: 'derives_from' as const }; // 由目標衍生
      })
      .filter(conn => conn.note);

    return {
      targetNote,
      incomingConnections,
      outgoingConnections,
      allRelatedNotes: relatedNotes as StickyNote[],
      networkSize: relatedNotes.length + 1 // 包含目標便利貼本身
    };
  }, [whiteboardData]);

  const handleAIBrainstorm = async (noteId: string) => {
    const networkAnalysis = analyzeRelatedNetwork(noteId);
    if (!networkAnalysis) return;

    setAiResult('🧠 正在分析相關概念並發想...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const ideas = await aiService.brainstormWithContext(networkAnalysis);
      
      // 為每個想法創建新的便利貼 - 緊湊佈局適應簡短內容
      const newNotes = ideas.map((idea, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        
        return {
          id: uuidv4(),
          x: networkAnalysis.targetNote.x + 250 + (col * 220),
          y: networkAnalysis.targetNote.y + (row * 200),
          width: 180,
          height: 180,
          content: idea,
          color: '#DBEAFE' // 藍色表示 AI 生成
        };
      });

      // 創建連線
      const newEdges = newNotes.map(newNote => ({
        id: uuidv4(),
        from: noteId,
        to: newNote.id
      }));

      setWhiteboardData(prev => ({
        notes: [...prev.notes, ...newNotes],
        edges: [...prev.edges, ...newEdges]
      }));

      const contextInfo = networkAnalysis.networkSize > 1 
        ? `考慮了 ${networkAnalysis.networkSize} 個關聯概念` 
        : '基於單一概念發想';

      setAiResult(`🧠 AI 發想完成！\n\n基於「${networkAnalysis.targetNote.content}」生成 ${ideas.length} 個簡潔想法。\n\n${contextInfo}，已創建新的便利貼和連線。`);
    } catch (error) {
      console.error('AI Brainstorm error:', error);
      setAiResult('❌ AI 發想功能暫時無法使用。');
    }
  };

  const handleAIAnalyze = async () => {
    if (whiteboardData.notes.length === 0) {
      setAiResult('📊 請先添加一些便利貼再進行分析。');
      return;
    }

    setAiResult('📊 正在分析白板結構...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const analysis = await aiService.analyzeStructure(whiteboardData);
      setAiResult(analysis);
    } catch (error) {
      console.error('AI Analyze error:', error);
      setAiResult('❌ AI 分析功能暫時無法使用，請稍後再試。');
    }
  };

  const handleAISummarize = async () => {
    if (whiteboardData.notes.length === 0) {
      setAiResult('📝 請先添加一些便利貼再進行摘要。');
      return;
    }

    setAiResult('📝 正在生成摘要...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const summary = await aiService.summarize(whiteboardData);
      setAiResult(summary);
    } catch (error) {
      console.error('AI Summarize error:', error);
      setAiResult('❌ AI 摘要功能暫時無法使用，請稍後再試。');
    }
  };

  // 清除畫布功能
  const handleClearCanvas = useCallback(() => {
    if (whiteboardData.notes.length === 0 && whiteboardData.edges.length === 0) {
      return;
    }

    const confirmClear = window.confirm('確定要清除所有便利貼和連線嗎？此操作無法復原。');
    if (confirmClear) {
      setWhiteboardData({ notes: [], edges: [] });
      setAiResult('');
      setSelectedNote(null);
      setConnectingFrom(null);
      StorageService.clearWhiteboardData();
      setLastSaveTime(null);
    }
  }, [whiteboardData]);

  return (
    <div className="flex h-screen bg-white">
      {/* 白板畫布 */}
      <div 
        ref={canvasRef}
        data-canvas-background
        className={`flex-1 relative overflow-hidden transition-all select-none ${
          isDragging ? 'cursor-grabbing' : isSelecting ? 'cursor-crosshair' : 'cursor-default'
        }`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onContextMenu={handleCanvasRightClick}
        onDoubleClick={handleCanvasDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          background: 'white',
          backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0'
        }}
      >
        {/* 畫布使用提示 */}
        {whiteboardData.notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-400 select-none">
              <div className="text-6xl mb-4">🧠</div>
              <div className="text-lg font-medium mb-2">歡迎使用 AI 白板</div>
              <div className="text-sm space-y-1">
                <p>• 雙擊空白處新增便利貼</p>
                <p>• 左鍵拖拽進行框選</p>
                <p>• 右鍵拖拽移動畫布</p>
                <p>• Ctrl+滾輪或雙指縮放</p>
                <p>• 使用右下角控制器調整縮放</p>
              </div>
            </div>
          </div>
        )}
        {/* 擴大的畫布容器 */}
        <div 
          ref={containerRef}
          data-canvas-background
          className="relative"
          style={{
            width: '2000vw',
            height: '2000vh',
            minWidth: '20000px',
            minHeight: '20000px',
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
            transformOrigin: '0 0'
          }}
        >
          {/* SVG 用於繪製連線 */}
          <svg 
            className="absolute z-10"
            style={{
              top: 0,
              left: 0,
              width: '2000vw',
              height: '2000vh',
              minWidth: '20000px',
              minHeight: '20000px',
              overflow: 'visible'
            }}
          >
            {whiteboardData.edges.map(edge => (
              <EdgeComponent 
                key={edge.id}
                edge={edge}
                notes={whiteboardData.notes}
                isSelected={selectedEdge === edge.id}
                onSelect={() => {
                  setSelectedEdge(edge.id);
                  setSelectedNote(null); // 清除便利貼選取
                }}
                onDelete={() => {
                  console.log('Deleting edge from Whiteboard:', edge.id);
                  deleteEdge(edge.id);
                }}
              />
            ))}

            {/* 跟隨滑鼠的預覽連線 */}
            {connectingFrom && (() => {
              const fromNote = whiteboardData.notes.find(note => note.id === connectingFrom);
              if (!fromNote) return null;

              const fromX = fromNote.x + fromNote.width / 2;
              const fromY = fromNote.y + fromNote.height / 2;
              const toX = mousePosition.x;
              const toY = mousePosition.y;

              // 如果懸停在目標便利貼上，連到便利貼中心
              let targetX = toX;
              let targetY = toY;
              
              if (hoveredNote) {
                const hoveredNoteData = whiteboardData.notes.find(note => note.id === hoveredNote);
                if (hoveredNoteData) {
                  targetX = hoveredNoteData.x + hoveredNoteData.width / 2;
                  targetY = hoveredNoteData.y + hoveredNoteData.height / 2;

                  // 調整終點到便利貼邊緣
                  const angle = Math.atan2(targetY - fromY, targetX - fromX);
                  targetX = targetX - Math.cos(angle) * (hoveredNoteData.width / 2);
                  targetY = targetY - Math.sin(angle) * (hoveredNoteData.height / 2);
                }
              }

              const previewColor = hoveredNote ? '#A855F7' : '#6B7280'; // 紫色或灰色
              const strokeWidth = hoveredNote ? 4 : 3.5; // 與實際線條粗細一致

              return (
                <g key="preview-line">
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={targetX}
                    y2={targetY}
                    stroke={previewColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={hoveredNote ? "none" : "5,5"}
                    style={{
                      pointerEvents: 'none',
                      opacity: 0.8,
                      transition: 'all 0.2s ease'
                    }}
                  />
                  {hoveredNote && (
                    <polygon
                      points={[
                        [targetX, targetY],
                        [
                          targetX - 8 * Math.cos(Math.atan2(targetY - fromY, targetX - fromX) - Math.PI / 6),
                          targetY - 8 * Math.sin(Math.atan2(targetY - fromY, targetX - fromX) - Math.PI / 6)
                        ],
                        [
                          targetX - 8 * Math.cos(Math.atan2(targetY - fromY, targetX - fromX) + Math.PI / 6),
                          targetY - 8 * Math.sin(Math.atan2(targetY - fromY, targetX - fromX) + Math.PI / 6)
                        ]
                      ].map(point => point.join(',')).join(' ')}
                      fill={previewColor}
                      style={{ pointerEvents: 'none', opacity: 0.8 }}
                    />
                  )}
                </g>
              );
            })()}

            {/* 群組 */}
            {(whiteboardData.groups || []).map(group => {
              const bounds = getGroupBounds(group.id);
              if (!bounds) return null;
              const isSelected = selectedGroup === group.id;
              return (
                <GroupComponent
                  key={group.id}
                  group={group}
                  bounds={bounds}
                  isSelected={isSelected}
                  zoomLevel={zoomLevel}
                  onSelect={() => {
                    setSelectedGroup(group.id);
                    setSelectedNote(null);
                    // 選中群組時，也選中群組內的所有便利貼
                    setSelectedNotes(group.noteIds);
                  }}
                  onUpdateName={(name) => updateGroupName(group.id, name)}
                  onUpdateColor={(color) => updateGroupColor(group.id, color)}
                  onUngroup={() => ungroupNotes(group.id)}
                  onDelete={() => deleteGroup(group.id)}
                  onStartDrag={(e) => {
                    // 初始化群組拖曳狀態
                    const groupNotes = getGroupNotes(group.id);
                    const positions: {[key: string]: {x: number, y: number}} = {};
                    groupNotes.forEach(note => {
                      positions[note.id] = { x: note.x, y: note.y };
                    });
                    
                    setGroupDragState({
                      isDragging: true,
                      groupId: group.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      initialPositions: positions
                    });
                    
                    // 選中群組
                    setSelectedGroup(group.id);
                    setSelectedNote(null);
                    setSelectedNotes(group.noteIds);
                  }}
                />
              );
            })}

            {/* 拖曳選取框 */}
            {isSelecting && (
              <rect
                x={Math.min(selectionStart.x, selectionEnd.x)}
                y={Math.min(selectionStart.y, selectionEnd.y)}
                width={Math.abs(selectionEnd.x - selectionStart.x)}
                height={Math.abs(selectionEnd.y - selectionStart.y)}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="rgb(59, 130, 246)"
                strokeWidth="2"
                strokeDasharray="5,5"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* 多選群組邊框 */}
            {selectedNotes.length > 0 && (() => {
              const bounds = getMultiSelectionBounds();
              if (!bounds) return null;

              return (
                <rect
                  x={bounds.x}
                  y={bounds.y}
                  width={bounds.width}
                  height={bounds.height}
                  fill="none"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth="2"
                  strokeDasharray="8,4"
                  rx="12"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}
          </svg>

          {/* 便利貼 */}
          {whiteboardData.notes.map(note => (
            <StickyNoteComponent
              key={note.id}
              note={note}
              isSelected={selectedNote === note.id || selectedNotes.includes(note.id)}
              isSingleSelected={selectedNote === note.id && selectedNotes.length === 0}
              isMultiSelected={selectedNotes.length > 0}
              isPreviewSelected={previewSelectedNotes.includes(note.id)}
              isConnecting={connectingFrom === note.id}
              isConnectTarget={connectingFrom !== null && connectingFrom !== note.id}
              isHoveredForConnection={connectingFrom !== null && connectingFrom !== note.id && hoveredNote === note.id}
              zoomLevel={zoomLevel}
              panOffset={panOffset}
              viewportToLogical={viewportToLogical}
              autoEdit={autoEditNoteId === note.id}
              onSelect={() => {
                // 如果當前便利貼已經在多選狀態中，不要清除多選
                if (selectedNotes.includes(note.id)) {
                  // 已經在多選狀態中，保持多選不變
                  return;
                }
                
                // 否則進行正常選取
                setSelectedNote(note.id);
                setSelectedNotes([]); // 清除多選
                setSelectedEdge(null); // 清除連線選取
                // 清除自動編輯標記
                if (autoEditNoteId === note.id) {
                  setAutoEditNoteId(null);
                }
              }}
              onUpdate={(updates) => {
                updateStickyNote(note.id, updates);
                // 清除自動編輯標記
                if (autoEditNoteId === note.id) {
                  setAutoEditNoteId(null);
                }
              }}
              onDelete={() => deleteStickyNote(note.id)}
              onAIBrainstorm={() => handleAIBrainstorm(note.id)}
              onStartConnection={() => handleStartConnection(note.id)}
              onBatchColorChange={handleBatchColorChange}
              onBatchCopy={handleBatchCopy}
              onBatchMove={handleBatchMove}
              onInitBatchDrag={initBatchDragPositions}
              onCreateGroup={() => {
                if (selectedNotes.length >= 2) {
                  createGroup(selectedNotes);
                }
              }}
              onUngroupNotes={() => {
                if (note.groupId) {
                  ungroupNotes(note.groupId);
                }
              }}
              onMouseEnter={() => {
                if (connectingFrom && connectingFrom !== note.id) {
                  setHoveredNote(note.id);
                }
              }}
              onMouseLeave={() => {
                setHoveredNote(null);
              }}
            />
          ))}
        </div>

        {/* 儲存狀態指示器 - 固定在畫面上方 */}
        {lastSaveTime && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md text-xs text-gray-600 z-30">
            <span className="text-green-600">✓</span> 自動儲存於 {lastSaveTime.toLocaleTimeString()}
          </div>
        )}

        {/* 縮放控制器 - 固定在右側面板左側 */}
        <div 
          className="fixed bottom-4 flex flex-col bg-white rounded-lg shadow-lg border border-gray-200 z-30"
          style={{ right: '336px' }} // 320px (面板寬度) + 16px (間距)
        >
          <button
            onClick={zoomIn}
            className="px-3 py-2 text-lg font-bold hover:bg-gray-100 transition-colors border-b border-gray-100"
            title="放大 (Ctrl + 滾輪向上)"
            disabled={zoomLevel >= MAX_ZOOM}
          >
            +
          </button>
          
          <div className="px-2 py-1 text-xs text-center text-gray-600 border-b border-gray-100 min-w-16">
            {Math.round(zoomLevel * 100)}%
          </div>
          
          <button
            onClick={zoomOut}
            className="px-3 py-2 text-lg font-bold hover:bg-gray-100 transition-colors border-b border-gray-100"
            title="縮小 (Ctrl + 滾輪向下)"
            disabled={zoomLevel <= MIN_ZOOM}
          >
            -
          </button>
          
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-xs hover:bg-gray-100 transition-colors"
            title="重置縮放"
          >
            重置
          </button>
        </div>
      </div>

      {/* 右側面板 */}
      <SidePanel aiResult={aiResult} />

      {/* 底部懸浮工具列 */}
      <FloatingToolbar
        onAnalyze={handleAIAnalyze}
        onSummarize={handleAISummarize}
        onClear={handleClearCanvas}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        selectedCount={selectedNotes.length}
        onExport={(format) => {
          // TODO: 實現匯出功能
          console.log('Export as:', format);
        }}
        onSearch={() => {
          // TODO: 實現搜尋功能
          console.log('Search');
        }}
        onTemplate={() => {
          // TODO: 實現範本功能
          console.log('Templates');
        }}
        onNotes={() => {
          // TODO: 實現備忘錄功能
          console.log('Notes');
        }}
      />
    </div>
  );
};

export default Whiteboard;