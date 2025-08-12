'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { StickyNote, Edge, Group, WhiteboardData, NetworkAnalysis, NetworkConnection, Project } from '../types';
import StickyNoteComponent from './StickyNote';
import EdgeComponent from './Edge';
import GroupComponent from './Group';
import FloatingToolbar from './FloatingToolbar';
import SidePanel from './SidePanel';
import Notes from './Notes';
import Templates from './Templates';
import ProjectDialog from './ProjectDialog';
import AIPreviewDialog from './AIPreviewDialog';
import { StorageService } from '../services/storageService';
import { AlignmentService } from '../services/alignmentService';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { ProjectService } from '../services/projectService';
import { SyncService, SyncStatus } from '../services/syncService';

const Whiteboard: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
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
  const [showNotes, setShowNotes] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [aiMenuPosition, setAIMenuPosition] = useState({ x: 0, y: 0 });
  const [showAskAIDialog, setShowAskAIDialog] = useState(false);
  const [askAINoteId, setAskAINoteId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  // 對齊輔助線相關狀態
  const [alignmentGuides, setAlignmentGuides] = useState<Array<{
    type: 'horizontal' | 'vertical';
    position: number;
    start: number;
    end: number;
  }>>([]);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [isHoldingCmd, setIsHoldingCmd] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncService.getSyncStatus());
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [aiPreviewData, setAIPreviewData] = useState<any>(null);
  const [pendingAIResult, setPendingAIResult] = useState<any>(null);
  
  // AI loading 狀態管理
  const [aiLoadingStates, setAiLoadingStates] = useState<{
    brainstorm: boolean;
    analyze: boolean;
    summarize: boolean;
    askAI: boolean;
    targetNoteId?: string; // 當前正在處理 AI 的便利貼 ID
    // Chain of thought 思考步驟
    thinkingSteps?: string[];
    currentStep?: number;
    // 每個步驟的詳細結果
    stepResults?: { [stepIndex: number]: string };
  }>({
    brainstorm: false,
    analyze: false,
    summarize: false,
    askAI: false
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 3;

  // 包裝的 setWhiteboardData 函數，會同時標記本地變更時間
  const updateWhiteboardData = useCallback((
    updater: WhiteboardData | ((prev: WhiteboardData) => WhiteboardData)
  ) => {
    setWhiteboardData(updater);
    SyncService.markLocalChange();
  }, []);

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
      
      updateWhiteboardData(prev => ({
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
      
      updateWhiteboardData(prev => ({
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
      
      updateWhiteboardData(prev => ({
        notes: prev.notes.filter(note => !notesToDelete.includes(note.id)),
        edges: prev.edges.filter(edge => 
          !notesToDelete.includes(edge.from) && !notesToDelete.includes(edge.to)
        )
      }));
      
      setSelectedNotes([]);
      setSelectedNote(null);
    } else if (selectedEdge) {
      saveToHistory(whiteboardData);
      updateWhiteboardData(prev => ({
        ...prev,
        edges: prev.edges.filter(edge => edge.id !== selectedEdge)
      }));
      setSelectedEdge(null);
    }
  }, [selectedNotes, selectedNote, selectedEdge, whiteboardData, saveToHistory]);

  const moveSelectedNotes = useCallback((deltaX: number, deltaY: number) => {
    const notesToMove = selectedNote ? [selectedNote] : selectedNotes;
    if (notesToMove.length > 0) {
      updateWhiteboardData(prev => ({
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
      updateWhiteboardData(prev => ({
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

    updateWhiteboardData(prev => ({
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

    updateWhiteboardData(prev => ({
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
    updateWhiteboardData(prev => ({
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
    updateWhiteboardData(prev => ({
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

    updateWhiteboardData(prev => ({
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
      // 獲取正在移動的便利貼
      const movingNotes = whiteboardData.notes.filter(note => selectedNotes.includes(note.id));
      
      let snappedDeltaX = deltaX;
      let snappedDeltaY = deltaY;
      
      // 只在按住 Cmd 時計算對齊
      if (isHoldingCmd) {
        // 計算對齊
        const alignmentResult = AlignmentService.calculateMultipleAlignment(
          movingNotes,
          deltaX,
          deltaY,
          whiteboardData.notes
        );
        
        // 設置輔助線
        setAlignmentGuides(alignmentResult.guides);
        
        // 使用吸附後的位移
        snappedDeltaX = alignmentResult.snappedPosition.x;
        snappedDeltaY = alignmentResult.snappedPosition.y;
      } else {
        // 清除輔助線
        setAlignmentGuides([]);
      }
      
      setWhiteboardData(prev => ({
        ...prev,
        notes: prev.notes.map(note => {
          if (selectedNotes.includes(note.id)) {
            const initialPos = batchDragInitialPositions[note.id];
            if (initialPos) {
              return {
                ...note,
                x: initialPos.x + snappedDeltaX,
                y: initialPos.y + snappedDeltaY
              };
            }
          }
          return note;
        })
      }));
    }
  }, [selectedNotes, batchDragInitialPositions, whiteboardData.notes, isHoldingCmd]);

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


  // 載入專案資料
  useEffect(() => {
    const loadProjectData = async () => {
      // 初始化預設專案
      ProjectService.initializeDefaultProject();
      
      // 獲取當前專案 ID
      let projectId = ProjectService.getCurrentProjectId();
      
      // 如果沒有當前專案，選擇第一個專案
      if (!projectId) {
        const projects = ProjectService.getAllProjects();
        if (projects.length > 0) {
          projectId = projects[0].id;
          ProjectService.setCurrentProject(projectId);
        }
      }
      
      if (projectId) {
        setCurrentProjectId(projectId);
        
        // 更新當前專案資訊
        const projects = ProjectService.getAllProjects();
        const project = projects.find(p => p.id === projectId);
        setCurrentProject(project || null);
        
        
        // 從本地載入
        const localData = ProjectService.loadProjectData(projectId);
        if (localData) {
          setWhiteboardData(localData);
          setLastSaveTime(new Date());
          
          // 恢復視窗狀態
          if (localData.viewport) {
            setZoomLevel(localData.viewport.zoomLevel);
            setPanOffset(localData.viewport.panOffset);
          }
          
          // 初始化歷史記錄
          setHistory([localData]);
          setHistoryIndex(0);
        } else {
          // 沒有資料時，初始化空的歷史記錄
          const initialData = { notes: [], edges: [], groups: [] };
          setHistory([initialData]);
          setHistoryIndex(0);
        }
      }
    };
    
    loadProjectData();
  }, []);

  // 處理雲端同步切換
  const handleToggleCloudSync = useCallback(async (enabled: boolean) => {
    setCloudSyncEnabled(enabled);
    
    if (enabled && user?.id && currentProjectId) {
      try {
        // 同步所有專案
        await SyncService.syncAllProjects(user.id);
        
        // 啟用即時同步
        SyncService.enableRealtimeSync(currentProjectId, user.id, (data) => {
          // 從雲端接收到更新
          setWhiteboardData(data);
        });
        
        // 更新同步狀態
        setSyncStatus(SyncService.getSyncStatus());
      } catch (error) {
        console.error('Failed to enable cloud sync:', error);
        setCloudSyncEnabled(false);
      }
    } else if (!enabled) {
      // 停用即時同步
      SyncService.disableAllRealtimeSync();
    }
  }, [user, currentProjectId]);

  // 當使用者登入時自動啟用雲端同步
  useEffect(() => {
    if (user?.id) {
      // 用戶登入時自動啟用雲端同步
      setCloudSyncEnabled(true);
      
      // 同步所有專案
      SyncService.syncAllProjects(user.id).then(() => {
        setSyncStatus(SyncService.getSyncStatus());
      }).catch(error => {
        console.error('Auto sync failed:', error);
      });
    }
  }, [user]);

  // 當使用者登入狀態或專案改變時，重新設置即時同步
  useEffect(() => {
    if (user?.id && currentProjectId) {
      // 啟用即時同步（不再需要檢查 cloudSyncEnabled，因為登入後自動啟用）
      SyncService.enableRealtimeSync(currentProjectId, user.id, (data) => {
        setWhiteboardData(data);
      });
      
      return () => {
        SyncService.disableRealtimeSync(currentProjectId);
      };
    }
  }, [user, currentProjectId]);

  // 初始化畫布位置到中央（僅在沒有保存的視窗狀態時）
  useEffect(() => {
    if (canvasRef.current && !whiteboardData.viewport) {
      // 將畫布定位到一個合理的初始位置
      setPanOffset({ x: 100, y: 100 });
    }
  }, [whiteboardData.viewport]);

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
    if (!currentProjectId || (whiteboardData.notes.length === 0 && whiteboardData.edges.length === 0)) {
      return;
    }

    // 使用 debounce 避免頻繁儲存
    const saveTimer = setTimeout(async () => {
      const viewport = { zoomLevel, panOffset };
      
      // 儲存到本地
      ProjectService.saveProjectData(currentProjectId, whiteboardData, viewport);
      
      // 如果啟用雲端同步且使用者已登入，同步到雲端
      if (cloudSyncEnabled && user?.id) {
        try {
          await SyncService.saveProjectData(user.id, currentProjectId, whiteboardData);
          // 更新同步狀態
          setSyncStatus(SyncService.getSyncStatus());
        } catch (error) {
          console.error('Failed to sync to cloud:', error);
          setSyncStatus(SyncService.getSyncStatus());
        }
      }
      
      setLastSaveTime(new Date());
    }, 1000); // 1秒後儲存

    return () => clearTimeout(saveTimer);
  }, [whiteboardData, zoomLevel, panOffset, currentProjectId, cloudSyncEnabled, user]);

  // 計算所有內容的邊界
  const calculateContentBounds = useCallback(() => {
    if (whiteboardData.notes.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // 計算所有便利貼的邊界
    whiteboardData.notes.forEach(note => {
      minX = Math.min(minX, note.x);
      minY = Math.min(minY, note.y);
      maxX = Math.max(maxX, note.x + note.width);
      maxY = Math.max(maxY, note.y + note.height);
    });

    // 計算所有群組的邊界
    whiteboardData.groups?.forEach(group => {
      minX = Math.min(minX, group.x);
      minY = Math.min(minY, group.y);
      maxX = Math.max(maxX, group.x + group.width);
      maxY = Math.max(maxY, group.y + group.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }, [whiteboardData.notes, whiteboardData.groups]);

  // 回到內容中心
  const centerViewOnContent = useCallback(() => {
    const bounds = calculateContentBounds();
    if (!bounds || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;

    // 計算適合的縮放級別（留一些邊距）
    const padding = 100;
    const scaleX = (canvasWidth - padding * 2) / bounds.width;
    const scaleY = (canvasHeight - padding * 2) / bounds.height;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), MAX_ZOOM);

    // 計算新的平移位置，使內容居中
    const newPanX = (canvasWidth / 2) - (bounds.centerX * newZoom);
    const newPanY = (canvasHeight / 2) - (bounds.centerY * newZoom);

    // 平滑過渡動畫
    const startZoom = zoomLevel;
    const startPanX = panOffset.x;
    const startPanY = panOffset.y;
    const startTime = Date.now();
    const duration = 500; // 500ms 動畫

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用 easeInOutCubic 緩動函數
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentZoom = startZoom + (newZoom - startZoom) * easeProgress;
      const currentPanX = startPanX + (newPanX - startPanX) * easeProgress;
      const currentPanY = startPanY + (newPanY - startPanY) * easeProgress;

      setZoomLevel(currentZoom);
      setPanOffset({ x: currentPanX, y: currentPanY });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [calculateContentBounds, canvasRef, zoomLevel, panOffset, MIN_ZOOM, MAX_ZOOM]);

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
      
      // 追蹤 Cmd/Ctrl 鍵狀態
      if (event.metaKey || event.ctrlKey) {
        setIsHoldingCmd(true);
      }

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

      // 回到內容中心 (Home)
      if (event.key === 'Home') {
        event.preventDefault();
        centerViewOnContent();
        return;
      }
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      // 當釋放 Cmd/Ctrl 鍵時
      if (!event.metaKey && !event.ctrlKey) {
        setIsHoldingCmd(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, selectAllNotes, copySelectedNotes, pasteNotes, duplicateSelectedNotes, deleteSelectedItems, moveSelectedNotes, selectedNote, selectedNotes, createGroup, ungroupNotes, selectedGroup, whiteboardData.notes, centerViewOnContent]);

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

    updateWhiteboardData(prev => ({
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
    // 如果正在更新位置並且正在拖曳，並且按住 Cmd 鍵，計算對齊
    if (isDraggingNote && isHoldingCmd && (updates.x !== undefined || updates.y !== undefined)) {
      const currentNote = whiteboardData.notes.find(n => n.id === id);
      if (currentNote) {
        const targetPosition = {
          x: updates.x ?? currentNote.x,
          y: updates.y ?? currentNote.y
        };
        
        // 計算對齊
        const alignmentResult = AlignmentService.calculateAlignment(
          currentNote,
          targetPosition,
          whiteboardData.notes,
          selectedNotes.includes(id) ? selectedNotes : []
        );
        
        // 設置輔助線
        setAlignmentGuides(alignmentResult.guides);
        
        // 使用吸附後的位置
        updates = {
          ...updates,
          x: alignmentResult.snappedPosition.x,
          y: alignmentResult.snappedPosition.y
        };
      }
    } else if (!isHoldingCmd) {
      // 如果沒有按住 Cmd，清除輔助線
      setAlignmentGuides([]);
    }
    
    updateWhiteboardData(prev => ({
      ...prev,
      notes: prev.notes.map(note => 
        note.id === id ? { ...note, ...updates } : note
      )
    }));
  }, [isDraggingNote, isHoldingCmd, whiteboardData.notes, selectedNotes]);

  const deleteStickyNote = useCallback((id: string) => {
    saveToHistory(whiteboardData); // 保存歷史記錄
    
    // 清理選取狀態
    if (selectedNote === id) {
      setSelectedNote(null);
    }
    if (selectedNotes.includes(id)) {
      setSelectedNotes(prev => prev.filter(noteId => noteId !== id));
    }
    if (autoEditNoteId === id) {
      setAutoEditNoteId(null);
    }
    if (connectingFrom === id) {
      setConnectingFrom(null);
    }
    
    updateWhiteboardData(prev => {
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
        : prev.groups || []; // 保持原有的 groups，而不是返回空陣列
      
      return {
        ...prev,
        notes: prev.notes.filter(note => note.id !== id),
        edges: prev.edges.filter(edge => edge.from !== id && edge.to !== id),
        groups: updatedGroups
      };
    });
  }, [whiteboardData, saveToHistory, selectedNote, selectedNotes, autoEditNoteId, connectingFrom]);

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
    
    // 先反向應用平移，再反向應用縮放
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
    
    // 檢查是否點擊便利貼
    if (target.closest('.sticky-note')) {
      return;
    }
    
    // 檢查是否點擊群組 - SVG 元素需要特別處理
    const svgElement = target.closest('svg');
    if (svgElement && (target.tagName === 'rect' || target.tagName === 'text' || target.tagName === 'foreignObject')) {
      // 這可能是群組相關的元素，不要清除選取狀態
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

    // 選取邏輯已移至全局事件處理器

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
  }, [connectingFrom, viewportToLogical, isDragging, dragStart, scrollStart]);

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
    
    // 選取邏輯已移至全局事件處理器
    
    // 重置畫板拖曳狀態
    setIsDragging(false);
  }, [connectingFrom, hoveredNote, addEdge]);

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

  // 處理選取操作的全局事件監聽
  useEffect(() => {
    if (!isSelecting || groupDragState?.isDragging) return;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const logicalPos = viewportToLogical(event.clientX, event.clientY);
        setSelectionEnd(logicalPos);
        
        // 動態更新預覽選取的便利貼
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
            return !(noteRight < minX || noteLeft > maxX || noteBottom < minY || noteTop > maxY);
          })
          .map(note => note.id);
        
        setPreviewSelectedNotes(previewNoteIds);
      }
    };

    const handleGlobalMouseUp = () => {
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
    };

    // 添加全局事件監聽器
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isSelecting, selectionStart, selectionEnd, whiteboardData.notes, viewportToLogical, groupDragState]);

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

  // 智能計算新便利貼的位置
  const calculateSmartLayout = (
    targetNote: StickyNote,
    existingChildren: StickyNote[],
    newIdeasCount: number,
    whiteboardData: WhiteboardData
  ) => {
    const NOTE_WIDTH = 180;
    const NOTE_HEIGHT = 180;
    const HORIZONTAL_GAP = 60;  // 橫向間距（增加到 60px）
    const VERTICAL_GAP = 60;    // 縱向間距（增加到 60px）
    const RADIUS_INCREMENT = 350; // 每層的半徑增量（增加到 350px 確保更大間距）
    
    // 分析現有子節點的分布
    const childPositions = existingChildren.map(child => ({
      x: child.x,
      y: child.y,
      angle: Math.atan2(child.y - targetNote.y, child.x - targetNote.x)
    }));
    
    // 判斷現有佈局模式
    let layoutStrategy = 'auto';
    
    if (existingChildren.length === 0) {
      // 沒有子節點，根據父節點位置決定
      const parentEdge = whiteboardData.edges.find(e => e.to === targetNote.id);
      if (parentEdge) {
        const parentNote = whiteboardData.notes.find(n => n.id === parentEdge.from);
        if (parentNote) {
          // 延續父節點到目標節點的方向
          const direction = Math.atan2(targetNote.y - parentNote.y, targetNote.x - parentNote.x);
          layoutStrategy = 'directional';
          
          // 扇形展開 - 根據數量調整角度，增加間距
          const angleSpread = Math.min(Math.PI * 2/3, (Math.PI / 4) * newIdeasCount); // 增加角度間距
          const startAngle = direction - angleSpread / 2;
          const angleStep = newIdeasCount > 1 ? angleSpread / (newIdeasCount - 1) : 0;
          
          return Array.from({ length: newIdeasCount }, (_, index) => {
            const angle = startAngle + angleStep * index;
            // 稍微交錯排列，避免過於規則
            const radiusOffset = (index % 2) * 40; // 增加交錯幅度
            const radius = RADIUS_INCREMENT + radiusOffset;
            return {
              x: targetNote.x + Math.cos(angle) * radius,
              y: targetNote.y + Math.sin(angle) * radius
            };
          });
        }
      }
      
      // 預設：優雅的弧形分布，增加間距
      const baseAngle = Math.PI / 2; // 向下為主要方向
      const spread = Math.min(Math.PI, (Math.PI / 3) * newIdeasCount); // 增加展開角度
      const startAngle = baseAngle - spread / 2;
      const angleStep = newIdeasCount > 1 ? spread / (newIdeasCount - 1) : 0;
      
      return Array.from({ length: newIdeasCount }, (_, index) => {
        const angle = startAngle + angleStep * index;
        // 中間的節點稍微靠前，形成弧形
        const centerIndex = (newIdeasCount - 1) / 2;
        const distanceFromCenter = Math.abs(index - centerIndex);
        const radiusAdjust = -distanceFromCenter * 20; // 增加弧度變化
        const radius = RADIUS_INCREMENT + radiusAdjust;
        
        return {
          x: targetNote.x + Math.cos(angle) * radius,
          y: targetNote.y + Math.sin(angle) * radius
        };
      });
    }
    
    // 有現有子節點，找出空缺的角度區域
    if (existingChildren.length > 0) {
      // 排序現有角度
      const sortedAngles = childPositions.map(p => p.angle).sort((a, b) => a - b);
      
      // 找出最大的角度間隙
      let maxGap = 0;
      let gapStart = 0;
      let gapEnd = 0;
      
      for (let i = 0; i < sortedAngles.length; i++) {
        const currentAngle = sortedAngles[i];
        const nextAngle = sortedAngles[(i + 1) % sortedAngles.length];
        const gap = (i === sortedAngles.length - 1) 
          ? (2 * Math.PI + nextAngle - currentAngle) % (2 * Math.PI)
          : nextAngle - currentAngle;
        
        if (gap > maxGap) {
          maxGap = gap;
          gapStart = currentAngle;
          gapEnd = (i === sortedAngles.length - 1) ? nextAngle + 2 * Math.PI : nextAngle;
        }
      }
      
      // 在最大間隙中均勻分布新節點
      const angleStep = maxGap / (newIdeasCount + 1);
      const positions = [];
      
      for (let i = 0; i < newIdeasCount; i++) {
        const angle = gapStart + angleStep * (i + 1);
        const normalizedAngle = angle % (2 * Math.PI);
        
        // 稍微隨機化半徑，避免太規律（增加變化範圍）
        const radiusVariation = (Math.random() - 0.5) * 70;
        const radius = RADIUS_INCREMENT + radiusVariation;
        
        positions.push({
          x: targetNote.x + Math.cos(normalizedAngle) * radius,
          y: targetNote.y + Math.sin(normalizedAngle) * radius
        });
      }
      
      return positions;
    }
    
    // 備用方案：網格佈局
    const cols = Math.ceil(Math.sqrt(newIdeasCount));
    const rows = Math.ceil(newIdeasCount / cols);
    
    return Array.from({ length: newIdeasCount }, (_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      // 置中對齊
      const totalWidth = cols * NOTE_WIDTH + (cols - 1) * HORIZONTAL_GAP;
      const startX = targetNote.x + RADIUS_INCREMENT - totalWidth / 2;
      
      return {
        x: startX + col * (NOTE_WIDTH + HORIZONTAL_GAP),
        y: targetNote.y + row * (NOTE_HEIGHT + VERTICAL_GAP)
      };
    });
  };

  const handleAIBrainstorm = async (noteId: string) => {
    const networkAnalysis = analyzeRelatedNetwork(noteId);
    if (!networkAnalysis) return;

    // 定義真實的 Chain of Thought 思考步驟（移除沒有結果的第一步）
    const thinkingSteps = [
      '📊 深度分析思維導圖整體結構...',
      '🎯 分析目標節點在整體架構中的定位...',
      '🧠 制定智能發想策略...',
      '✨ 基於策略生成創新想法...'
    ];

    // 設置 loading 狀態
    setAiLoadingStates(prev => ({ 
      ...prev, 
      brainstorm: true, 
      targetNoteId: noteId,
      thinkingSteps,
      currentStep: 0
    }));

    try {
      // 實際調用 AI 服務，並傳遞 onProgress 回調
      const { aiService } = await import('../services/aiService');
      
      // 定義進度回調函數
      const onProgress = (step: string, progress: number, result?: string) => {
        console.log(`AI Progress: ${step} (${progress}%)`);
        if (result) {
          console.log(`Step Result:`, result);
        }
        
        // 根據進度更新當前步驟（調整為4個步驟）
        let currentStepIndex = 0;
        if (progress >= 100) currentStepIndex = 4;      // 完成
        else if (progress >= 90) currentStepIndex = 3;  // Step 4
        else if (progress >= 70) currentStepIndex = 2;  // Step 3
        else if (progress >= 50) currentStepIndex = 1;  // Step 2
        else if (progress >= 25) currentStepIndex = 0;  // Step 1
        
        setAiLoadingStates(prev => {
          const newState = { 
            ...prev, 
            currentStep: currentStepIndex 
          };
          
          // 如果有詳細結果，將其存儲到 stepResults 中
          if (result && progress >= 25) {
            // 根據進度確定步驟索引（調整為0-3）
            let resultStepIndex = 0;
            if (progress >= 100) resultStepIndex = 3;       // 最終結果
            else if (progress >= 90) resultStepIndex = 3;   // Step 4
            else if (progress >= 70) resultStepIndex = 2;   // Step 3  
            else if (progress >= 50) resultStepIndex = 1;   // Step 2
            else if (progress >= 25) resultStepIndex = 0;   // Step 1
            
            newState.stepResults = {
              ...prev.stepResults,
              [resultStepIndex]: result
            };
          }
          
          return newState;
        });
        
        // 不要在這裡設置 aiResult，讓 SidePanel 顯示詳細的 chain of thought
        // aiResult 現在只用於非 brainstorm 的情況
      };
      
      const ideas = await aiService.brainstormWithContext(networkAnalysis, whiteboardData, onProgress);
      
      // 找出目標節點的現有子節點
      const existingChildEdges = whiteboardData.edges.filter(e => e.from === noteId);
      const existingChildren = existingChildEdges
        .map(edge => whiteboardData.notes.find(n => n.id === edge.to))
        .filter((note): note is StickyNote => note !== undefined);
      
      // 使用智能佈局計算新便利貼的位置
      const smartPositions = calculateSmartLayout(
        networkAnalysis.targetNote,
        existingChildren,
        ideas.length,
        whiteboardData
      );
      
      // 為每個想法創建新的便利貼 - 使用智能佈局
      const newNotes = ideas.map((idea, index) => {
        const position = smartPositions[index] || { 
          x: networkAnalysis.targetNote.x + 250, 
          y: networkAnalysis.targetNote.y 
        };
        
        return {
          id: uuidv4(),
          x: position.x,
          y: position.y,
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

      // 暫時停用即時同步以避免衝突
      if (user?.id && currentProjectId) {
        SyncService.disableRealtimeSync(currentProjectId);
      }

      // 使用 updater function 確保狀態更新的原子性
      setWhiteboardData(prev => {
        const newData = {
          notes: [...prev.notes, ...newNotes],
          edges: [...prev.edges, ...newEdges],
          groups: prev.groups || []
        };
        
        // 立即儲存到本地以防止資料遺失
        if (currentProjectId) {
          setTimeout(() => {
            ProjectService.saveProjectData(currentProjectId, newData, { zoomLevel, panOffset });
          }, 100);
        }
        
        return newData;
      });

      // 延遲重新啟用即時同步，並確保不會覆蓋本地更改
      setTimeout(() => {
        if (user?.id && currentProjectId) {
          // 重新啟用前先同步到雲端
          const currentData = ProjectService.loadProjectData(currentProjectId);
          if (currentData) {
            SyncService.saveProjectData(user.id, currentProjectId, currentData).then(() => {
              SyncService.enableRealtimeSync(currentProjectId, user.id, (data) => {
                setWhiteboardData(data);
              });
            }).catch(() => {
              // 即使同步失敗也要重新啟用即時同步
              SyncService.enableRealtimeSync(currentProjectId, user.id, (data) => {
                setWhiteboardData(data);
              });
            });
          }
        }
      }, 3000); // 增加到3秒

      // 保留 Chain of Thought 結果，不覆蓋
      // 最終結果已經在 onProgress 回調中處理了
    } catch (error) {
      console.error('AI Brainstorm error:', error);
      // 附加錯誤訊息而不是覆蓋
      setAiResult(prev => prev + '\n\n❌ AI 發想過程中發生錯誤。');
    } finally {
      // 清除 loading 狀態
      setAiLoadingStates(prev => ({ 
        ...prev, 
        brainstorm: false, 
        targetNoteId: undefined,
        thinkingSteps: undefined,
        currentStep: undefined,
        stepResults: undefined
      }));
    }
  };

  const handleAskAI = (noteId: string) => {
    setAskAINoteId(noteId);
    setShowAskAIDialog(true);
    setCustomPrompt('');
  };

  const handleSubmitAskAI = async () => {
    if (!askAINoteId || !customPrompt.trim()) return;
    
    // 檢查是否為多選模式（ID 包含逗號）
    const isMultiSelect = askAINoteId.includes(',');
    
    setShowAskAIDialog(false);
    
    // 設置 loading 狀態
    setAiLoadingStates(prev => ({ 
      ...prev, 
      askAI: true, 
      targetNoteId: isMultiSelect ? askAINoteId : askAINoteId 
    }));
    setAiResult('💬 正在向 AI 詢問...');
    
    try {
      const { aiService } = await import('../services/aiService');
      let result: string;
      let targetX: number, targetY: number;
      let sourceNoteIds: string[] = [];
      
      if (isMultiSelect) {
        // 多選模式：處理多個便利貼
        const noteIds = askAINoteId.split(',');
        const selectedNotesData = whiteboardData.notes.filter(note => 
          noteIds.includes(note.id)
        );
        
        if (selectedNotesData.length === 0) return;
        
        // 計算新便利貼的位置（在選中區域的右側）
        const bounds = selectedNotesData.reduce((acc, note) => ({
          minX: Math.min(acc.minX, note.x),
          maxX: Math.max(acc.maxX, note.x + note.width),
          minY: Math.min(acc.minY, note.y),
          maxY: Math.max(acc.maxY, note.y + note.height)
        }), {
          minX: Infinity, maxX: -Infinity,
          minY: Infinity, maxY: -Infinity
        });
        
        targetX = bounds.maxX + 50;
        targetY = bounds.minY + (bounds.maxY - bounds.minY) / 2 - 100;
        sourceNoteIds = noteIds;
        
        // 使用多選分析 API
        const relatedEdges = whiteboardData.edges.filter(edge => 
          noteIds.includes(edge.from) || noteIds.includes(edge.to)
        );
        
        result = await aiService.askAboutSelection(
          selectedNotesData, 
          relatedEdges, 
          whiteboardData,
          customPrompt
        );
      } else {
        // 單選模式：保持原有邏輯
        const networkAnalysis = analyzeRelatedNetwork(askAINoteId);
        if (!networkAnalysis) return;
        
        targetX = networkAnalysis.targetNote.x + 250;
        targetY = networkAnalysis.targetNote.y;
        sourceNoteIds = [askAINoteId];
        
        result = await aiService.askWithContext(
          networkAnalysis, 
          whiteboardData, 
          customPrompt
        );
      }
      
      // 創建一個新的便利貼來顯示結果
      // 根據內容長度動態調整高度
      const contentLength = result.length;
      const estimatedHeight = Math.max(250, Math.min(400, 200 + Math.floor(contentLength / 50) * 20));
      
      const newNote = {
        id: uuidv4(),
        x: targetX,
        y: targetY,
        width: 250,
        height: estimatedHeight,
        content: result,
        color: '#EDE9FE' // 紫色表示 AI 回答
      };
      
      // 創建連線（如果是多選，連到所有選中的便利貼）
      const newEdges = sourceNoteIds.map(sourceId => ({
        id: uuidv4(),
        from: sourceId,
        to: newNote.id
      }));

      setWhiteboardData(prev => ({
        notes: [...prev.notes, newNote],
        edges: [...prev.edges, ...newEdges],
        groups: prev.groups || []
      }));
      
      const successMessage = isMultiSelect
        ? `💬 AI 回答完成！\n\n基於 ${sourceNoteIds.length} 個選中便利貼的詢問：\n"${customPrompt}"\n\n已創建新的便利貼顯示回答。`
        : `💬 AI 回答完成！\n\n基於便利貼的詢問：\n"${customPrompt}"\n\n已創建新的便利貼顯示回答。`;
      
      setAiResult(successMessage);
    } catch (error) {
      console.error('AI Ask error:', error);
      setAiResult('❌ AI 詢問功能暫時無法使用。');
    } finally {
      // 清除 loading 狀態
      setAiLoadingStates(prev => ({ 
        ...prev, 
        askAI: false, 
        targetNoteId: undefined 
      }));
    }
    
    setAskAINoteId(null);
    setCustomPrompt('');
  };

  const handleAIAnalyze = async () => {
    if (whiteboardData.notes.length === 0) {
      setAiResult('📊 請先添加一些便利貼再進行分析。');
      return;
    }

    // 設置 loading 狀態
    setAiLoadingStates(prev => ({ ...prev, analyze: true }));
    setAiResult('📊 正在分析白板結構...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const analysis = await aiService.analyzeStructure(whiteboardData);
      setAiResult(analysis);
    } catch (error) {
      console.error('AI Analyze error:', error);
      setAiResult('❌ AI 分析功能暫時無法使用，請稍後再試。');
    } finally {
      // 清除 loading 狀態
      setAiLoadingStates(prev => ({ ...prev, analyze: false }));
    }
  };

  const handleAISummarize = async () => {
    if (whiteboardData.notes.length === 0) {
      setAiResult('📝 請先添加一些便利貼再進行摘要。');
      return;
    }

    // 設置 loading 狀態
    setAiLoadingStates(prev => ({ ...prev, summarize: true }));
    setAiResult('📝 正在生成摘要...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const summary = await aiService.summarize(whiteboardData);
      setAiResult(summary);
    } catch (error) {
      console.error('AI Summarize error:', error);
      setAiResult('❌ AI 摘要功能暫時無法使用，請稍後再試。');
    } finally {
      // 清除 loading 狀態
      setAiLoadingStates(prev => ({ ...prev, summarize: false }));
    }
  };

  // AI 選取分析
  const handleAIAnalyzeSelection = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    const relatedEdges = whiteboardData.edges.filter(edge => 
      selectedNotes.includes(edge.from) || selectedNotes.includes(edge.to)
    );

    setAiResult('🔍 正在分析選取區域...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const analysis = await aiService.analyzeSelection(selectedNotesData, relatedEdges);
      setAiResult(analysis);
    } catch (error) {
      console.error('AI Analyze Selection error:', error);
      setAiResult('❌ 分析功能暫時無法使用。');
    }
    setShowAIMenu(false);
  };

  // AI 改進建議
  const handleAISuggestImprovements = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );

    setAiResult('✨ 正在生成改進建議...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const suggestions = await aiService.suggestImprovements(selectedNotesData);
      setAiResult(suggestions);
    } catch (error) {
      console.error('AI Suggest Improvements error:', error);
      setAiResult('❌ 建議功能暫時無法使用。');
    }
    setShowAIMenu(false);
  };

  // AI 內容重構
  const handleAIRestructure = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    const relatedEdges = whiteboardData.edges.filter(edge => 
      selectedNotes.includes(edge.from) || selectedNotes.includes(edge.to)
    );

    setAiResult('🔄 正在分析並重構內容...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const result = await aiService.restructureContent(selectedNotesData, relatedEdges);
      setAiResult(result.suggestion);
    } catch (error) {
      console.error('AI Restructure error:', error);
      setAiResult('❌ 重構功能暫時無法使用。');
    }
    setShowAIMenu(false);
  };

  // AI SWOT 分析
  const handleAISWOT = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    const topic = selectedNotesData.length > 0 ? selectedNotesData[0].content : '主題';

    setAiResult('📊 正在進行 SWOT 分析...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const swot = await aiService.generateSWOT(topic, selectedNotesData);
      
      // 格式化 SWOT 結果
      const swotResult = `📊 SWOT 分析：${topic}

💪 優勢 (Strengths):
${swot.strengths.map(s => `• ${s}`).join('\n')}

⚠️ 劣勢 (Weaknesses):
${swot.weaknesses.map(w => `• ${w}`).join('\n')}

🚀 機會 (Opportunities):
${swot.opportunities.map(o => `• ${o}`).join('\n')}

🔥 威脅 (Threats):
${swot.threats.map(t => `• ${t}`).join('\n')}`;
      
      setAiResult(swotResult);
    } catch (error) {
      console.error('AI SWOT error:', error);
      setAiResult('❌ SWOT 分析功能暫時無法使用。');
    }
    setShowAIMenu(false);
  };

  // AI 心智圖生成
  const handleAIMindMap = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    const centralIdea = selectedNotesData.length > 0 ? selectedNotesData[0].content : '核心概念';

    setAiResult('🧩 正在生成心智圖...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const mindMap = await aiService.generateMindMap(centralIdea);
      
      // 創建心智圖便利貼
      saveToHistory(whiteboardData);
      const centerX = 400;
      const centerY = 300;
      const radius = 150;
      
      const newNotes: StickyNote[] = mindMap.nodes.map((node, index) => {
        let x = centerX;
        let y = centerY;
        
        if (node.level === 0) {
          // 中心節點
          x = centerX;
          y = centerY;
        } else {
          // 計算圓形佈局
          const angle = (index / mindMap.nodes.filter(n => n.level === node.level).length) * 2 * Math.PI;
          x = centerX + radius * node.level * Math.cos(angle);
          y = centerY + radius * node.level * Math.sin(angle);
        }
        
        return {
          id: node.id,
          content: node.content,
          x,
          y,
          width: 120,
          height: 80,
          color: node.level === 0 ? '#FEF3C7' : '#DBEAFE'
        };
      });
      
      const newEdges: Edge[] = mindMap.connections.map(conn => ({
        id: uuidv4(),
        from: conn.from,
        to: conn.to
      }));
      
      updateWhiteboardData({
        ...whiteboardData,
        notes: [...whiteboardData.notes, ...newNotes],
        edges: [...whiteboardData.edges, ...newEdges]
      });
      
      setAiResult(`🧩 已生成「${centralIdea}」的心智圖！`);
    } catch (error) {
      console.error('AI Mind Map error:', error);
      setAiResult('❌ 心智圖生成功能暫時無法使用。');
    }
    setShowAIMenu(false);
  };

  // AI 關鍵路徑分析
  const handleAICriticalPath = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    const relatedEdges = whiteboardData.edges.filter(edge => 
      selectedNotes.includes(edge.from) && selectedNotes.includes(edge.to)
    );

    setAiResult('🛤️ 正在分析關鍵路徑...');
    
    try {
      const { aiService } = await import('../services/aiService');
      const pathAnalysis = await aiService.analyzeCriticalPath(selectedNotesData, relatedEdges);
      
      const pathResult = `🛤️ 關鍵路徑分析

📍 關鍵路徑:
${pathAnalysis.path.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

⚠️ 瓶頸點:
${pathAnalysis.bottlenecks.map(b => `• ${b}`).join('\n')}

💡 優化建議:
${pathAnalysis.suggestions.map(s => `• ${s}`).join('\n')}`;
      
      setAiResult(pathResult);
    } catch (error) {
      console.error('AI Critical Path error:', error);
      setAiResult('❌ 關鍵路徑分析功能暫時無法使用。');
    }
    setShowAIMenu(false);
  };

  // AI 詢問選取區域
  const handleAIAskSelection = () => {
    // 收集所有選中的便利貼內容
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    
    if (selectedNotesData.length === 0) return;
    
    // 將選中的便利貼 ID 存儲為陣列，用於多選詢問
    setAskAINoteId(selectedNotes.join(','));
    setShowAskAIDialog(true);
    setCustomPrompt('');
  };

  // AI 收斂節點 - 智能精簡子節點
  const handleAIConvergeNodes = async (isRegenerate = false) => {
    // 檢查是否選中了單一便利貼
    if (selectedNotes.length !== 1) {
      setAiResult('❗ 請選擇一個便利貼來收斂其子節點');
      return;
    }

    const targetNoteId = selectedNotes[0];
    const targetNote = whiteboardData.notes.find(note => note.id === targetNoteId);
    if (!targetNote) return;

    // 找到該便利貼的子節點（連出去的節點）
    const childEdges = whiteboardData.edges.filter(edge => edge.from === targetNoteId);
    const childNotes = childEdges.map(edge => 
      whiteboardData.notes.find(note => note.id === edge.to)
    ).filter(note => note !== undefined) as StickyNote[];

    if (childNotes.length < 3) {
      setAiResult('❗ 需要至少3個子節點才能進行收斂分析');
      return;
    }

    if (!isRegenerate) {
      setAiResult(`🎯 正在分析「${targetNote.content}」的 ${childNotes.length} 個子節點...`);
    }

    try {
      const { aiService } = await import('../services/aiService');
      const maxKeepCount = Math.max(2, Math.min(3, Math.floor(childNotes.length * 0.6))); // 保留 60% 但最少2個最多3個
      const result = await aiService.convergeNodes(targetNote, childNotes, whiteboardData, maxKeepCount);

      // 保存結果
      setPendingAIResult({
        type: 'converge',
        result: result,
        targetNote: targetNote,
        childNotes: childNotes
      });

      // 設置預覽數據
      setAIPreviewData({
        type: 'converge',
        title: `🎯 AI 節點收斂預覽`,
        description: `分析「${targetNote.content}」的子節點，建議保留最核心的項目`,
        preview: {
          targetNote: targetNote.content,
          keepNodes: result.keepNodes,
          removeNodes: result.removeNodes,
          analysis: result.analysis,
          originalCount: childNotes.length,
          keepCount: result.keepNodes.length,
          removeCount: result.removeNodes.length
        },
        onApply: () => {
          if (!pendingAIResult || pendingAIResult.type !== 'converge') return;

          saveToHistory(whiteboardData);
          
          const removeNodeIds = result.removeNodes.map(node => node.id);
          const removeEdgeIds = whiteboardData.edges
            .filter(edge => removeNodeIds.includes(edge.from) || removeNodeIds.includes(edge.to))
            .map(edge => edge.id);

          // 移除節點和相關連線
          updateWhiteboardData({
            ...whiteboardData,
            notes: whiteboardData.notes.filter(note => !removeNodeIds.includes(note.id)),
            edges: whiteboardData.edges.filter(edge => !removeEdgeIds.includes(edge.id))
          });

          const keepSummary = result.keepNodes.map(n => `✅ ${n.content}`).join('\n');
          const removeSummary = result.removeNodes.map(n => `❌ ${n.content}`).join('\n');

          setAiResult(`🎯 節點收斂完成！\n\n${result.analysis}\n\n保留 ${result.keepNodes.length} 個核心項目：\n${keepSummary}\n\n移除 ${result.removeNodes.length} 個項目：\n${removeSummary}`);
          setPendingAIResult(null);
        },
        onReject: () => {
          setAiResult('已取消節點收斂');
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          handleAIConvergeNodes(true);
        }
      });

      setShowAIPreview(true);
      if (!isRegenerate) {
        setAiResult('🎯 節點收斂分析完成！請查看預覽。');
      }
    } catch (error) {
      console.error('AI Converge Nodes error:', error);
      setAiResult('❌ AI 節點收斂功能暫時無法使用。');
    }
  };

  // AI 自動分組
  const handleAIAutoGroup = async (isRegenerate = false) => {
    if (!isRegenerate) {
      setAiResult('📁 正在進行 AI 自動分組...');
    }
    
    try {
      const { aiService } = await import('../services/aiService');
      const result = await aiService.autoGroupNotes(whiteboardData.notes);
      
      // 保存結果以供應用
      setPendingAIResult({
        type: 'group',
        result: result
      });
      
      // 準備預覽資料
      const previewGroups = result.groups.map(group => ({
        ...group,
        notes: whiteboardData.notes.filter(note => group.noteIds.includes(note.id))
      }));
      
      // 顯示預覽
      setAIPreviewData({
        type: 'group',
        title: '🤖 AI 自動分組預覽',
        description: '以下是 AI 建議的分組方案，您可以選擇套用、重新生成或拒絕。',
        preview: {
          groups: previewGroups,
          ungrouped: result.ungrouped
        },
        onApply: () => {
          saveToHistory(whiteboardData);
          
          // 應用分組結果
          const newGroups = result.groups.map(group => ({
            id: group.id,
            name: group.name,
            color: group.color,
            noteIds: group.noteIds,
            createdAt: new Date()
          }));
          
          // 更新便利貼的 groupId
          const updatedNotes = whiteboardData.notes.map(note => {
            const group = result.groups.find(g => g.noteIds.includes(note.id));
            if (group) {
              return { ...note, groupId: group.id };
            }
            return note;
          });
          
          updateWhiteboardData({
            ...whiteboardData,
            notes: updatedNotes,
            groups: [...(whiteboardData.groups || []), ...newGroups]
          });
          
          const groupSummary = result.groups.map(g => 
            `📁 ${g.name} (${g.noteIds.length}個項目)\n   理由: ${g.reason}`
          ).join('\n\n');
          
          setAiResult(`✅ AI 自動分組完成！\n\n${groupSummary}\n\n未分組項目: ${result.ungrouped.length}個`);
          setPendingAIResult(null);
        },
        onReject: () => {
          setAiResult('已取消 AI 自動分組');
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          setAiResult('🔄 正在重新生成分組...');
          handleAIAutoGroup(true);
        }
      });
      
      setShowAIPreview(true);
    } catch (error) {
      console.error('AI Auto Group error:', error);
      setAiResult('❌ AI 自動分組功能暫時無法使用。');
    }
  };

  // AI 自動生成便利貼
  const handleAIAutoGenerate = async (isRegenerate = false) => {
    if (!isRegenerate) {
      setAiResult('✨ 正在生成新的便利貼...');
    }
    
    try {
      const { aiService } = await import('../services/aiService');
      // 計算生成位置（在畫布中心或選定區域附近）
      const targetArea = selectedNotes.length > 0 
        ? (() => {
            const selectedNote = whiteboardData.notes.find(n => n.id === selectedNotes[0]);
            return selectedNote ? { x: selectedNote.x + 250, y: selectedNote.y } : { x: 600, y: 400 };
          })()
        : { x: 600, y: 400 };
      
      const result = await aiService.autoGenerateNotes(whiteboardData, targetArea);
      
      // 保存結果
      setPendingAIResult({
        type: 'generate',
        result: result,
        targetArea: targetArea
      });
      
      // 顯示預覽
      setAIPreviewData({
        type: 'generate',
        title: '🤖 AI 生成便利貼預覽',
        description: '以下是 AI 根據現有內容生成的新便利貼，您可以查看實際效果並決定是否套用。',
        preview: {
          notes: result.notes
        },
        onApply: () => {
          // 創建新便利貼
          const newNotes = result.notes.map((note, index) => ({
            id: `ai-note-${Date.now()}-${index}`,
            content: note.content,
            x: note.x,
            y: note.y,
            width: 200,
            height: 150,
            color: note.color
          }));
          
          updateWhiteboardData({
            ...whiteboardData,
            notes: [...whiteboardData.notes, ...newNotes]
          });
          
          const noteSummary = result.notes.map(n => 
            `📝 ${n.content}\n   理由: ${n.reason}`
          ).join('\n\n');
          
          setAiResult(`✅ 已生成 ${result.notes.length} 個新便利貼！\n\n${noteSummary}`);
          setPendingAIResult(null);
        },
        onReject: () => {
          setAiResult('已取消生成新便利貼');
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          setAiResult('🔄 正在重新生成便利貼...');
          handleAIAutoGenerate(true);
        }
      });
      
      setShowAIPreview(true);
    } catch (error) {
      console.error('AI Auto Generate error:', error);
      setAiResult('❌ AI 生成便利貼功能暫時無法使用。');
    }
  };

  // AI 自動連線
  const handleAIAutoConnect = async (isRegenerate = false) => {
    const targetNotes = selectedNotes.length > 0
      ? whiteboardData.notes.filter(note => selectedNotes.includes(note.id))
      : whiteboardData.notes;
    
    if (!isRegenerate) {
      setAiResult('🔗 正在分析並建立連線...');
    }
    
    try {
      const { aiService } = await import('../services/aiService');
      const result = await aiService.autoConnectNotes(targetNotes, whiteboardData.edges);
      
      // 保存結果
      setPendingAIResult({
        type: 'connect',
        result: result,
        targetNotes: targetNotes
      });
      
      // 準備預覽資料（加入便利貼內容）
      const previewEdges = result.edges.map(edge => ({
        ...edge,
        fromContent: targetNotes.find(n => n.id === edge.from)?.content || '未知',
        toContent: targetNotes.find(n => n.id === edge.to)?.content || '未知'
      }));
      
      // 顯示預覽
      setAIPreviewData({
        type: 'connect',
        title: '🤖 AI 自動連線預覽',
        description: '以下是 AI 分析出的概念連接關係，您可以查看視覺化預覽並決定是否套用。',
        preview: {
          edges: previewEdges.filter(edge => edge.confidence > 0.6)
        },
        onApply: () => {
          // 創建新連線（過濾掉低信心度的）
          const newEdges = result.edges
            .filter(edge => edge.confidence > 0.6)
            .map(edge => ({
              id: `ai-edge-${Date.now()}-${edge.from}-${edge.to}`,
              from: edge.from,
              to: edge.to
            }));
          
          updateWhiteboardData({
            ...whiteboardData,
            edges: [...whiteboardData.edges, ...newEdges]
          });
          
          const edgeSummary = result.edges
            .filter(edge => edge.confidence > 0.6)
            .map(e => {
              const fromNote = targetNotes.find(n => n.id === e.from);
              const toNote = targetNotes.find(n => n.id === e.to);
              return `🔗 ${fromNote?.content} → ${toNote?.content}\n   理由: ${e.reason} (信心度: ${Math.round(e.confidence * 100)}%)`;
            }).join('\n\n');
          
          setAiResult(`✅ 已建立 ${newEdges.length} 條新連線！\n\n${edgeSummary}`);
          setPendingAIResult(null);
        },
        onReject: () => {
          setAiResult('已取消自動連線');
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          setAiResult('🔄 正在重新分析連線...');
          handleAIAutoConnect(true);
        }
      });
      
      setShowAIPreview(true);
    } catch (error) {
      console.error('AI Auto Connect error:', error);
      setAiResult('❌ AI 自動連線功能暫時無法使用。');
    }
  };

  // AI 智能整理
  const handleAISmartOrganize = async (isRegenerate = false) => {
    if (!isRegenerate) {
      setAiResult('🎯 正在進行智能整理...');
    }
    
    try {
      const { aiService } = await import('../services/aiService');
      const result = await aiService.smartOrganize(whiteboardData);
      
      // 保存結果
      setPendingAIResult(result);
      
      // 設置預覽數據
      setAIPreviewData({
        type: 'organize',
        title: 'AI 智能整理預覽',
        description: '以下是 AI 對白板內容的整理建議',
        preview: {
          reason: result.reason,
          layout: result.layout,
          newGroups: result.newGroups,
          removeSuggestions: result.removeSuggestions
        },
        onApply: () => {
          if (!pendingAIResult) return;
          
          saveToHistory(whiteboardData);
          
          // 批次更新便利貼位置
          const updatedNotes = whiteboardData.notes.map(note => {
            const newPosition = pendingAIResult.layout.find(l => l.noteId === note.id);
            if (newPosition) {
              return {
                ...note,
                x: newPosition.newX,
                y: newPosition.newY
              };
            }
            return note;
          });
          
          // 更新群組
          const updatedGroups = [...(whiteboardData.groups || []), ...pendingAIResult.newGroups];
          
          // 移除建議的冗餘便利貼（如果有）
          if (pendingAIResult.removeSuggestions.length > 0) {
            const filteredNotes = updatedNotes.filter(note => 
              !pendingAIResult.removeSuggestions.includes(note.id)
            );
            updateWhiteboardData({
              ...whiteboardData,
              notes: filteredNotes,
              groups: updatedGroups
            });
          } else {
            updateWhiteboardData({
              ...whiteboardData,
              notes: updatedNotes,
              groups: updatedGroups
            });
          }
          
          setAiResult(`✅ 智能整理完成！\n\n${pendingAIResult.reason}\n\n調整項目: ${pendingAIResult.layout.length}個\n新群組: ${pendingAIResult.newGroups.length}個\n建議移除: ${pendingAIResult.removeSuggestions.length}個`);
          setPendingAIResult(null);
        },
        onReject: () => {
          setAiResult('已取消智能整理');
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          handleAISmartOrganize(true);
        }
      });
      
      setShowAIPreview(true);
      if (!isRegenerate) {
        setAiResult('🎯 智能整理分析完成！請查看預覽。');
      }
    } catch (error) {
      console.error('AI Smart Organize error:', error);
      setAiResult('❌ AI 智能整理功能暫時無法使用。');
    }
  };

  // 清除畫布功能

  const handleClearCanvas = useCallback(() => {
    if (whiteboardData.notes.length === 0 && whiteboardData.edges.length === 0) {
      return;
    }

    const confirmClear = window.confirm('確定要清除所有便利貼和連線嗎？此操作無法復原。');
    if (confirmClear) {
      setWhiteboardData({ notes: [], edges: [], groups: [] });
      setAiResult('');
      setSelectedNote(null);
      setConnectingFrom(null);
      StorageService.clearWhiteboardData();
      setLastSaveTime(null);
    }
  }, [whiteboardData]);

  return (
    <div className={`flex h-screen ${isDarkMode ? 'bg-dark-bg' : 'bg-white'}`}>
      {/* 白板畫布 */}
      <div 
        id="whiteboard-canvas"
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
          backgroundColor: isDarkMode ? '#1e1e1e' : 'white'
        }}
      >
        {/* 畫布使用提示 */}
        {whiteboardData.notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`text-center select-none ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
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
          {/* 背景點點層 - 與內容同步移動 */}
          <div 
            className="absolute z-0"
            style={{
              top: 0,
              left: 0,
              width: '2000vw',
              height: '2000vh',
              minWidth: '20000px',
              minHeight: '20000px',
              backgroundImage: isDarkMode 
                ? 'radial-gradient(circle, #333333 1px, transparent 1px)'
                : 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0',
              pointerEvents: 'none'
            }}
          />
          
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
                fill={isDarkMode ? "rgba(96, 165, 250, 0.15)" : "rgba(59, 130, 246, 0.1)"}
                stroke={isDarkMode ? "rgb(96, 165, 250)" : "rgb(59, 130, 246)"}
                strokeWidth={2 / zoomLevel}
                strokeDasharray={`${5 / zoomLevel},${5 / zoomLevel}`}
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
                  stroke={isDarkMode ? "rgb(96, 165, 250)" : "rgb(59, 130, 246)"}
                  strokeWidth={2 / zoomLevel}
                  strokeDasharray={`${8 / zoomLevel},${4 / zoomLevel}`}
                  rx="12"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}
            
            {/* 對齊輔助線 - 只在按住 Cmd 時顯示 */}
            {isHoldingCmd && alignmentGuides.map((guide, index) => {
              if (guide.type === 'horizontal') {
                // 水平輔助線
                return (
                  <line
                    key={`h-${index}`}
                    x1={guide.start}
                    y1={guide.position}
                    x2={guide.end}
                    y2={guide.position}
                    stroke={isDarkMode ? '#60A5FA' : '#3B82F6'}
                    strokeWidth={1 / zoomLevel}
                    opacity="0.6"
                  />
                );
              } else {
                // 垂直輔助線
                return (
                  <line
                    key={`v-${index}`}
                    x1={guide.position}
                    y1={guide.start}
                    x2={guide.position}
                    y2={guide.end}
                    stroke={isDarkMode ? '#60A5FA' : '#3B82F6'}
                    strokeWidth={1 / zoomLevel}
                    opacity="0.6"
                  />
                );
              }
            })}
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
              onAskAI={() => handleAskAI(note.id)}
              onStartConnection={() => handleStartConnection(note.id)}
              isAILoading={aiLoadingStates.brainstorm && aiLoadingStates.targetNoteId === note.id}
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
              onDragStart={() => {
                setIsDraggingNote(true);
              }}
              onDragEnd={() => {
                setIsDraggingNote(false);
                setAlignmentGuides([]);
              }}
            />
          ))}
        </div>

        {/* 儲存狀態指示器 - 固定在畫面上方 */}
        {lastSaveTime && (
          <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full shadow-md text-xs z-30 ${
            isDarkMode ? 'bg-dark-bg-secondary text-gray-400' : 'bg-white text-gray-600'
          }`}>
            <span className="text-green-600">✓</span> 自動儲存於 {lastSaveTime.toLocaleTimeString()}
          </div>
        )}

      </div>

      {/* 左下角控制按鈕 */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-2">
        {/* 回到內容中心按鈕 */}
        <button
          onClick={centerViewOnContent}
          className={`rounded-full p-3 shadow-lg hover:shadow-xl transition-all group ${
            isDarkMode ? 'bg-dark-bg-secondary hover:bg-dark-bg-tertiary' : 'bg-white hover:bg-gray-50'
          }`}
          title="回到內容中心 (Home)"
        >
          <svg 
            className={`w-5 h-5 transition-colors ${
              isDarkMode 
                ? 'text-gray-400 group-hover:text-blue-400' 
                : 'text-gray-600 group-hover:text-blue-600'
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
            />
          </svg>
        </button>
        
        {/* 重置視圖按鈕 */}
        <button
          onClick={() => {
            setZoomLevel(1);
            setPanOffset({ x: 0, y: 0 });
          }}
          className={`rounded-full p-3 shadow-lg hover:shadow-xl transition-all group ${
            isDarkMode ? 'bg-dark-bg-secondary hover:bg-dark-bg-tertiary' : 'bg-white hover:bg-gray-50'
          }`}
          title="重置視圖 (Reset)"
        >
          <svg 
            className="w-5 h-5 text-gray-600 group-hover:text-gray-800 transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </button>
      </div>

      {/* 右側面板 */}
      <SidePanel 
        aiResult={aiResult}
        currentProject={currentProject}
        syncStatus={syncStatus}
        aiLoadingStates={aiLoadingStates}
        onProjectClick={() => setShowProjectDialog(true)}
        onProjectSelect={(projectId) => {
          // 切換專案
          ProjectService.setCurrentProject(projectId);
          setCurrentProjectId(projectId);
          
          // 載入新專案資料
          const projectData = ProjectService.loadProjectData(projectId);
            
          if (projectData) {
            setWhiteboardData(projectData);
            if (projectData.viewport) {
              setZoomLevel(projectData.viewport.zoomLevel);
              setPanOffset(projectData.viewport.panOffset);
            } else {
              // 重置縮放和平移
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            }
          } else {
            // 如果沒有資料，初始化空白板
            setWhiteboardData({ notes: [], edges: [], groups: [] });
            // 重置縮放和平移
            setZoomLevel(1);
            setPanOffset({ x: 0, y: 0 });
          }
          
          // 更新當前專案資訊
          const projects = ProjectService.getAllProjects();
          const project = projects.find(p => p.id === projectId);
          setCurrentProject(project || null);
          
          // 重置歷史記錄
          setHistory([projectData || { notes: [], edges: [], groups: [] }]);
          setHistoryIndex(0);
        }}
        onProjectCreate={(name, description) => {
          // 創建新專案並切換到它
          const newProject = ProjectService.createProject(name, description);
          ProjectService.setCurrentProject(newProject.id);
          setCurrentProjectId(newProject.id);
          setCurrentProject(newProject);
          
          // 初始化空白板
          setWhiteboardData({ notes: [], edges: [], groups: [] });
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
          
          // 初始化歷史記錄
          setHistory([{ notes: [], edges: [], groups: [] }]);
          setHistoryIndex(0);
        }}
        onProjectDelete={(projectId) => {
          // 刪除專案
          ProjectService.deleteProject(projectId);
          
          // 如果刪除的是當前專案，切換到第一個專案
          if (projectId === currentProjectId) {
            const projects = ProjectService.getAllProjects();
            if (projects.length > 0) {
              const firstProject = projects[0];
              setCurrentProjectId(firstProject.id);
              setCurrentProject(firstProject);
              
              const projectData = ProjectService.loadProjectData(firstProject.id);
              if (projectData) {
                setWhiteboardData(projectData);
              } else {
                setWhiteboardData({ notes: [], edges: [], groups: [] });
              }
            } else {
              // 沒有專案了，創建預設專案
              const defaultProject = ProjectService.createProject('我的白板', '預設專案');
              setCurrentProjectId(defaultProject.id);
              setCurrentProject(defaultProject);
              setWhiteboardData({ notes: [], edges: [], groups: [] });
            }
          }
        }}
        cloudSyncEnabled={cloudSyncEnabled}
        onToggleCloudSync={handleToggleCloudSync}
      />

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
        aiLoadingStates={aiLoadingStates}
        onExport={async (format) => {
          try {
            if (format === 'json') {
              const { exportWhiteboard } = await import('../services/exportService');
              await exportWhiteboard.asJSON(whiteboardData);
              setAiResult('✅ 已成功匯出為 JSON 檔案');
            } else if (format === 'png') {
              const { exportWhiteboard } = await import('../services/exportService');
              await exportWhiteboard.asPNG('whiteboard-canvas');
              setAiResult('✅ 已成功匯出為 PNG 圖片');
            } else if (format === 'pdf') {
              const { exportWhiteboard } = await import('../services/exportService');
              await exportWhiteboard.asPDF('whiteboard-canvas');
              setAiResult('✅ 已成功匯出為 PDF 檔案');
            }
          } catch (error) {
            console.error('匯出失敗:', error);
            setAiResult('❌ 匯出失敗，請稍後再試');
          }
        }}
        onSearch={() => {
          // TODO: 實現搜尋功能
          console.log('Search');
        }}
        onTemplate={() => {
          setShowTemplates(true);
        }}
        onNotes={() => {
          setShowNotes(true);
        }}
        onAIAnalyzeSelection={handleAIAnalyzeSelection}
        onAISuggestImprovements={handleAISuggestImprovements}
        onAIRestructure={handleAIRestructure}
        onAISWOT={handleAISWOT}
        onAIMindMap={handleAIMindMap}
        onAICriticalPath={handleAICriticalPath}
        onAIAutoGroup={handleAIAutoGroup}
        onAIAutoGenerate={handleAIAutoGenerate}
        onAIAutoConnect={handleAIAutoConnect}
        onAISmartOrganize={handleAISmartOrganize}
        onAIAskSelection={handleAIAskSelection}
        onAIConvergeNodes={handleAIConvergeNodes}
      />

      {/* 筆記面板 */}
      <Notes 
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
      />
      
      {/* 範本面板 */}
      <Templates
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onApplyTemplate={(template) => {
          saveToHistory(whiteboardData);
          
          // 為範本中的每個元素生成新的 ID
          const idMap = new Map<string, string>();
          
          // 生成新的便利貼
          const newNotes = template.data.notes.map(noteData => {
            const newId = uuidv4();
            idMap.set(noteData.id || '', newId);
            return {
              id: newId,
              content: noteData.content || '',
              x: noteData.x || 0,
              y: noteData.y || 0,
              width: noteData.width || 150,
              height: noteData.height || 100,
              color: noteData.color || '#FEF3C7',
              groupId: null
            } as StickyNote;
          });
          
          // 生成新的連線（更新 ID 引用）
          const newEdges = template.data.edges.map(edgeData => ({
            id: uuidv4(),
            from: idMap.get(edgeData.from || '') || edgeData.from || '',
            to: idMap.get(edgeData.to || '') || edgeData.to || ''
          } as Edge));
          
          // 生成新的群組
          const newGroups = template.data.groups?.map(groupData => {
            const newGroupId = uuidv4();
            const newGroup: Group = {
              id: newGroupId,
              name: groupData.name || '未命名群組',
              noteIds: [],
              x: groupData.x || 0,
              y: groupData.y || 0,
              width: groupData.width || 200,
              height: groupData.height || 200,
              color: groupData.color || '#F3F4F6'
            };
            
            // 將在群組範圍內的便利貼加入群組
            newNotes.forEach(note => {
              if (note.x >= newGroup.x && 
                  note.x + note.width <= newGroup.x + newGroup.width &&
                  note.y >= newGroup.y && 
                  note.y + note.height <= newGroup.y + newGroup.height) {
                newGroup.noteIds.push(note.id);
                note.groupId = newGroupId;
              }
            });
            
            return newGroup;
          }) || [];
          
          // 套用範本
          updateWhiteboardData({
            notes: [...whiteboardData.notes, ...newNotes],
            edges: [...whiteboardData.edges, ...newEdges],
            groups: [...(whiteboardData.groups || []), ...newGroups]
          });
          
          setAiResult(`✅ 已成功套用範本「${template.name}」`);
        }}
      />
      
      {/* 專案選擇對話框 */}
      <ProjectDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        onSelectProject={async (projectId) => {
          // 切換專案
          ProjectService.setCurrentProject(projectId);
          setCurrentProjectId(projectId);
          
          // 載入新專案資料
          const projectData = ProjectService.loadProjectData(projectId);
            
          if (projectData) {
            setWhiteboardData(projectData);
            if (projectData.viewport) {
              setZoomLevel(projectData.viewport.zoomLevel);
              setPanOffset(projectData.viewport.panOffset);
            }
            // 重置歷史記錄
            setHistory([projectData]);
            setHistoryIndex(0);
          }
          
          // 更新當前專案資訊
          const projects = ProjectService.getAllProjects();
          const project = projects.find(p => p.id === projectId);
          setCurrentProject(project || null);
          
          setShowProjectDialog(false);
          setAiResult(`✅ 已切換到專案：${project?.name || '未知專案'}`);
        }}
        currentProjectId={currentProjectId}
      />
      
      {/* 自訂 AI 詢問對話框 */}
      {showAskAIDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className={`rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 ${
            isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-dark-text' : 'text-gray-800'
            }`}>
              💬 詢問 AI
            </h3>
            
            <p className={`text-sm mb-4 ${
              isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
            }`}>
              {askAINoteId && askAINoteId.includes(',') 
                ? `輸入您的問題，AI 將基於選定的 ${askAINoteId.split(',').length} 個便利貼內容來回答。`
                : '輸入您的問題，AI 將基於目前的便利貼內容和相關脈絡來回答。'
              }
            </p>
            
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例如：這個概念如何應用在實際專案中？"
              className={`w-full h-32 p-3 rounded-lg border resize-none ${
                isDarkMode 
                  ? 'bg-dark-bg border-gray-600 text-dark-text' 
                  : 'bg-gray-50 border-gray-300 text-gray-800'
              }`}
              autoFocus
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSubmitAskAI}
                disabled={!customPrompt.trim()}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  customPrompt.trim()
                    ? isDarkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                    : isDarkMode
                      ? 'bg-dark-bg-tertiary text-dark-text-secondary cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                送出
              </button>
              <button
                onClick={() => {
                  setShowAskAIDialog(false);
                  setAskAINoteId(null);
                  setCustomPrompt('');
                }}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-dark-bg-tertiary text-dark-text hover:bg-dark-bg-hover'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 預覽對話框 */}
      <AIPreviewDialog
        isOpen={showAIPreview}
        onClose={() => {
          setShowAIPreview(false);
          setAIPreviewData(null);
        }}
        previewData={aiPreviewData}
      />
    </div>
  );
};

export default Whiteboard;