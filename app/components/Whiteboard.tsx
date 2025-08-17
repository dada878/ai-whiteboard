'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { AIPreviewData } from './AIPreviewDialog';
import { v4 as uuidv4 } from 'uuid';
import { StickyNote, Edge, Group, WhiteboardData, NetworkAnalysis, NetworkConnection, Project, ImageElement } from '../types';
import StickyNoteComponent from './StickyNote';
import EdgeComponent from './Edge';
import GroupComponent from './Group';
import ImageElementComponent from './ImageElement';
import FloatingToolbar from './FloatingToolbar';
import MobileMenu from './MobileMenu';
import SidePanel from './SidePanel';
import Templates from './Templates';
import ProjectDialog from './ProjectDialog';
import AIPreviewDialog from './AIPreviewDialog';
import VersionDialog from './VersionDialog';
import { StorageService } from '../services/storageService';
import { AlignmentService } from '../services/alignmentService';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { ProjectService } from '../services/projectService';
import { SyncService, SyncStatus } from '../services/syncService';
import { AnalyticsService } from '../services/analyticsService';
import { RealAnalyticsService } from '../services/realAnalyticsService';
import * as gtag from '../../lib/gtag';
import { VersionService } from '../services/versionService';
// import GATestButton from './GATestButton';

const Whiteboard: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [whiteboardData, setWhiteboardData] = useState<WhiteboardData>({
    notes: [],
    edges: [],
    groups: [],
    images: []
  });
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  // 歷史記錄系統
  const [history, setHistory] = useState<WhiteboardData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [clipboard, setClipboard] = useState<StickyNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]); // 多選便利貼
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null); // 選中的群組
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]); // 多選群組
  const [autoEditNoteId, setAutoEditNoteId] = useState<string | null>(null); // 需要自動編輯的便利貼 ID
  const [previewSelectedNotes, setPreviewSelectedNotes] = useState<string[]>([]); // 框選預覽
  const [previewSelectedGroups, setPreviewSelectedGroups] = useState<string[]>([]); // 群組框選預覽
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]); // 多選圖片
  const [hoveredImage, setHoveredImage] = useState<string | null>(null); // 懸停的圖片
  const [dragHoveredGroup, setDragHoveredGroup] = useState<string | null>(null); // 拖拽時懸停的群組
  const [draggedGroupHoveredGroup, setDraggedGroupHoveredGroup] = useState<string | null>(null); // 群組拖拽時懸停的目標群組
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
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncService.getSyncStatus());
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [aiPreviewData, setAIPreviewData] = useState<AIPreviewData | null>(null);
  const [pendingAIResult, setPendingAIResult] = useState<{
    type: string;
    result?: unknown;
    reason?: string;
    layout?: unknown[];
    newGroups?: unknown[];
    removeSuggestions?: unknown[];
    targetNote?: unknown;
    childNotes?: unknown[];
    targetArea?: unknown;
    targetNotes?: unknown[];
  } | null>(null);
  const [autoFocusGroupId, setAutoFocusGroupId] = useState<string | null>(null);
  const [recentDragSelect, setRecentDragSelect] = useState(false);
  
  // 用戶行為追蹤
  const [sessionId] = useState(() => uuidv4());
  const sessionStartTime = useRef<Date>(new Date());
  
  // 追蹤用戶事件的輔助函數
  const trackEvent = useCallback((eventType: string, metadata?: Record<string, unknown>) => {
    if (user?.id) {
      AnalyticsService.trackEvent(eventType, user.id, sessionId, metadata);
    }
  }, [user?.id, sessionId]);

  // Plus 權限檢查
  const requirePlus = useCallback(() => {
    if (!user?.isPlus) {
      // Plus 會員限定功能檢查
      return false;
    }
    return true;
  }, [user]);
  
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
  const whiteboardDataRef = useRef<WhiteboardData>(whiteboardData);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 3;

  // 同步更新 whiteboardDataRef
  useEffect(() => {
    whiteboardDataRef.current = whiteboardData;
  }, [whiteboardData]);

  // 包裝的 setWhiteboardData 函數，會同時標記本地變更時間
  const updateWhiteboardData = useCallback((
    updater: WhiteboardData | ((prev: WhiteboardData) => WhiteboardData)
  ) => {
    setWhiteboardData(updater);
    SyncService.markLocalChange();
    console.log('[Whiteboard] Local change marked');
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
    const allImageIds = whiteboardData.images?.map(img => img.id) || [];
    setSelectedNotes(allNoteIds);
    setSelectedImages(allImageIds);
    setSelectedNote(null);
    setSelectedImage(null);
  }, [whiteboardData.notes, whiteboardData.images]);

  const deleteSelectedItems = useCallback(() => {
    saveToHistory(whiteboardData);
    
    const hasSelectedNotes = selectedNotes.length > 0 || selectedNote;
    const hasSelectedImages = selectedImages.length > 0 || selectedImage;
    
    if (hasSelectedNotes || hasSelectedImages) {
      const notesToDelete = selectedNote ? [selectedNote] : selectedNotes;
      const imagesToDelete = selectedImage && !selectedImages.includes(selectedImage) 
        ? [selectedImage] 
        : selectedImages;
      
      updateWhiteboardData(prev => ({
        ...prev,
        notes: prev.notes.filter(note => !notesToDelete.includes(note.id)),
        edges: prev.edges.filter(edge => 
          !notesToDelete.includes(edge.from) && !notesToDelete.includes(edge.to) &&
          !imagesToDelete.includes(edge.from) && !imagesToDelete.includes(edge.to)
        ),
        groups: prev.groups,
        images: (prev.images || []).filter(image => !imagesToDelete.includes(image.id))
      }));
      
      setSelectedNotes([]);
      setSelectedNote(null);
      setSelectedImages([]);
      setSelectedImage(null);
    } else if (selectedEdge) {
      updateWhiteboardData(prev => ({
        ...prev,
        edges: prev.edges.filter(edge => edge.id !== selectedEdge)
      }));
      setSelectedEdge(null);
    }
  }, [selectedNotes, selectedNote, selectedImages, selectedImage, selectedEdge, whiteboardData, saveToHistory]);

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
  const createGroup = useCallback((noteIds: string[], imageIds: string[] = [], parentGroupId?: string) => {
    if (noteIds.length + imageIds.length < 2) return null;
    
    saveToHistory(whiteboardData);
    
    // 檢查所有選中的便利貼和圖片是否都在同一個群組內
    const selectedNotesData = whiteboardData.notes.filter(n => noteIds.includes(n.id));
    const selectedImagesData = (whiteboardData.images || []).filter(img => imageIds.includes(img.id));
    
    const allGroupIds = [
      ...selectedNotesData.map(n => n.groupId).filter(Boolean),
      ...selectedImagesData.map(img => img.groupId).filter(Boolean)
    ];
    
    // 檢查是否所有項目都在同一個群組內
    const uniqueGroupIds = [...new Set(allGroupIds)];
    const isAllInSameGroup = uniqueGroupIds.length === 1 && 
                             allGroupIds.length === (selectedNotesData.length + selectedImagesData.length);
    
    console.log(`[createGroup] Selected notes: ${noteIds.join(',')}`);
    console.log(`[createGroup] All group IDs: ${allGroupIds.join(',')}`);
    console.log(`[createGroup] Unique group IDs: ${uniqueGroupIds.join(',')}`);
    console.log(`[createGroup] Is all in same group: ${isAllInSameGroup}`);
    console.log(`[createGroup] Parent group ID param: ${parentGroupId}`);
    
    // 如果所有項目都在同一個群組內，且沒有指定父群組，則將該群組作為父群組
    const finalParentGroupId = isAllInSameGroup && !parentGroupId ? uniqueGroupIds[0] : parentGroupId;
    
    console.log(`[createGroup] Final parent group ID: ${finalParentGroupId}`);
    
    const groupId = uuidv4();
    const groupColors = ['#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0', '#FCE4EC'];
    const randomColor = groupColors[Math.floor(Math.random() * groupColors.length)];
    
    const newGroup: Group = {
      id: groupId,
      name: `群組 ${(whiteboardData.groups || []).length + 1}`,
      color: randomColor,
      createdAt: new Date(),
      noteIds: noteIds,
      imageIds: imageIds,
      parentGroupId: finalParentGroupId,
      childGroupIds: []
    };

    updateWhiteboardData(prev => ({
      ...prev,
      groups: [...(prev.groups || []), newGroup].map(group => {
        // 如果是父群組，更新其 childGroupIds
        if (finalParentGroupId && group.id === finalParentGroupId) {
          return {
            ...group,
            childGroupIds: [...(group.childGroupIds || []), groupId]
          };
        }
        return group;
      }),
      notes: prev.notes.map(note => 
        noteIds.includes(note.id) 
          ? { ...note, groupId }  // 所有選中的便利貼都設定為新群組的 ID
          : note
      ),
      images: (prev.images || []).map(img => 
        imageIds.includes(img.id) 
          ? { ...img, groupId }  // 所有選中的圖片都設定為新群組的 ID
          : img
      )
    }));

    setSelectedGroup(groupId);
    setSelectedNotes([]);
    setSelectedImages([]);
    setSelectedNote(null);
    setSelectedImage(null);
    setAutoFocusGroupId(groupId);
    
    return groupId;
  }, [whiteboardData, saveToHistory]);

  // 創建父群組
  const createParentGroup = useCallback((childGroupIds: string[], noteIds: string[] = [], imageIds: string[] = []) => {
    console.log(`GROUP_SELECT: Creating parent group for groups: [${childGroupIds.join(',')}], notes: [${noteIds.join(',')}], images: [${imageIds.join(',')}]`);
    
    // 需要至少2個元素（群組+便利貼+圖片）才能創建父群組
    const totalElements = childGroupIds.length + noteIds.length + imageIds.length;
    if (totalElements < 2) {
      console.log(`GROUP_SELECT: Need at least 2 elements total, got ${totalElements}`);
      return null;
    }
    
    console.log('GROUP_SELECT: Groups before creation:', whiteboardData.groups?.map(g => ({
      id: g.id,
      name: g.name,
      parentGroupId: g.parentGroupId,
      childGroupIds: g.childGroupIds,
      noteIds: g.noteIds,
      imageIds: g.imageIds
    })));
    
    saveToHistory(whiteboardData);
    const parentGroupId = uuidv4();
    const groupColors = ['#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0', '#FCE4EC'];
    const randomColor = groupColors[Math.floor(Math.random() * groupColors.length)];
    
    const newParentGroup: Group = {
      id: parentGroupId,
      name: `父群組 ${(whiteboardData.groups || []).length + 1}`,
      color: randomColor,
      createdAt: new Date(),
      noteIds: noteIds,  // 直接包含便利貼
      imageIds: imageIds, // 直接包含圖片
      childGroupIds: childGroupIds
    };

    console.log('GROUP_SELECT: New parent group:', {
      id: newParentGroup.id,
      name: newParentGroup.name,
      childGroupIds: newParentGroup.childGroupIds
    });

    updateWhiteboardData(prev => {
      const updatedGroups = [...(prev.groups || []), newParentGroup].map(group => {
        // 更新子群組的 parentGroupId
        if (childGroupIds.includes(group.id)) {
          console.log(`GROUP_SELECT: Setting parentGroupId for child ${group.id} to ${parentGroupId}`);
          return {
            ...group,
            parentGroupId: parentGroupId
          };
        }
        return group;
      });
      
      // 更新便利貼的 groupId
      const updatedNotes = prev.notes.map(note => 
        noteIds.includes(note.id) 
          ? { ...note, groupId: parentGroupId }
          : note
      );
      
      // 更新圖片的 groupId
      const updatedImages = (prev.images || []).map(img => 
        imageIds.includes(img.id) 
          ? { ...img, groupId: parentGroupId }
          : img
      );
      
      console.log('GROUP_SELECT: Groups after update:', updatedGroups.map(g => ({
        id: g.id,
        name: g.name,
        parentGroupId: g.parentGroupId,
        childGroupIds: g.childGroupIds,
        noteIds: g.noteIds,
        imageIds: g.imageIds
      })));
      
      return {
        ...prev,
        groups: updatedGroups,
        notes: updatedNotes,
        images: updatedImages
      };
    });

    setSelectedGroup(parentGroupId);
    console.log('GROUP_SELECT: Clearing selection and focusing parent');
    setSelectedGroups([]); // 清除多選狀態
    setAutoFocusGroupId(parentGroupId);
    
    console.log('✅ createParentGroup completed, selected group:', parentGroupId);
    
    return parentGroupId;
  }, [whiteboardData, saveToHistory]);

  const ungroupNotes = useCallback((groupId: string) => {
    saveToHistory(whiteboardData);
    const group = (whiteboardData.groups || []).find(g => g.id === groupId);
    if (!group) return;

    updateWhiteboardData(prev => ({
      ...prev,
      groups: (prev.groups || [])
        .filter(g => g.id !== groupId)
        .map(g => {
          // 如果這個群組是被刪除群組的父群組，移除子群組關聯
          if (g.childGroupIds?.includes(groupId)) {
            return {
              ...g,
              childGroupIds: g.childGroupIds.filter(cid => cid !== groupId)
            };
          }
          // 如果這個群組是被刪除群組的子群組，移除父群組關聯
          if (g.parentGroupId === groupId) {
            return {
              ...g,
              parentGroupId: undefined
            };
          }
          return g;
        }),
      notes: prev.notes.map(note => 
        note.groupId === groupId 
          ? { ...note, groupId: undefined }
          : note
      ),
      images: (prev.images || []).map(img => 
        img.groupId === groupId 
          ? { ...img, groupId: undefined }
          : img
      )
    }));

    // 取消群組後選中原本群組內的便利貼和圖片
    setSelectedNotes(group.noteIds);
    setSelectedImages(group.imageIds || []);
    setSelectedGroup(null);
  }, [whiteboardData, saveToHistory]);

  const getGroupNotes = useCallback((groupId: string): StickyNote[] => {
    return whiteboardData.notes.filter(note => note.groupId === groupId);
  }, [whiteboardData.notes]);

  const getGroupBounds = useCallback((groupId: string) => {
    const group = whiteboardData.groups?.find(g => g.id === groupId);
    if (!group) return null;
    
    // 收集所有元素：直接包含的便利貼/圖片 + 子群組的邊界
    const allElements: Array<{x: number, y: number, width: number, height: number}> = [];
    
    // 添加直接包含的便利貼
    const groupNotes = getGroupNotes(groupId);
    allElements.push(...groupNotes);
    
    // 添加直接包含的圖片
    const groupImages = whiteboardData.images?.filter(img => img.groupId === groupId) || [];
    allElements.push(...groupImages);
    
    // 遞歸添加子群組的邊界
    if (group.childGroupIds && group.childGroupIds.length > 0) {
      for (const childGroupId of group.childGroupIds) {
        const childBounds = getGroupBounds(childGroupId);
        if (childBounds) {
          allElements.push({
            x: childBounds.x,
            y: childBounds.y,
            width: childBounds.width,
            height: childBounds.height
          });
        }
      }
    }
    
    if (allElements.length === 0) return null;

    const minX = Math.min(...allElements.map(el => el.x));
    const minY = Math.min(...allElements.map(el => el.y));
    const maxX = Math.max(...allElements.map(el => el.x + el.width));
    const maxY = Math.max(...allElements.map(el => el.y + el.height));

    return {
      x: minX - 15,
      y: minY - 15,
      width: maxX - minX + 30,
      height: maxY - minY + 30
    };
  }, [getGroupNotes, whiteboardData.groups, whiteboardData.images]);

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

    // 收集所有要刪除的群組ID（包括子群組）
    const getAllGroupsToDelete = (id: string): string[] => {
      const currentGroup = whiteboardData.groups?.find(g => g.id === id);
      if (!currentGroup) return [id];
      
      let groupsToDelete = [id];
      if (currentGroup.childGroupIds) {
        for (const childId of currentGroup.childGroupIds) {
          groupsToDelete = groupsToDelete.concat(getAllGroupsToDelete(childId));
        }
      }
      return groupsToDelete;
    };

    const allGroupIdsToDelete = getAllGroupsToDelete(groupId);
    
    // 收集所有要刪除的便利貼和圖片
    const noteIdsToDelete: string[] = [];
    const imageIdsToDelete: string[] = [];
    
    allGroupIdsToDelete.forEach(gId => {
      const g = whiteboardData.groups?.find(group => group.id === gId);
      if (g) {
        noteIdsToDelete.push(...g.noteIds);
        imageIdsToDelete.push(...(g.imageIds || []));
      }
    });

    // 找到相關的連線
    const edgesToDelete = whiteboardData.edges.filter(edge => 
      noteIdsToDelete.includes(edge.from) || noteIdsToDelete.includes(edge.to)
    );

    updateWhiteboardData(prev => ({
      ...prev,
      notes: prev.notes.filter(note => !noteIdsToDelete.includes(note.id)),
      images: (prev.images || []).filter(img => !imageIdsToDelete.includes(img.id)),
      edges: prev.edges.filter(edge => !edgesToDelete.includes(edge)),
      groups: (prev.groups || [])
        .filter(g => !allGroupIdsToDelete.includes(g.id))
        .map(g => {
          // 如果這個群組是被刪除群組的父群組，移除子群組關聯
          if (g.childGroupIds?.some(cid => allGroupIdsToDelete.includes(cid))) {
            return {
              ...g,
              childGroupIds: g.childGroupIds.filter(cid => !allGroupIdsToDelete.includes(cid))
            };
          }
          return g;
        })
    }));

    setSelectedGroup(null);
  }, [whiteboardData, saveToHistory]);

  // 檢查便利貼是否在群組範圍內
  // 檢查一個群組是否是另一個群組的祖先（父群組或更上層）
  const isAncestorGroup = useCallback((ancestorId: string, descendantId: string): boolean => {
    if (!ancestorId || !descendantId || ancestorId === descendantId) return false;
    
    const descendantGroup = whiteboardData.groups?.find(g => g.id === descendantId);
    if (!descendantGroup) return false;
    
    // 檢查直接父群組
    if (descendantGroup.parentGroupId === ancestorId) return true;
    
    // 遞歸檢查更上層的父群組
    if (descendantGroup.parentGroupId) {
      return isAncestorGroup(ancestorId, descendantGroup.parentGroupId);
    }
    
    return false;
  }, [whiteboardData.groups]);

  const checkNoteOverGroup = useCallback((noteId: string, noteX: number, noteY: number, noteWidth: number, noteHeight: number): string | null => {
    const note = whiteboardData.notes.find(n => n.id === noteId);
    if (!note) return null;
    
    // 如果便利貼已經屬於某個群組，不允許自動切換
    if (note.groupId) {
      console.log(`DRAG: Note ${noteId} already in group ${note.groupId}, skipping auto-switch`);
      return null;
    }
    
    // 找出所有符合條件的群組
    const candidateGroups: { groupId: string; depth: number }[] = [];
    
    for (const group of whiteboardData.groups || []) {
      const bounds = getGroupBounds(group.id);
      if (!bounds) continue;
      
      
      // 檢查便利貼中心點是否在群組範圍內
      const noteCenterX = noteX + noteWidth / 2;
      const noteCenterY = noteY + noteHeight / 2;
      
      if (noteCenterX >= bounds.x && 
          noteCenterX <= bounds.x + bounds.width &&
          noteCenterY >= bounds.y && 
          noteCenterY <= bounds.y + bounds.height) {
        // 計算群組深度（子群組優先）
        let depth = 0;
        let currentGroup = group;
        while (currentGroup.parentGroupId) {
          depth++;
          const parent = whiteboardData.groups?.find(g => g.id === currentGroup.parentGroupId);
          if (!parent) break;
          currentGroup = parent;
        }
        candidateGroups.push({ groupId: group.id, depth });
      }
    }
    
    // 選擇最深層的群組（子群組優先）
    if (candidateGroups.length > 0) {
      candidateGroups.sort((a, b) => b.depth - a.depth);
      return candidateGroups[0].groupId;
    }
    
    return null;
  }, [whiteboardData.groups, whiteboardData.notes, getGroupBounds, isAncestorGroup]);

  // 處理便利貼拖曳到群組
  const handleNoteDragOverGroup = useCallback((noteId: string, noteX: number, noteY: number, noteWidth: number, noteHeight: number) => {
    const hoveredGroupId = checkNoteOverGroup(noteId, noteX, noteY, noteWidth, noteHeight);
    setDragHoveredGroup(hoveredGroupId);
  }, [checkNoteOverGroup]);

  // 將便利貼添加到群組
  const addNoteToGroup = useCallback((noteId: string, groupId: string) => {
    saveToHistory(whiteboardData);
    
    const note = whiteboardData.notes.find(n => n.id === noteId);
    const group = whiteboardData.groups?.find(g => g.id === groupId);
    
    if (!note || !group) return;
    
    // 檢查便利貼是否已經在這個群組中
    if (note.groupId === groupId) {
      return; // 已經在群組中，不需要任何操作
    }
    
    // 同時更新便利貼的 groupId 和群組的 noteIds
    updateWhiteboardData({
      ...whiteboardData,
      notes: whiteboardData.notes.map(n => 
        n.id === noteId ? { ...n, groupId: groupId } : n
      ),
      groups: whiteboardData.groups?.map(g => {
        if (g.id === groupId) {
          // 添加到新群組
          return { ...g, noteIds: [...(g.noteIds || []), noteId] };
        } else if (g.noteIds?.includes(noteId)) {
          // 從舊群組移除
          return { ...g, noteIds: g.noteIds.filter(id => id !== noteId) };
        }
        return g;
      })
    });
  }, [whiteboardData, saveToHistory, updateWhiteboardData]);

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
    const positions: {[key: string]: {x: number, y: number}} = {};
    
    // 加入選中的便利貼
    if (selectedNotes.length > 0) {
      selectedNotes.forEach(noteId => {
        const note = whiteboardData.notes.find(n => n.id === noteId);
        if (note) {
          positions[noteId] = { x: note.x, y: note.y };
        }
      });
    }
    
    // 加入選中的圖片
    if (selectedImages.length > 0) {
      selectedImages.forEach(imgId => {
        const img = whiteboardData.images?.find(i => i.id === imgId);
        if (img) {
          positions[imgId] = { x: img.x, y: img.y };
        }
      });
    }
    
    if (Object.keys(positions).length > 0) {
      setBatchDragInitialPositions(positions);
    }
  }, [selectedNotes, selectedImages, whiteboardData.notes, whiteboardData.images]);

  // 批量移動
  const handleBatchMove = useCallback((deltaX: number, deltaY: number) => {
    // 檢查是否有選中的元素或批量拖曳的初始位置
    const hasBatchPositions = Object.keys(batchDragInitialPositions).length > 0;
    
    if (selectedNotes.length > 0 || selectedImages.length > 0 || hasBatchPositions) {
      // 獲取正在移動的便利貼和圖片
      const movingNotes = whiteboardData.notes.filter(note => selectedNotes.includes(note.id));
      const movingImages = whiteboardData.images?.filter(img => selectedImages.includes(img.id)) || [];
      
      let snappedDeltaX = deltaX;
      let snappedDeltaY = deltaY;
      
      // 只在按住 Cmd 時計算對齊
      if (isHoldingCmd && movingNotes.length > 0) {
        // 計算對齊（目前只對便利貼進行對齊）
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
      
      updateWhiteboardData(prev => ({
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
          // 也處理群組內的便利貼
          if (batchDragInitialPositions[note.id]) {
            const initialPos = batchDragInitialPositions[note.id];
            return {
              ...note,
              x: initialPos.x + snappedDeltaX,
              y: initialPos.y + snappedDeltaY
            };
          }
          return note;
        }),
        images: (prev.images || []).map(img => {
          if (selectedImages.includes(img.id)) {
            const initialPos = batchDragInitialPositions[img.id];
            if (initialPos) {
              return {
                ...img,
                x: initialPos.x + snappedDeltaX,
                y: initialPos.y + snappedDeltaY
              };
            }
          }
          // 也處理群組內的圖片
          if (batchDragInitialPositions[img.id]) {
            const initialPos = batchDragInitialPositions[img.id];
            return {
              ...img,
              x: initialPos.x + snappedDeltaX,
              y: initialPos.y + snappedDeltaY
            };
          }
          return img;
        })
      }));
    }
  }, [selectedNotes, selectedImages, batchDragInitialPositions, whiteboardData.notes, whiteboardData.images, isHoldingCmd]);

  // 檢查滑鼠是否在其他群組上（用於群組拖曳）
  const checkMouseOverGroup = useCallback((mouseX: number, mouseY: number, draggedGroupId: string) => {
    const draggedGroup = whiteboardData.groups?.find(g => g.id === draggedGroupId);
    if (!draggedGroup) return null;
    
    // 如果被拖曳的群組已經有父群組，不能再成為子群組
    if (draggedGroup.parentGroupId) return null;
    
    // 檢查所有群組，找出滑鼠所在的群組
    for (const group of whiteboardData.groups || []) {
      if (group.id === draggedGroupId) continue; // 不檢查自己
      if (group.parentGroupId) continue; // 只能拖入頂層群組
      
      const groupBounds = getGroupBounds(group.id);
      if (!groupBounds) continue;
      
      // 檢查滑鼠是否在群組範圍內
      if (mouseX >= groupBounds.x && 
          mouseX <= groupBounds.x + groupBounds.width &&
          mouseY >= groupBounds.y && 
          mouseY <= groupBounds.y + groupBounds.height) {
        return group.id;
      }
    }
    
    return null;
  }, [whiteboardData.groups, getGroupBounds]);
  
  // 處理群組拖曳
  const handleGroupDrag = useCallback((groupId: string, deltaX: number, deltaY: number) => {
    if (!groupDragState || groupDragState.groupId !== groupId) return;
    
    updateWhiteboardData(prev => {
      const notesToUpdate = [...prev.notes];
      const imagesToUpdate = [...(prev.images || [])];
      
      // 檢查是否為多選拖曳
      const totalSelectedCount = selectedNotes.length + selectedImages.length + selectedGroups.length;
      console.log(`GROUP_DEBUG: handleGroupDrag - selectedNotes: ${selectedNotes.length}, selectedImages: ${selectedImages.length}, selectedGroups: ${selectedGroups.length}, total: ${totalSelectedCount}`);
      
      if (totalSelectedCount > 1) {
        console.log(`GROUP_DEBUG: Multi-select drag - moving all selected elements`);
        // 多選拖曳：移動所有選中的元素
        
        // 移動選中的便利貼
        selectedNotes.forEach(noteId => {
          const noteIndex = notesToUpdate.findIndex(n => n.id === noteId);
          if (noteIndex !== -1) {
            const initialPos = groupDragState.initialPositions[noteId];
            if (initialPos) {
              notesToUpdate[noteIndex] = {
                ...notesToUpdate[noteIndex],
                x: initialPos.x + deltaX,
                y: initialPos.y + deltaY
              };
            }
          }
        });
        
        // 移動選中的圖片
        selectedImages.forEach(imageId => {
          const imageIndex = imagesToUpdate.findIndex(i => i.id === imageId);
          if (imageIndex !== -1) {
            const initialPos = groupDragState.initialPositions[imageId];
            if (initialPos) {
              imagesToUpdate[imageIndex] = {
                ...imagesToUpdate[imageIndex],
                x: initialPos.x + deltaX,
                y: initialPos.y + deltaY
              };
            }
          }
        });
        
        // 移動選中群組內的所有元素
        selectedGroups.forEach(selectedGroupId => {
          const moveGroupContent = (targetGroupId: string) => {
            const targetGroup = prev.groups?.find(g => g.id === targetGroupId);
            if (!targetGroup) return;
            
            // 移動群組內的便利貼
            notesToUpdate.forEach((note, index) => {
              if (note.groupId === targetGroupId) {
                const initialPos = groupDragState.initialPositions[note.id];
                if (initialPos) {
                  notesToUpdate[index] = {
                    ...note,
                    x: initialPos.x + deltaX,
                    y: initialPos.y + deltaY
                  };
                }
              }
            });
            
            // 移動群組內的圖片
            imagesToUpdate.forEach((img, index) => {
              if (img.groupId === targetGroupId) {
                const initialPos = groupDragState.initialPositions[img.id];
                if (initialPos) {
                  imagesToUpdate[index] = {
                    ...img,
                    x: initialPos.x + deltaX,
                    y: initialPos.y + deltaY
                  };
                }
              }
            });
            
            // 遞歸處理子群組
            if (targetGroup.childGroupIds && targetGroup.childGroupIds.length > 0) {
              targetGroup.childGroupIds.forEach(childGroupId => {
                moveGroupContent(childGroupId);
              });
            }
          };
          
          moveGroupContent(selectedGroupId);
        });
        
      } else {
        // 單群組拖曳：只移動當前群組內的元素
        const moveGroupContent = (targetGroupId: string) => {
          const group = prev.groups?.find(g => g.id === targetGroupId);
          if (!group) return;
          
          // 移動直接包含的便利貼
          notesToUpdate.forEach((note, index) => {
            if (note.groupId === targetGroupId) {
              const initialPos = groupDragState.initialPositions[note.id];
              if (initialPos) {
                notesToUpdate[index] = {
                  ...note,
                  x: initialPos.x + deltaX,
                  y: initialPos.y + deltaY
                };
              }
            }
          });
          
          // 移動直接包含的圖片
          imagesToUpdate.forEach((img, index) => {
            if (img.groupId === targetGroupId) {
              const initialPos = groupDragState.initialPositions[img.id];
              if (initialPos) {
                imagesToUpdate[index] = {
                  ...img,
                  x: initialPos.x + deltaX,
                  y: initialPos.y + deltaY
                };
              }
            }
          });
          
          // 遞歸處理子群組
          if (group.childGroupIds && group.childGroupIds.length > 0) {
            group.childGroupIds.forEach(childGroupId => {
              moveGroupContent(childGroupId);
            });
          }
        };
        
        moveGroupContent(groupId);
      }
      
      return {
        ...prev,
        notes: notesToUpdate,
        images: imagesToUpdate
      };
    });
  }, [groupDragState, whiteboardData.groups, selectedNotes, selectedImages, selectedGroups]);


  // 載入專案資料
  useEffect(() => {
    const loadProjectData = async () => {
      // 依據登入使用者切換專案命名空間
      ProjectService.setUserId(user?.id || null);
      
      if (!user?.id) {
        // 未登入時清空狀態
        setWhiteboardData({ notes: [], edges: [], groups: [], images: [] });
        setCurrentProjectId(null);
        setCurrentProject(null);
        // 停止自動備份
        VersionService.stopAutoBackup();
        return;
      }
      
      try {
        // 初始化預設專案
        await ProjectService.initializeDefaultProject();
        
        // 獲取當前專案 ID
        let projectId = ProjectService.getCurrentProjectId();
        
        // 如果沒有當前專案，選擇第一個專案
        if (!projectId) {
          const projects = await ProjectService.getAllProjects();
          if (projects.length > 0) {
            projectId = projects[0].id;
            ProjectService.setCurrentProject(projectId);
          }
        }
        
        if (projectId) {
          setCurrentProjectId(projectId);
          
          // 更新當前專案資訊
          const projects = await ProjectService.getAllProjects();
          const project = projects.find(p => p.id === projectId);
          setCurrentProject(project || null);
          
          // 從 Firebase 載入
          const projectData = await ProjectService.loadProjectData(projectId);
          console.log('=== Loading project data from Firebase ===');
          console.log('Project ID:', projectId);
          if (projectData) {
            console.log('Firebase data found:', {
              notes: projectData.notes?.length || 0,
              edges: projectData.edges?.length || 0,
              groups: projectData.groups?.length || 0,
              images: projectData.images?.length || 0
            });
            
            // Check for problematic image URLs and fix positions
            if (projectData.images) {
              projectData.images = projectData.images.map((img, index) => {
                console.log(`Image ${index}:`, {
                  id: img.id,
                  filename: img.filename,
                  urlType: img.url === '[LOCAL_IMAGE]' ? 'INVALID_PLACEHOLDER' : img.url.startsWith('data:') ? 'base64' : 'url',
                  urlLength: img.url.length,
                  position: { x: img.x, y: img.y }
                });
                
                // 修正異常的座標
                if (Math.abs(img.x) > 10000 || Math.abs(img.y) > 10000) {
                  console.warn(`Image ${img.id} has invalid position, resetting to default`);
                  return {
                    ...img,
                    x: 100 + index * 350, // 水平排列
                    y: 100
                  };
                }
                return img;
              });
            }
            
            setWhiteboardData(projectData);
            setLastSaveTime(new Date());
            
            // 恢復視窗狀態
            if (projectData.viewport) {
              setZoomLevel(projectData.viewport.zoomLevel);
              setPanOffset(projectData.viewport.panOffset);
            }
            
            // 初始化歷史記錄
            setHistory([projectData]);
            setHistoryIndex(0);
            
            // 啟動自動備份
            VersionService.startAutoBackup(
              projectId,
              () => whiteboardDataRef.current,
              (error) => {
                console.error('Auto-backup error:', error);
              }
            );
          } else {
            console.log('No Firebase data found for project:', projectId);
            // 初始化空白狀態
            const emptyData = {
              notes: [],
              edges: [],
              groups: [],
              images: []
            };
            setWhiteboardData(emptyData);
            setHistory([emptyData]);
            setHistoryIndex(0);
          }
        }
      } catch (error) {
        console.error('Failed to load project data:', error);
        // 初始化空白狀態
        const emptyData = {
          notes: [],
          edges: [],
          groups: [],
          images: []
        };
        setWhiteboardData(emptyData);
        setHistory([emptyData]);
        setHistoryIndex(0);
      }
    };
    
    loadProjectData();
    
    // 清理函數：組件卸載時停止自動備份
    return () => {
      VersionService.stopAutoBackup();
    };
  }, [user]);

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

  // 用戶行為追蹤 - 記錄登入和會話開始
  useEffect(() => {
    if (user?.id) {
      // 啟動真實分析服務
      const initAnalytics = async () => {
        try {
          const realSessionId = await RealAnalyticsService.trackLogin(user.id, {
            email: user.email || '',
            displayName: user.name || '',
            photoURL: user.image || ''
          });
          console.log('Real analytics session started:', realSessionId);
          
          // 初始化頁面可見性追蹤
          RealAnalyticsService.initVisibilityTracking();
          
          // Google Analytics 設定用戶 ID 和屬性
          gtag.setUserProperties(user.id, {
            email: user.email,
            display_name: user.name,
            is_plus: user.isPlus || false
          });
          
          // Google Analytics 追蹤登入事件
          gtag.trackAuthEvent('login', 'google', {
            user_id: user.id,
            session_id: realSessionId
          });
          
          // 舊的追蹤方式（保留作為備用）
          trackEvent('login', {
            userId: user.id,
            timestamp: new Date().toISOString(),
            sessionStart: sessionStartTime.current.toISOString(),
            realSessionId
          });
        } catch (error) {
          console.error('Failed to initialize real analytics:', error);
          
          // 如果真實分析失敗，使用舊方式
          trackEvent('login', {
            userId: user.id,
            timestamp: new Date().toISOString(),
            sessionStart: sessionStartTime.current.toISOString()
          });
        }
      };

      initAnalytics();
      
      // 頁面卸載時結束會話
      const handleBeforeUnload = () => {
        RealAnalyticsService.endSession('dummy-session-id');
        
        // 舊的追蹤（保留）
        const sessionDuration = (new Date().getTime() - sessionStartTime.current.getTime()) / 1000 / 60;
        trackEvent('logout', {
          sessionDuration: Math.round(sessionDuration),
          notesCreated: whiteboardData.notes.length,
          timestamp: new Date().toISOString()
        });
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        RealAnalyticsService.endSession('dummy-session-id');
      };
    }
  }, [user?.id, trackEvent]);

  // 自動儲存 - 每當白板資料變更時
  useEffect(() => {
    // 防止初始載入時觸發儲存
    if (!currentProjectId || (whiteboardData.notes.length === 0 && whiteboardData.edges.length === 0 && (!whiteboardData.images || whiteboardData.images.length === 0))) {
      return;
    }

    // 使用 debounce 避免頻繁儲存
    const saveTimer = setTimeout(async () => {
      const viewport = { zoomLevel, panOffset };
      
      // 直接儲存到 Firebase
      if (user?.id) {
        try {
          await ProjectService.saveProjectData(currentProjectId, whiteboardData, viewport);
          // 更新同步狀態
          setSyncStatus(SyncService.getSyncStatus());
        } catch (error) {
          console.error('Failed to save to Firebase:', error);
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

    // Groups don't have x, y, width, height properties in the type definition
    // So we skip groups for bounds calculation

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
        
        // 統一收集所有選中的群組
        const allSelectedGroups = selectedGroups.length > 0 ? selectedGroups : (selectedGroup ? [selectedGroup] : []);
        
        console.log(`GROUP_SELECT: Cmd+G detected`);
        console.log(`GROUP_SELECT: selectedGroups: [${selectedGroups.join(',')}]`);
        console.log(`GROUP_SELECT: selectedGroup: ${selectedGroup}`);
        console.log(`GROUP_SELECT: allSelectedGroups: [${allSelectedGroups.join(',')}]`);
        console.log(`GROUP_SELECT: selectedNotes: [${selectedNotes.join(',')}]`);
        console.log(`GROUP_SELECT: selectedImages: [${selectedImages.join(',')}]`);
        
        // 過濾掉已經在選中群組內的便利貼和圖片
        const notesInSelectedGroups = new Set<string>();
        const imagesInSelectedGroups = new Set<string>();
        
        allSelectedGroups.forEach(groupId => {
          const group = whiteboardData.groups?.find(g => g.id === groupId);
          if (group) {
            // 收集這個群組內的所有便利貼（包括子群組的）
            const collectGroupNotes = (g: Group): void => {
              g.noteIds?.forEach(id => notesInSelectedGroups.add(id));
              g.imageIds?.forEach(id => imagesInSelectedGroups.add(id));
              
              // 遞歸收集子群組的便利貼
              if (g.childGroupIds) {
                g.childGroupIds.forEach(childId => {
                  const childGroup = whiteboardData.groups?.find(cg => cg.id === childId);
                  if (childGroup) collectGroupNotes(childGroup);
                });
              }
            };
            collectGroupNotes(group);
          }
        });
        
        // 過濾出真正獨立的便利貼和圖片（不在任何選中群組內的）
        const independentNotes = selectedNotes.filter(id => !notesInSelectedGroups.has(id));
        const independentImages = selectedImages.filter(id => !imagesInSelectedGroups.has(id));
        
        console.log(`GROUP_SELECT: Notes in groups: [${Array.from(notesInSelectedGroups).join(',')}]`);
        console.log(`GROUP_SELECT: Independent notes: [${independentNotes.join(',')}]`);
        console.log(`GROUP_SELECT: Independent images: [${independentImages.join(',')}]`);
        
        // 情況1: 選中了群組（一個或多個），且可能包含獨立的便利貼/圖片，創建父群組
        if (allSelectedGroups.length >= 1 && (allSelectedGroups.length >= 2 || independentNotes.length > 0 || independentImages.length > 0)) {
          console.log(`GROUP_SELECT: Creating parent group scenario`);
          
          // 直接創建父群組，包含所有群組和獨立的便利貼/圖片
          console.log(`GROUP_SELECT: Creating parent group with ${allSelectedGroups.length} groups, ${independentNotes.length} notes, ${independentImages.length} images`);
          createParentGroup(allSelectedGroups, independentNotes, independentImages);
          return;
        }
        
        // 情況2: 選中多個便利貼/圖片，創建群組（會自動偵測是否需要建立子群組）
        if (selectedNotes.length + selectedImages.length >= 2) {
          console.log(`GROUP_SELECT: Creating group for notes/images`);
          // createGroup 函數會自動偵測選中的項目是否都在同一群組內，並建立子群組
          createGroup(selectedNotes, selectedImages);
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
    
    // 追蹤便利貼創建事件
    const sessionId = RealAnalyticsService.getSessionId();
    if (user?.id && sessionId) {
      RealAnalyticsService.trackNoteCreated(
        user.id,
        sessionId,
        newNote.id
      );
    }
    
    // Google Analytics 追蹤
    gtag.trackNoteEvent('create', newNote.id, {
      user_id: user?.id,
      x_position: x,
      y_position: y,
      total_notes: whiteboardData.notes.length + 1,
      color: newNote.color
    });
    
    // 舊的追蹤方式（保留作為備用）
    trackEvent('note_created', { 
      noteId: newNote.id, 
      position: { x, y },
      totalNotes: whiteboardData.notes.length + 1,
      sessionId
    });
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
    
    updateWhiteboardData(prev => ({
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

    updateWhiteboardData(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge]
    }));
  }, [whiteboardData, saveToHistory]);

  // 坐標轉換輔助函數 - 將視口座標轉換為邏輯座標
  // viewportX, viewportY 是相對於整個視窗的座標 (e.clientX, e.clientY)
  const viewportToLogical = useCallback((viewportX: number, viewportY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    // 轉換為相對於 canvas 元素的座標
    const canvasX = viewportX - rect.left;
    const canvasY = viewportY - rect.top;
    
    // 轉換為邏輯座標（考慮縮放和平移）
    const logicalX = (canvasX - panOffset.x) / zoomLevel;
    const logicalY = (canvasY - panOffset.y) / zoomLevel;
    
    return { x: logicalX, y: logicalY };
  }, [panOffset.x, panOffset.y, zoomLevel]);

  // Image manipulation functions
  const addImage = useCallback((url: string, x: number, y: number, filename?: string) => {
    console.log('=== addImage called ===');
    console.log('Adding image at position:', { x, y });
    console.log('Filename:', filename);
    console.log('URL:', url);
    console.log('Current images before add:', whiteboardData.images?.length || 0);
    
    // 確保座標在合理範圍內
    const safeX = isNaN(x) || Math.abs(x) > 10000 ? 100 : x;
    const safeY = isNaN(y) || Math.abs(y) > 10000 ? 100 : y;
    
    if (safeX !== x || safeY !== y) {
      console.warn('Image position was out of bounds, using safe position:', { safeX, safeY });
    }
    
    saveToHistory(whiteboardData);
    
    const newImage: ImageElement = {
      id: uuidv4(),
      x: safeX,
      y: safeY,
      width: 300,
      height: 200,
      url,
      filename,
      uploadedAt: new Date()
    };
    
    console.log('New image object created:', {
      id: newImage.id,
      url: newImage.url,
      position: { x: newImage.x, y: newImage.y }
    });

    updateWhiteboardData(prev => {
      console.log('Previous images:', prev.images?.length || 0);
      const updatedImages = [...(prev.images || []), newImage];
      console.log('Updated images array length:', updatedImages.length);
      const newData = {
        ...prev,
        images: updatedImages
      };
      console.log('Returning new whiteboard data with images:', newData.images?.length);
      return newData;
    });

    // Auto-select the new image
    setSelectedImage(newImage.id);
    setSelectedNote(null);
    setSelectedNotes([]);
    console.log('Image added and selected:', newImage.id);
  }, [whiteboardData, saveToHistory]);

  const updateImagePosition = useCallback((id: string, x: number, y: number) => {
    updateWhiteboardData(prev => ({
      ...prev,
      images: (prev.images || []).map(img => 
        img.id === id ? { ...img, x, y } : img
      )
    }));
  }, []);

  const updateImageSize = useCallback((id: string, width: number, height: number) => {
    updateWhiteboardData(prev => ({
      ...prev,
      images: (prev.images || []).map(img => 
        img.id === id ? { ...img, width, height } : img
      )
    }));
  }, []);

  const deleteImage = useCallback((id: string) => {
    saveToHistory(whiteboardData);
    
    updateWhiteboardData(prev => ({
      ...prev,
      images: (prev.images || []).filter(img => img.id !== id)
    }));
    
    if (selectedImage === id) {
      setSelectedImage(null);
    }
  }, [whiteboardData, saveToHistory, selectedImage]);

  // Handle image upload
  const handleImageUpload = useCallback(async (file: File) => {
    console.log('=== handleImageUpload called ===');
    console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const isGuestMode = localStorage.getItem('guestMode') === 'true';
      console.log('Guest mode:', isGuestMode);
      
      const headers: HeadersInit = {};
      if (isGuestMode) {
        headers['x-guest-mode'] = 'true';
      }
      
      console.log('Sending request to /api/upload/image...');
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        headers,
        body: formData
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Upload failed:', error);
        throw new Error(error.error || 'Upload failed');
      }
      
      const data = await response.json();
      console.log('Upload response:', {
        filename: data.filename,
        size: data.size,
        type: data.type,
        urlLength: data.url?.length || 0
      });
      
      // Add image to canvas center (使用與便利貼相同的座標計算方式)
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        // 計算畫布中心點（相對於畫布本身的座標）
        const canvasCenterX = rect.width / 2;
        const canvasCenterY = rect.height / 2;
        
        // 轉換為邏輯座標（考慮縮放和平移）
        const logicalX = (canvasCenterX - panOffset.x) / zoomLevel;
        const logicalY = (canvasCenterY - panOffset.y) / zoomLevel;
        
        console.log('Canvas size:', { width: rect.width, height: rect.height });
        console.log('Canvas center (canvas coords):', { x: canvasCenterX, y: canvasCenterY });
        console.log('Zoom level:', zoomLevel, 'Pan offset:', panOffset);
        console.log('Adding image at logical position:', { x: logicalX, y: logicalY });
        
        // 圖片放置在中心點，調整偏移讓圖片中心對齊
        addImage(data.url, logicalX - 150, logicalY - 100, data.filename);
      }
      
      // 圖片上傳成功
    } catch (error) {
      console.error('Image upload error:', error);
      // 圖片上傳失敗 - 錯誤已記錄
    }
  }, [addImage, viewportToLogical]);

  // Handle drag and drop for images
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      imageFiles.forEach(file => handleImageUpload(file));
    }
  }, [handleImageUpload]);

  // 處理群組拖曳的全域滑鼠事件
  useEffect(() => {
    if (!groupDragState) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const currentPos = viewportToLogical(e.clientX, e.clientY);
      const startPos = viewportToLogical(groupDragState.startX, groupDragState.startY);
      
      const deltaX = currentPos.x - startPos.x;
      const deltaY = currentPos.y - startPos.y;
      
      handleGroupDrag(groupDragState.groupId, deltaX, deltaY);
      
      // 檢查滑鼠是否在其他群組上
      const hoveredGroupId = checkMouseOverGroup(currentPos.x, currentPos.y, groupDragState.groupId);
      setDraggedGroupHoveredGroup(hoveredGroupId);
    };

    const handleGlobalMouseUp = () => {
      // 檢查是否需要將群組變成子群組
      if (groupDragState && draggedGroupHoveredGroup) {
        const draggedGroup = whiteboardData.groups?.find(g => g.id === groupDragState.groupId);
        const targetGroup = whiteboardData.groups?.find(g => g.id === draggedGroupHoveredGroup);
        
        if (draggedGroup && targetGroup && !draggedGroup.parentGroupId) {
          // 將群組變成子群組
          saveToHistory(whiteboardData);
          
          updateWhiteboardData(prev => ({
            ...prev,
            groups: (prev.groups || []).map(group => {
              if (group.id === groupDragState.groupId) {
                // 設定父群組
                return {
                  ...group,
                  parentGroupId: draggedGroupHoveredGroup
                };
              }
              if (group.id === draggedGroupHoveredGroup) {
                // 更新父群組的子群組列表
                return {
                  ...group,
                  childGroupIds: [...(group.childGroupIds || []), groupDragState.groupId]
                };
              }
              return group;
            })
          }));
        }
      }
      
      setGroupDragState(null);
      setDraggedGroupHoveredGroup(null);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [groupDragState, viewportToLogical, handleGroupDrag, checkMouseOverGroup, draggedGroupHoveredGroup, whiteboardData, saveToHistory, updateWhiteboardData]);

  // 畫布拖曳相關處理函數
  const handleCanvasMouseDown = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // 檢查是否點擊便利貼
    if (target.closest('.sticky-note')) {
      return;
    }
    
    // 檢查是否點擊圖片
    if (target.closest('.image-element')) {
      return;
    }
    
    // 檢查是否點擊群組 - SVG 元素需要特別處理
    const svgElement = target.closest('svg');
    if (svgElement && (target.tagName === 'rect' || target.tagName === 'text' || target.tagName === 'foreignObject')) {
      // 這可能是群組相關的元素，不要清除選取狀態
      return;
    }

    // 清除所有選取狀態
    console.log('GROUP_SELECT: Clearing all selections (canvas click)');
    setSelectedNote(null);
    setSelectedNotes([]);
    setSelectedImage(null);
    setSelectedImages([]);
    setSelectedEdge(null);
    setSelectedGroup(null);
    setSelectedGroups([]); // 清除群組多選
    setPreviewSelectedNotes([]);
    setPreviewSelectedGroups([]);

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
    
    // 處理連接模式：如果正在連接且懸停在目標上，完成連接
    if (connectingFrom) {
      // 連接到便利貼
      if (hoveredNote && connectingFrom !== hoveredNote) {
        addEdge(connectingFrom, hoveredNote);
        setConnectingFrom(null);
        setHoveredNote(null);
        return;
      }
      // 連接到圖片
      if (hoveredImage && connectingFrom !== hoveredImage) {
        addEdge(connectingFrom, hoveredImage);
        setConnectingFrom(null);
        setHoveredImage(null);
        return;
      }
    }
    
    // 如果正在連接但沒有有效目標，在滑鼠位置創建新便利貼並連接
    if (connectingFrom && !hoveredNote && !hoveredImage) {
      // 取得起始元素（便利貼或圖片）
      const fromNote = whiteboardData.notes.find(note => note.id === connectingFrom);
      const fromImage = whiteboardData.images?.find(img => img.id === connectingFrom);
      const fromElement = fromNote || fromImage;
      
      if (!fromElement) {
        setConnectingFrom(null);
        return;
      }
      
      // 計算起始元素的中心點
      const fromX = fromElement.x + fromElement.width / 2;
      const fromY = fromElement.y + fromElement.height / 2;
      
      // 計算角度（從起始便利貼指向滑鼠位置）
      const angle = Math.atan2(mousePosition.y - fromY, mousePosition.x - fromX);
      
      // 新便利貼的尺寸
      const newNoteWidth = 200;
      const newNoteHeight = 200;
      
      // 重要：與預覽線條保持一致的參數
      const gap = 15; // 與 Edge 組件中的 gap 保持一致
      const arrowSize = 16; // 箭頭大小
      const arrowOffset = 8; // 箭頭往前的偏移量
      
      // 計算到新便利貼邊緣的距離
      const getDistanceToEdge = (width: number, height: number, angleToEdge: number) => {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        // 根據角度判斷與哪個邊相交
        if (Math.abs(Math.cos(angleToEdge)) > Math.abs(Math.sin(angleToEdge))) {
          return halfWidth / Math.abs(Math.cos(angleToEdge));
        } else {
          return halfHeight / Math.abs(Math.sin(angleToEdge));
        }
      };
      
      // 預覽線條中，箭頭尖端的位置
      const arrowTipX = mousePosition.x + Math.cos(angle) * arrowOffset;
      const arrowTipY = mousePosition.y + Math.sin(angle) * arrowOffset;
      
      // 計算新便利貼應該放置的中心位置
      // 新便利貼的中心 = 箭頭尖端 + (邊緣距離 + gap)
      // 使用正向角度，讓箭頭指向的邊緣（內側）對齊
      const toEdgeDistance = getDistanceToEdge(newNoteWidth, newNoteHeight, angle);
      const newNoteCenterX = arrowTipX + Math.cos(angle) * (toEdgeDistance + gap);
      const newNoteCenterY = arrowTipY + Math.sin(angle) * (toEdgeDistance + gap);
      
      // 計算新便利貼的左上角位置
      const newNoteX = newNoteCenterX - newNoteWidth / 2;
      const newNoteY = newNoteCenterY - newNoteHeight / 2;
      
      const newNoteId = `note_${Date.now()}`;
      const newNote: StickyNote = {
        id: newNoteId,
        x: newNoteX,
        y: newNoteY,
        width: newNoteWidth,
        height: newNoteHeight,
        content: '',
        color: '#FEF3C7'
      };
      
      // 更新白板數據
      updateWhiteboardData(prev => ({
        ...prev,
        notes: [...prev.notes, newNote]
      }));
      
      // 創建連接
      addEdge(connectingFrom, newNoteId);
      
      // 自動選中並進入編輯模式
      setSelectedNote(newNoteId);
      setAutoEditNoteId(newNoteId);
      
      // 清理連接狀態
      setConnectingFrom(null);
      setHoveredNote(null);
      return;
    }
    
    // 選取邏輯已移至全局事件處理器
    
    // 重置畫板拖曳狀態
    setIsDragging(false);
  }, [connectingFrom, hoveredNote, addEdge, mousePosition, updateWhiteboardData]);

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
    
    // 如果最近剛完成拖曳選取，阻止雙擊創建便利貼
    if (recentDragSelect) {
      return;
    }
    
    // 檢查是否點擊在便利貼上
    if (target.closest('.sticky-note')) {
      return;
    }
    
    // 檢查是否點擊在群組上（SVG 元素）
    const targetElement = event.target as Element;
    if (targetElement.tagName === 'text' || 
        targetElement.tagName === 'rect' ||
        targetElement.closest('g')) {
      // 可能是群組元素，檢查點擊位置是否在群組範圍內
      const clickX = (event.clientX - canvasRef.current!.getBoundingClientRect().left - panOffset.x) / zoomLevel;
      const clickY = (event.clientY - canvasRef.current!.getBoundingClientRect().top - panOffset.y) / zoomLevel;
      
      const isOnGroup = (whiteboardData.groups || []).some(group => {
        const bounds = getGroupBounds(group.id);
        if (!bounds) return false;
        return clickX >= bounds.x - 30 && 
               clickX <= bounds.x + bounds.width + 30 && 
               clickY >= bounds.y - 40 && 
               clickY <= bounds.y + bounds.height + 30;
      });
      
      if (isOnGroup) {
        return;
      }
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
  }, [addStickyNote, panOffset, zoomLevel, recentDragSelect, whiteboardData.groups, getGroupBounds]);

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
        
        const previewGroupIds = (whiteboardData.groups || [])
          .filter(group => {
            const bounds = getGroupBounds(group.id);
            if (!bounds) return false;
            
            const groupLeft = bounds.x;
            const groupRight = bounds.x + bounds.width;
            const groupTop = bounds.y;
            const groupBottom = bounds.y + bounds.height;
            
            return !(groupRight < minX || groupLeft > maxX || groupBottom < minY || groupTop > maxY);
          })
          .map(group => group.id);
        
        setPreviewSelectedNotes(previewNoteIds);
        setPreviewSelectedGroups(previewGroupIds);
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
      
      // 找出範圍內的圖片
      const selectedImageIds = (whiteboardData.images || [])
        .filter(image => {
          const imageLeft = image.x;
          const imageRight = image.x + image.width;
          const imageTop = image.y;
          const imageBottom = image.y + image.height;
          
          // 檢查圖片是否與選取框重疊
          return !(imageRight < minX || imageLeft > maxX || imageBottom < minY || imageTop > maxY);
        })
        .map(image => image.id);
      
      // 找出範圍內的群組
      const selectedGroupIds = (whiteboardData.groups || [])
        .filter(group => {
          const bounds = getGroupBounds(group.id);
          if (!bounds) return false;
          
          const groupLeft = bounds.x;
          const groupRight = bounds.x + bounds.width;
          const groupTop = bounds.y;
          const groupBottom = bounds.y + bounds.height;
          
          // 檢查群組是否與選取框重疊
          return !(groupRight < minX || groupLeft > maxX || groupBottom < minY || groupTop > maxY);
        })
        .map(group => group.id);
      
      setSelectedNotes(selectedNoteIds);
      setSelectedImages(selectedImageIds);
      setSelectedGroups(selectedGroupIds);
      setIsSelecting(false);
      setPreviewSelectedNotes([]); // 清除預覽狀態
      setPreviewSelectedGroups([]); // 清除群組預覽狀態
      
      // 檢查是否實際進行了拖曳（移動距離超過閾值）
      const dragDistance = Math.hypot(
        selectionEnd.x - selectionStart.x,
        selectionEnd.y - selectionStart.y
      );
      
      if (dragDistance > 5) { // 如果拖曳距離超過 5 像素
        setRecentDragSelect(true);
        // 300ms 後清除標記
        setTimeout(() => setRecentDragSelect(false), 300);
      }
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

  // 快速連接：點擊連接點直接創建新便利貼
  const handleQuickConnect = useCallback((noteId: string, direction: 'top' | 'right' | 'bottom' | 'left') => {
    const fromNote = whiteboardData.notes.find(note => note.id === noteId);
    if (!fromNote) return;
    
    // 計算起始便利貼的中心點
    const fromX = fromNote.x + fromNote.width / 2;
    const fromY = fromNote.y + fromNote.height / 2;
    
    // 根據方向計算角度
    let angle = 0;
    switch (direction) {
      case 'top':
        angle = -Math.PI / 2; // 向上
        break;
      case 'right':
        angle = 0; // 向右
        break;
      case 'bottom':
        angle = Math.PI / 2; // 向下
        break;
      case 'left':
        angle = Math.PI; // 向左
        break;
    }
    
    // 新便利貼的尺寸
    const newNoteWidth = 200;
    const newNoteHeight = 200;
    
    // 計算距離參數
    const gap = 15; // 與 Edge 組件中的 gap 保持一致
    const defaultDistance = 180; // 預設延伸距離（較短的距離）
    
    // 計算到便利貼邊緣的距離
    const getDistanceToEdge = (width: number, height: number, angleToEdge: number) => {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      
      if (Math.abs(Math.cos(angleToEdge)) > Math.abs(Math.sin(angleToEdge))) {
        return halfWidth / Math.abs(Math.cos(angleToEdge));
      } else {
        return halfHeight / Math.abs(Math.sin(angleToEdge));
      }
    };
    
    // 計算起始便利貼邊緣距離
    const fromEdgeDistance = getDistanceToEdge(fromNote.width, fromNote.height, angle);
    
    // 計算新便利貼邊緣距離
    const toEdgeDistance = getDistanceToEdge(newNoteWidth, newNoteHeight, angle);
    
    // 計算新便利貼的中心位置
    // 總距離 = 起始邊緣 + gap + 預設距離 + gap + 新便利貼邊緣
    const totalDistance = fromEdgeDistance + gap + defaultDistance + gap + toEdgeDistance;
    const newNoteCenterX = fromX + Math.cos(angle) * totalDistance;
    const newNoteCenterY = fromY + Math.sin(angle) * totalDistance;
    
    // 計算新便利貼的左上角位置
    const newNoteX = newNoteCenterX - newNoteWidth / 2;
    const newNoteY = newNoteCenterY - newNoteHeight / 2;
    
    const newNoteId = `note_${Date.now()}`;
    const newNote: StickyNote = {
      id: newNoteId,
      x: newNoteX,
      y: newNoteY,
      width: newNoteWidth,
      height: newNoteHeight,
      content: '',
      color: '#FEF3C7',
      // 如果原便利貼在群組內，新便利貼也加入同一群組
      groupId: fromNote.groupId
    };
    
    // 保存歷史記錄
    saveToHistory(whiteboardData);
    
    // 更新白板數據
    updateWhiteboardData(prev => ({
      ...prev,
      notes: [...prev.notes, newNote]
    }));
    
    // 創建連接
    addEdge(noteId, newNoteId);
    
    // 自動選中並進入編輯模式
    setSelectedNote(newNoteId);
    setAutoEditNoteId(newNoteId);
    
  }, [whiteboardData, saveToHistory, updateWhiteboardData, addEdge]);

  // 圖片快速連接：點擊圖片連接點直接創建新便利貼
  const handleImageQuickConnect = useCallback((imageId: string, direction: 'top' | 'right' | 'bottom' | 'left') => {
    const fromImage = whiteboardData.images?.find(img => img.id === imageId);
    if (!fromImage) return;
    
    // 計算起始圖片的中心點
    const fromX = fromImage.x + fromImage.width / 2;
    const fromY = fromImage.y + fromImage.height / 2;
    
    // 根據方向計算角度
    let angle = 0;
    switch (direction) {
      case 'top':
        angle = -Math.PI / 2; // 向上
        break;
      case 'right':
        angle = 0; // 向右
        break;
      case 'bottom':
        angle = Math.PI / 2; // 向下
        break;
      case 'left':
        angle = Math.PI; // 向左
        break;
    }
    
    // 新便利貼的尺寸
    const newNoteWidth = 200;
    const newNoteHeight = 200;
    
    // 計算距離參數
    const gap = 15; // 與 Edge 組件中的 gap 保持一致
    const defaultDistance = 180; // 預設延伸距離
    
    // 計算到圖片邊緣的距離
    const getDistanceToEdge = (width: number, height: number, angleToEdge: number) => {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      
      if (Math.abs(Math.cos(angleToEdge)) > Math.abs(Math.sin(angleToEdge))) {
        return halfWidth / Math.abs(Math.cos(angleToEdge));
      } else {
        return halfHeight / Math.abs(Math.sin(angleToEdge));
      }
    };
    
    // 計算起始圖片邊緣距離
    const fromEdgeDistance = getDistanceToEdge(fromImage.width, fromImage.height, angle);
    
    // 計算新便利貼邊緣距離
    const toEdgeDistance = getDistanceToEdge(newNoteWidth, newNoteHeight, angle);
    
    // 計算新便利貼的中心位置
    // 總距離 = 起始邊緣 + gap + 預設距離 + gap + 新便利貼邊緣
    const totalDistance = fromEdgeDistance + gap + defaultDistance + gap + toEdgeDistance;
    const newNoteCenterX = fromX + Math.cos(angle) * totalDistance;
    const newNoteCenterY = fromY + Math.sin(angle) * totalDistance;
    
    // 計算新便利貼的左上角位置
    const newNoteX = newNoteCenterX - newNoteWidth / 2;
    const newNoteY = newNoteCenterY - newNoteHeight / 2;
    
    const newNoteId = `note_${Date.now()}`;
    const newNote: StickyNote = {
      id: newNoteId,
      x: newNoteX,
      y: newNoteY,
      width: newNoteWidth,
      height: newNoteHeight,
      content: '',
      color: '#FEF3C7',
      // 如果原圖片在群組內，新便利貼也加入同一群組
      groupId: fromImage.groupId
    };
    
    // 保存歷史記錄
    saveToHistory(whiteboardData);
    
    // 更新白板數據
    updateWhiteboardData(prev => ({
      ...prev,
      notes: [...prev.notes, newNote]
    }));
    
    // 創建連接
    addEdge(imageId, newNoteId);
    
    // 自動選中並進入編輯模式
    setSelectedNote(newNoteId);
    setSelectedImage(null); // 清除圖片選取
    setAutoEditNoteId(newNoteId);
    
  }, [whiteboardData, saveToHistory, updateWhiteboardData, addEdge]);

  // 計算多選元素的邊界框（包含便利貼、圖片和群組）
  const getMultiSelectionBounds = useCallback(() => {
    const selectedNoteObjects = whiteboardData.notes.filter(note => selectedNotes.includes(note.id));
    const selectedImageObjects = whiteboardData.images?.filter(img => selectedImages.includes(img.id)) || [];
    const selectedGroupObjects = whiteboardData.groups?.filter(group => selectedGroups.includes(group.id)) || [];
    
    const allSelectedObjects = [...selectedNoteObjects, ...selectedImageObjects];
    const allSelectedGroupBounds: Array<{x: number, y: number, width: number, height: number}> = [];
    
    // 收集群組的邊界
    selectedGroupObjects.forEach(group => {
      const bounds = getGroupBounds(group.id);
      if (bounds) {
        allSelectedGroupBounds.push(bounds);
      }
    });
    
    // 合併所有選中的物件（便利貼、圖片、群組邊界）
    const allBounds = [...allSelectedObjects, ...allSelectedGroupBounds];
    
    if (allBounds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    allBounds.forEach(obj => {
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + obj.width);
      maxY = Math.max(maxY, obj.y + obj.height);
    });

    const padding = 20; // 邊框與元素的間距
    
    // 檢查最上方的元素是否為群組
    let topPadding = padding;
    if (selectedGroups.length > 0) {
      // 找出所有選中元素中 y 值最小的（最上方的）
      const allYValues = [
        ...allSelectedObjects.map(obj => obj.y),
        ...allSelectedGroupBounds.map(bounds => bounds.y)
      ];
      const topY = Math.min(...allYValues);
      
      // 檢查最上方的是否為群組
      const isTopElementGroup = allSelectedGroupBounds.some(bounds => bounds.y === topY);
      
      if (isTopElementGroup) {
        topPadding = 40; // 群組在最上方時需要額外空間
      }
    }
    
    return {
      x: minX - padding,
      y: minY - topPadding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + topPadding + padding
    };
  }, [whiteboardData.notes, whiteboardData.images, whiteboardData.groups, selectedNotes, selectedImages, selectedGroups, getGroupBounds]);

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
      updateWhiteboardData(prev => {
        const newData = {
          notes: [...prev.notes, ...newNotes],
          edges: [...prev.edges, ...newEdges],
          groups: prev.groups || []
        };
        
        // 立即儲存到 Firebase 以防止資料遺失
        if (currentProjectId && user?.id) {
          setTimeout(async () => {
            try {
              await ProjectService.saveProjectData(currentProjectId, newData, { zoomLevel, panOffset });
            } catch (error) {
              console.error('Failed to save brainstorm result:', error);
            }
          }, 100);
        }
        
        return newData;
      });

      // 追蹤 AI brainstorm 成功事件
      const sessionId = RealAnalyticsService.getSessionId();
      if (user?.id && sessionId) {
        RealAnalyticsService.trackAIOperation(
          user.id,
          sessionId,
          'brainstorm',
          {
            sourceNoteId: noteId,
            generatedNotesCount: newNotes.length,
            success: true
          }
        );
      }
      
      // Google Analytics 追蹤
      gtag.trackAIEvent('brainstorm', true, newNotes.length, {
        user_id: user?.id,
        source_note_id: noteId,
        network_size: networkAnalysis.networkSize,
        related_notes_count: networkAnalysis.allRelatedNotes.length
      });
      
      // 舊的追蹤方式（保留作為備用）
      trackEvent('ai_operation', {
        operation: 'brainstorm',
        sourceNoteId: noteId,
        generatedNotesCount: newNotes.length,
        success: true,
        sessionId
      });

      // 延遲重新啟用即時同步，並確保不會覆蓋本地更改
      setTimeout(async () => {
        if (user?.id && currentProjectId) {
          // 重新啟用前先同步到雲端
          try {
            const currentData = await ProjectService.loadProjectData(currentProjectId);
            if (currentData) {
              SyncService.enableRealtimeSync(currentProjectId, user.id, (data) => {
                setWhiteboardData(data);
              });
            }
          } catch (error) {
            console.error('Failed to reload project data:', error);
          }
        }
      }, 3000); // 增加到3秒

      // 保留 Chain of Thought 結果，不覆蓋
      // 最終結果已經在 onProgress 回調中處理了
    } catch (error) {
      console.error('AI Brainstorm error:', error);
      // 附加錯誤訊息而不是覆蓋
      
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

  // 解析 AI 回答，生成結構化的便利貼
  const parseAIResponseToTree = (response: string): Array<{
    content: string;
    level: number;
    isMain?: boolean;
  }> => {
    const lines = response.split('\n').filter(line => line.trim());
    const nodes: Array<{ content: string; level: number; isMain?: boolean }> = [];
    
    console.log('=== Parse AI Response Tree Debug ===');
    console.log('Total lines to parse:', lines.length);
    
    // 解析不同格式的回答
    const currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      console.log(`Line ${i}: "${line}" (trimmed: "${trimmed}")`);
      console.log(`  - Starts with spaces:`, line.match(/^(\s*)/)?.[1].length || 0);
      
      // 跳過表情符號開頭的標題（作為主節點）
      if (trimmed.match(/^[📝💡🎯✨🔍📊]/)) {
        const content = trimmed.replace(/^[📝💡🎯✨🔍📊]\s*/, '').substring(0, 30);
        if (content.length > 3) {
          console.log(`  → Detected emoji title, level 0: "${content}"`);
          nodes.push({ content, level: 0, isMain: true });
        }
        continue;
      }
      
      // 檢測主要觀點（通常是粗體或有特殊標記）
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const content = trimmed.replace(/\*\*/g, '').substring(0, 30);
        if (content.length > 3) {
          nodes.push({ content, level: 0, isMain: true });
        }
        continue;
      }
      
      // 檢測編號列表 (1. 2. 3. 或 1) 2) 3))
      const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s*(.+)/);
      if (numberedMatch) {
        const content = numberedMatch[2].substring(0, 30);
        if (content.length > 3) {
          console.log(`  → Detected numbered list, level 1: "${content}"`);
          nodes.push({ content, level: 1 });
        }
        continue;
      }
      
      // 檢測不同層級的子彈列表
      // 根據縮排判斷層級
      let bulletLevel = 1;
      const cleanedLine = trimmed;
      
      // 檢測縮排層級
      const indentMatch = line.match(/^(\s*)/);
      if (indentMatch) {
        const indentLength = indentMatch[1].length;
        if (indentLength >= 6) bulletLevel = 3;
        else if (indentLength >= 3) bulletLevel = 2;
        else if (indentLength > 0) bulletLevel = 1;
      }
      
      // 檢測各種子彈符號
      if (cleanedLine.match(/^[-•\*◦▪▫→]\s+/)) {
        const content = cleanedLine.replace(/^[-•\*◦▪▫→]\s+/, '').substring(0, 30);
        if (content.length > 3) {
          console.log(`  → Detected bullet list, level ${bulletLevel}: "${content}"`);
          nodes.push({ content, level: bulletLevel });
        }
        continue;
      }
      
      // 檢測冒號分隔的要點
      if (trimmed.includes('：') && trimmed.indexOf('：') < 15) {
        const [key, value] = trimmed.split('：');
        if (key.length <= 15) {
          nodes.push({ content: key.trim(), level: 1 });
          if (value && value.trim().length > 3 && value.trim().length <= 30) {
            nodes.push({ content: value.trim(), level: 2 });
          }
        }
        continue;
      }
      
      // 如果是較短的獨立句子，可能是要點
      if (trimmed.length > 5 && trimmed.length <= 30 && !trimmed.includes('。')) {
        nodes.push({ content: trimmed, level: 1 });
      }
    }
    
    // 如果沒有解析出結構，至少返回一個總結節點
    if (nodes.length === 0) {
      // 提取前100個字作為總結
      const summary = response.substring(0, 100).replace(/\n/g, ' ');
      nodes.push({ content: summary, level: 0, isMain: true });
    }
    
    // 限制節點數量，避免太多
    const finalNodes = nodes.slice(0, 10);  // 增加到10個以支援更多層級
    
    console.log('=== Parse Result Summary ===');
    console.log('Total nodes parsed:', finalNodes.length);
    finalNodes.forEach((node, i) => {
      console.log(`Node ${i}: Level ${node.level}, isMain: ${node.isMain}, content: "${node.content}"`);
    });
    console.log('=== End Parse Debug ===');
    
    return finalNodes;
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
      
      // Debug: 記錄 AI 原始回答
      console.log('=== AI Ask Response Debug ===');
      console.log('Raw AI Response:');
      console.log(result);
      console.log('Response Length:', result.length);
      console.log('Response Lines:', result.split('\n').length);
      
      // 解析 AI 回答為結構化節點
      const parsedNodes = parseAIResponseToTree(result);
      
      console.log('Parsed Nodes:');
      console.log(parsedNodes);
      console.log('Total Parsed Nodes:', parsedNodes.length);
      console.log('=== End AI Ask Response Debug ===');
      
      // 如果沒有解析出節點，使用原始方式
      if (parsedNodes.length === 0) {
        const newNote = {
          id: uuidv4(),
          x: targetX,
          y: targetY,
          width: 250,
          height: 300,
          content: result.substring(0, 200),
          color: '#EDE9FE'
        };
        
        const newEdges = sourceNoteIds.map(sourceId => ({
          id: uuidv4(),
          from: sourceId,
          to: newNote.id
        }));

        updateWhiteboardData(prev => ({
          notes: [...prev.notes, newNote],
          edges: [...prev.edges, ...newEdges],
          groups: prev.groups || []
        }));
      } else {
        // 生成樹狀結構的便利貼
        const newNotes: StickyNote[] = [];
        const newEdges: Edge[] = [];
        
        // 佈局參數（使用正方形便利貼）
        const NOTE_SIZE = 150;  // 統一的正方形尺寸
        const H_GAP = 50;
        const V_GAP = 80;
        
        // 根據層級分組
        const levels = new Map<number, typeof parsedNodes>();
        parsedNodes.forEach(node => {
          if (!levels.has(node.level)) {
            levels.set(node.level, []);
          }
          levels.get(node.level)!.push(node);
        });
        
        // 判斷是否有主節點，如果沒有就創建一個
        let mainNodeId: string;
        const hasMainNode = parsedNodes.some(n => n.isMain);
        
        if (!hasMainNode) {
          // 如果沒有明確的主節點，創建一個總結節點
          mainNodeId = uuidv4();
          newNotes.push({
            id: mainNodeId,
            x: targetX,
            y: targetY,
            width: NOTE_SIZE,
            height: NOTE_SIZE,
            content: '回答摘要',
            color: '#E0E7FF' // 主節點用藍色系
          });
          
          // 連接源節點到主節點
          sourceNoteIds.forEach(sourceId => {
            newEdges.push({
              id: uuidv4(),
              from: sourceId,
              to: mainNodeId
            });
          });
        } else {
          // 使用解析出的主節點
          const mainNode = parsedNodes.find(n => n.isMain)!;
          mainNodeId = uuidv4();
          newNotes.push({
            id: mainNodeId,
            x: targetX,
            y: targetY,
            width: NOTE_SIZE,
            height: NOTE_SIZE,
            content: mainNode.content,
            color: '#E0E7FF'
          });
          
          sourceNoteIds.forEach(sourceId => {
            newEdges.push({
              id: uuidv4(),
              from: sourceId,
              to: mainNodeId
            });
          });
        }
        
        // 建立層級結構，正確處理父子關係
        const nodeMap = new Map<object, string>(); // 存儲節點對應的 ID
        let lastLevel1NodeId: string | null = null; // 記錄最後一個 level 1 節點
        
        // 計算 level 1 節點的佈局
        const level1Nodes = parsedNodes.filter(n => n.level === 1);
        const angleSpread = Math.min(Math.PI * 2/3, (Math.PI / 4) * level1Nodes.length);
        const startAngle = Math.PI / 2 - angleSpread / 2;
        const angleStep = level1Nodes.length > 1 ? angleSpread / (level1Nodes.length - 1) : 0;
        
        let level1Index = 0;
        
        // 按順序處理所有節點
        for (let i = 0; i < parsedNodes.length; i++) {
          const node = parsedNodes[i];
          
          // 跳過已處理的主節點
          if (node.isMain) continue;
          
          if (node.level === 1) {
            // Level 1 節點：連接到主節點
            const nodeId = uuidv4();
            const angle = startAngle + angleStep * level1Index;
            const radius = 250;
            
            newNotes.push({
              id: nodeId,
              x: targetX + Math.cos(angle) * radius,
              y: targetY + Math.sin(angle) * radius,
              width: NOTE_SIZE,
              height: NOTE_SIZE,
              content: node.content,
              color: '#FCE7F3' // Level 1 用粉色系
            });
            
            newEdges.push({
              id: uuidv4(),
              from: mainNodeId,
              to: nodeId
            });
            
            nodeMap.set(node, nodeId);
            lastLevel1NodeId = nodeId;
            level1Index++;
            
          } else if (node.level === 2 && lastLevel1NodeId) {
            // Level 2 節點：連接到最近的 level 1 節點
            const parentNodeId = lastLevel1NodeId;
            const nodeId = uuidv4();
            
            // 找出父節點的位置
            const parentNote = newNotes.find(n => n.id === parentNodeId);
            if (parentNote) {
              // 計算相對於父節點的位置
              const parentAngle = Math.atan2(parentNote.y - targetY, parentNote.x - targetX);
              const subNodes = parsedNodes.filter((n, idx) => 
                idx > i && n.level === 2 && 
                parsedNodes.slice(i, idx).every(pn => pn.level >= 2)
              );
              
              // 在父節點周圍扇形分布
              const subIndex = parsedNodes.slice(0, i).filter(n => 
                n.level === 2 && nodeMap.has(n)
              ).length % 3; // 每個父節點最多3個子節點
              
              const offsetAngle = (subIndex - 1) * 0.3; // -0.3, 0, 0.3
              const angle = parentAngle + offsetAngle;
              const radius = 150; // 相對於父節點的距離
              
              newNotes.push({
                id: nodeId,
                x: parentNote.x + Math.cos(angle) * radius,
                y: parentNote.y + Math.sin(angle) * radius,
                width: NOTE_SIZE,
                height: NOTE_SIZE,
                content: node.content,
                color: '#FEF3C7' // Level 2 用黃色系
              });
              
              newEdges.push({
                id: uuidv4(),
                from: parentNodeId,
                to: nodeId
              });
              
              nodeMap.set(node, nodeId);
            }
          }
        }
        
        // 批量更新
        updateWhiteboardData(prev => ({
          notes: [...prev.notes, ...newNotes],
          edges: [...prev.edges, ...newEdges],
          groups: prev.groups || []
        }));
      }
      
      const successMessage = parsedNodes.length > 0
        ? `💬 AI 回答完成！\n\n已將回答解析為 ${parsedNodes.length} 個結構化便利貼。`
        : isMultiSelect
        ? `💬 AI 回答完成！\n\n基於 ${sourceNoteIds.length} 個選中便利貼的詢問：\n"${customPrompt}"\n\n已創建新的便利貼顯示回答。`
        : `💬 AI 回答完成！\n\n基於便利貼的詢問：\n"${customPrompt}"\n\n已創建新的便利貼顯示回答。`;
      
      
    } catch (error) {
      console.error('AI Ask error:', error);
      
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
      
      return;
    }

    // 設置 loading 狀態
    setAiLoadingStates(prev => ({ ...prev, analyze: true }));
    
    
    try {
      const { aiService } = await import('../services/aiService');
      const analysis = await aiService.analyzeStructure(whiteboardData);
      
    } catch (error) {
      console.error('AI Analyze error:', error);
      
    } finally {
      // 清除 loading 狀態
      setAiLoadingStates(prev => ({ ...prev, analyze: false }));
    }
  };

  const handleAISummarize = async () => {
    if (whiteboardData.notes.length === 0) {
      
      return;
    }

    // 設置 loading 狀態
    setAiLoadingStates(prev => ({ ...prev, summarize: true }));
    
    
    try {
      const { aiService } = await import('../services/aiService');
      const summary = await aiService.summarize(whiteboardData);
      
    } catch (error) {
      console.error('AI Summarize error:', error);
      
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

    
    
    try {
      const { aiService } = await import('../services/aiService');
      const analysis = await aiService.analyzeSelection(selectedNotesData, relatedEdges);
      
    } catch (error) {
      console.error('AI Analyze Selection error:', error);
      
    }
    setShowAIMenu(false);
  };

  // AI 改進建議
  const handleAISuggestImprovements = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );

    
    
    try {
      const { aiService } = await import('../services/aiService');
      const suggestions = await aiService.suggestImprovements(selectedNotesData);
      
    } catch (error) {
      console.error('AI Suggest Improvements error:', error);
      
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

    
    
    try {
      const { aiService } = await import('../services/aiService');
      const result = await aiService.restructureContent(selectedNotesData, relatedEdges);
      
    } catch (error) {
      console.error('AI Restructure error:', error);
      
    }
    setShowAIMenu(false);
  };

  // AI SWOT 分析
  const handleAISWOT = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    const topic = selectedNotesData.length > 0 ? selectedNotesData[0].content : '主題';

    
    
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
      
      
    } catch (error) {
      console.error('AI SWOT error:', error);
      
    }
    setShowAIMenu(false);
  };

  // AI 心智圖生成
  const handleAIMindMap = async () => {
    const selectedNotesData = whiteboardData.notes.filter(note => 
      selectedNotes.includes(note.id)
    );
    const centralIdea = selectedNotesData.length > 0 ? selectedNotesData[0].content : '核心概念';

    
    
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
      
      
    } catch (error) {
      console.error('AI Mind Map error:', error);
      
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
      
      
    } catch (error) {
      console.error('AI Critical Path error:', error);
      
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
    if (!requirePlus()) return;
    // 檢查是否選中了單一便利貼
    if (selectedNotes.length !== 1) {
      
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
      
      return;
    }

    if (!isRegenerate) {
      
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

          
          setPendingAIResult(null);
        },
        onReject: () => {
          
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          handleAIConvergeNodes(true);
        }
      });

      setShowAIPreview(true);
      if (!isRegenerate) {
        
      }
    } catch (error) {
      console.error('AI Converge Nodes error:', error);
      
    }
  };

  // AI 自動分組
  const handleAIAutoGroup = async (isRegenerate = false) => {
    if (!requirePlus()) return;
    if (!isRegenerate) {
      
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
          
          
          setPendingAIResult(null);
        },
        onReject: () => {
          
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          
          handleAIAutoGroup(true);
        }
      });
      
      setShowAIPreview(true);
    } catch (error) {
      console.error('AI Auto Group error:', error);
      
    }
  };

  // AI 自動生成便利貼
  const handleAIAutoGenerate = async (isRegenerate = false) => {
    if (!requirePlus()) return;
    if (!isRegenerate) {
      
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
          notes: result.notes.map((note, index) => ({
            id: `ai-note-${Date.now()}-${index}`,
            content: note.content,
            x: note.x,
            y: note.y,
            width: 200,
            height: 150,
            shape: 'rectangle',
            color: note.color
          }))
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
          
          
          setPendingAIResult(null);
        },
        onReject: () => {
          
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          
          handleAIAutoGenerate(true);
        }
      });
      
      setShowAIPreview(true);
    } catch (error) {
      console.error('AI Auto Generate error:', error);
      
    }
  };

  // AI 自動連線
  const handleAIAutoConnect = async (isRegenerate = false) => {
    if (!requirePlus()) return;
    const targetNotes = selectedNotes.length > 0
      ? whiteboardData.notes.filter(note => selectedNotes.includes(note.id))
      : whiteboardData.notes;
    
    if (!isRegenerate) {
      
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
          
          
          setPendingAIResult(null);
        },
        onReject: () => {
          
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          
          handleAIAutoConnect(true);
        }
      });
      
      setShowAIPreview(true);
    } catch (error) {
      console.error('AI Auto Connect error:', error);
      
    }
  };

  // AI 智能整理
  const handleAISmartOrganize = async (isRegenerate = false) => {
    if (!requirePlus()) return;
    if (!isRegenerate) {
      
    }
    
    try {
      const { aiService } = await import('../services/aiService');
      const result = await aiService.smartOrganize(whiteboardData);
      
      // 保存結果
      setPendingAIResult({
        type: 'organize',
        ...result
      });
      
      // 設置預覽數據
      setAIPreviewData({
        type: 'organize',
        title: 'AI 智能整理預覽',
        description: '以下是 AI 對白板內容的整理建議',
        preview: {
          reason: result.reason,
          layout: result.layout.map(item => ({
            id: item.noteId,
            x: item.newX,
            y: item.newY
          })),
          newGroups: result.newGroups.map(group => ({
            name: group.name,
            description: `包含 ${group.noteIds.length} 個便利貼`,
            noteIds: group.noteIds,
            reason: '智能分組'
          })),
          removeSuggestions: result.removeSuggestions.map(noteId => {
            const note = whiteboardData.notes.find(n => n.id === noteId);
            return {
              id: noteId,
              content: note?.content || '',
              reason: '建議移除以簡化結構'
            };
          })
        },
        onApply: () => {
          if (!pendingAIResult) return;
          
          saveToHistory(whiteboardData);
          
          // 批次更新便利貼位置
          const updatedNotes = whiteboardData.notes.map(note => {
            const layout = pendingAIResult.layout as Array<{ noteId: string; newX: number; newY: number }> | undefined;
            const newPosition = layout?.find(l => l.noteId === note.id);
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
          const newGroups = (pendingAIResult.newGroups || []) as Group[];
          const updatedGroups = [...(whiteboardData.groups || []), ...newGroups];
          
          // 移除建議的冗餘便利貼（如果有）
          if (pendingAIResult.removeSuggestions && pendingAIResult.removeSuggestions.length > 0) {
            const filteredNotes = updatedNotes.filter(note => 
              !pendingAIResult.removeSuggestions?.includes(note.id)
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
          
          
          setPendingAIResult(null);
        },
        onReject: () => {
          
          setPendingAIResult(null);
        },
        onRegenerate: () => {
          handleAISmartOrganize(true);
        }
      });
      
      setShowAIPreview(true);
      if (!isRegenerate) {
        
      }
    } catch (error) {
      console.error('AI Smart Organize error:', error);
      
    }
  };

  // 清除畫布功能

  const handleClearCanvas = useCallback(() => {
    if (whiteboardData.notes.length === 0 && whiteboardData.edges.length === 0 && (!whiteboardData.images || whiteboardData.images.length === 0)) {
      return;
    }

    const confirmClear = window.confirm('確定要清除所有便利貼、連線和圖片嗎？此操作無法復原。');
    if (confirmClear) {
      const emptyData = { notes: [], edges: [], groups: [], images: [] };
      setWhiteboardData(emptyData);
      
      setSelectedNote(null);
      setConnectingFrom(null);
      
      // 清空當前專案的資料
      if (currentProjectId && user?.id) {
        ProjectService.saveProjectData(currentProjectId, emptyData, {
          zoomLevel,
          panOffset
        }).catch(error => {
          console.error('Failed to save cleared data:', error);
        });
      }
      
      // 清空舊的儲存格式（相容性）
      StorageService.clearWhiteboardData();
      setLastSaveTime(new Date());
    }
  }, [whiteboardData, currentProjectId, zoomLevel, panOffset]);

  return (
    <div className={`flex h-full overflow-hidden ${isDarkMode ? 'bg-dark-bg' : 'bg-white'}`}>
      {/* 白板畫布 */}
      <div 
        id="whiteboard-canvas"
        ref={canvasRef}
        data-canvas-background
        className={`flex-1 relative overflow-hidden transition-all select-none touch-manipulation ${
          isDragging ? 'cursor-grabbing' : isSelecting ? 'cursor-crosshair' : 'cursor-default'
        }`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onContextMenu={handleCanvasRightClick}
        onDoubleClick={handleCanvasDoubleClick}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleFileDrop}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          backgroundColor: isDarkMode ? '#1e1e1e' : 'white'
        }}
      >
        {/* 無限背景點點層 */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: isDarkMode 
              ? `radial-gradient(circle, #333333 ${1 * zoomLevel}px, transparent ${1 * zoomLevel}px)`
              : `radial-gradient(circle, #e5e7eb ${1 * zoomLevel}px, transparent ${1 * zoomLevel}px)`,
            backgroundSize: `${20 * zoomLevel}px ${20 * zoomLevel}px`,
            backgroundPosition: `${panOffset.x % (20 * zoomLevel)}px ${panOffset.y % (20 * zoomLevel)}px`
          }}
        />
        {/* 畫布使用提示 */}
        {whiteboardData.notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`text-center select-none ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <div className="text-6xl mb-4">🧠</div>
              <div className="text-lg font-medium mb-2">歡迎使用 ThinkBoard</div>
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
        {/* 無限畫布容器 */}
        <div 
          ref={containerRef}
          data-canvas-background
          className="relative"
          style={{
            // 使用超大的尺寸來模擬無限空間
            width: '50000px',
            height: '50000px',
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
            transformOrigin: '0 0',
            willChange: 'transform'
          }}
        >
          {/* SVG 用於繪製連線 */}
          <svg 
            className="absolute z-10"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50000px',
              height: '50000px',
              overflow: 'visible'
            }}
          >
            {/* 群組 - 只渲染頂層群組（沒有父群組的群組） */}
            {(() => {
              const allGroups = whiteboardData.groups || [];
              const topLevelGroups = allGroups.filter(group => !group.parentGroupId);
              
              
              return topLevelGroups.map(group => {
              const bounds = getGroupBounds(group.id);
              if (!bounds) return null;
              const isSelected = selectedGroups.includes(group.id) || previewSelectedGroups.includes(group.id);
              const isChildGroup = !!group.parentGroupId;
              const hasChildGroups = (group.childGroupIds?.length || 0) > 0;
              
              return (
                <GroupComponent
                  key={group.id}
                  group={group}
                  bounds={bounds}
                  isSelected={isSelected}
                  isDragHovered={dragHoveredGroup === group.id || draggedGroupHoveredGroup === group.id}
                  zoomLevel={zoomLevel}
                  shouldAutoFocus={autoFocusGroupId === group.id}
                  onAutoFocusHandled={() => setAutoFocusGroupId(null)}
                  onSelect={(isMultiSelect?: boolean) => {
                    if (isMultiSelect) {
                      // 多選模式：toggle 群組選擇
                      
                      // 如果有單選的群組但還沒有多選，先將單選的加入多選
                      if (selectedGroup && selectedGroups.length === 0) {
                        setSelectedGroups([selectedGroup]);
                        setSelectedGroup(null);
                      }
                      
                      if (selectedGroups.includes(group.id)) {
                        setSelectedGroups(prev => prev.filter(id => id !== group.id));
                      } else {
                        setSelectedGroups(prev => [...prev, group.id]);
                      }
                    } else {
                      // 單選模式：檢查是否已經在多選狀態中
                      const totalSelected = selectedNotes.length + selectedImages.length + selectedGroups.length;
                      
                      if (totalSelected > 1 && selectedGroups.includes(group.id)) {
                        // 如果當前是多選狀態且這個群組已經被選中，保持現有選擇狀態
                        console.log(`GROUP_DEBUG: Keeping multi-selection for drag`);
                      } else {
                        // 否則，單選模式：只選中當前群組
                        setSelectedGroups([group.id]);
                        setSelectedNote(null);
                        setSelectedNotes([]);
                        setSelectedImage(null);
                        setSelectedImages([]);
                        setSelectedEdge(null);
                      }
                    }
                  }}
                  onStartDrag={(e) => {
                    const startX = e.clientX;
                    const startY = e.clientY;
                    
                    // 檢查是否為多選拖曳
                    const totalSelectedCount = selectedNotes.length + selectedImages.length + selectedGroups.length;
                    console.log(`GROUP_DEBUG: onStartDrag - selectedNotes: ${selectedNotes.length}, selectedImages: ${selectedImages.length}, selectedGroups: ${selectedGroups.length}, total: ${totalSelectedCount}`);
                    const initialPositions: {[key: string]: {x: number, y: number}} = {};
                    
                    if (totalSelectedCount > 1) {
                      console.log(`GROUP_DEBUG: Multi-select drag mode`);
                      // 多選模式：收集所有選中元素的初始位置
                      
                      // 收集選中的便利貼
                      selectedNotes.forEach(noteId => {
                        const note = whiteboardData.notes.find(n => n.id === noteId);
                        if (note) {
                          initialPositions[note.id] = {x: note.x, y: note.y};
                        }
                      });
                      
                      // 收集選中的圖片
                      selectedImages.forEach(imageId => {
                        const img = whiteboardData.images?.find(i => i.id === imageId);
                        if (img) {
                          initialPositions[img.id] = {x: img.x, y: img.y};
                        }
                      });
                      
                      // 收集選中群組內的所有元素
                      const collectGroupElements = (targetGroupId: string) => {
                        const targetGroup = whiteboardData.groups?.find(g => g.id === targetGroupId);
                        if (!targetGroup) return;
                        
                        // 收集群組內的便利貼
                        whiteboardData.notes.forEach(note => {
                          if (note.groupId === targetGroupId) {
                            initialPositions[note.id] = {x: note.x, y: note.y};
                          }
                        });
                        
                        // 收集群組內的圖片
                        (whiteboardData.images || []).forEach(img => {
                          if (img.groupId === targetGroupId) {
                            initialPositions[img.id] = {x: img.x, y: img.y};
                          }
                        });
                        
                        // 遞歸處理子群組
                        if (targetGroup.childGroupIds && targetGroup.childGroupIds.length > 0) {
                          targetGroup.childGroupIds.forEach(childGroupId => {
                            collectGroupElements(childGroupId);
                          });
                        }
                      };
                      
                      selectedGroups.forEach(groupId => {
                        collectGroupElements(groupId);
                      });
                      
                      console.log(`GROUP_DEBUG: Collected initial positions for multi-select:`, Object.keys(initialPositions));
                      
                    } else {
                      // 單群組模式：只收集當前群組的元素
                      const collectInitialPositions = (targetGroupId: string, positions: {[key: string]: {x: number, y: number}}) => {
                        const targetGroup = whiteboardData.groups?.find(g => g.id === targetGroupId);
                        if (!targetGroup) return;
                        
                        // 收集直接包含的便利貼
                        whiteboardData.notes.forEach(note => {
                          if (note.groupId === targetGroupId) {
                            positions[note.id] = {x: note.x, y: note.y};
                          }
                        });
                        
                        // 收集直接包含的圖片
                        (whiteboardData.images || []).forEach(img => {
                          if (img.groupId === targetGroupId) {
                            positions[img.id] = {x: img.x, y: img.y};
                          }
                        });
                        
                        // 遞歸處理子群組
                        if (targetGroup.childGroupIds && targetGroup.childGroupIds.length > 0) {
                          targetGroup.childGroupIds.forEach(childGroupId => {
                            collectInitialPositions(childGroupId, positions);
                          });
                        }
                      };
                      
                      collectInitialPositions(group.id, initialPositions);
                    }
                    
                    setGroupDragState({
                      isDragging: true,
                      groupId: group.id,
                      startX,
                      startY,
                      initialPositions
                    });
                  }}
                  onUpdateName={(name) => updateGroupName(group.id, name)}
                  onUpdateColor={(color) => updateGroupColor(group.id, color)}
                  onUngroup={() => ungroupNotes(group.id)}
                  onDelete={() => deleteGroup(group.id)}
                  onCreateParentGroup={() => createParentGroup([group.id])}
                  isChildGroup={isChildGroup}
                  hasChildGroups={hasChildGroups}
                />
              );
            });
            })()}

            {/* 子群組渲染 - 遞歸渲染所有子群組 */}
            {(() => {
              const renderChildGroups = (parentGroupId: string): React.ReactElement[] => {
                const parentGroup = whiteboardData.groups?.find(g => g.id === parentGroupId);
                
                if (!parentGroup?.childGroupIds || parentGroup.childGroupIds.length === 0) return [];
                
                return parentGroup.childGroupIds.flatMap(childGroupId => {
                  const childGroup = whiteboardData.groups?.find(g => g.id === childGroupId);
                  if (!childGroup) return [];
                  
                  const bounds = getGroupBounds(childGroup.id);
                  if (!bounds) return [];
                  
                  const isSelected = selectedGroups.includes(childGroup.id) || previewSelectedGroups.includes(childGroup.id);
                  const hasChildGroups = (childGroup.childGroupIds?.length || 0) > 0;
                  
                  return [
                    <GroupComponent
                      key={childGroup.id}
                      group={childGroup}
                      bounds={bounds}
                      isSelected={isSelected}
                      isDragHovered={dragHoveredGroup === childGroup.id || draggedGroupHoveredGroup === childGroup.id}
                      zoomLevel={zoomLevel}
                      shouldAutoFocus={autoFocusGroupId === childGroup.id}
                      onAutoFocusHandled={() => setAutoFocusGroupId(null)}
                      onSelect={(isMultiSelect?: boolean) => {
                        if (isMultiSelect) {
                          // 多選模式：toggle 群組選擇
                          
                          // 如果有單選的群組但還沒有多選，先將單選的加入多選
                          if (selectedGroup && selectedGroups.length === 0) {
                            setSelectedGroups([selectedGroup]);
                            setSelectedGroup(null);
                          }
                          
                          if (selectedGroups.includes(childGroup.id)) {
                            setSelectedGroups(prev => prev.filter(id => id !== childGroup.id));
                          } else {
                            setSelectedGroups(prev => [...prev, childGroup.id]);
                          }
                        } else {
                          // 單選模式：只選中當前群組
                          setSelectedGroups([childGroup.id]);
                          setSelectedNote(null);
                          setSelectedNotes([]);
                          setSelectedImage(null);
                          setSelectedImages([]);
                          setSelectedEdge(null);
                        }
                      }}
                      onUpdateName={(name) => updateGroupName(childGroup.id, name)}
                      onUpdateColor={(color) => updateGroupColor(childGroup.id, color)}
                      onUngroup={() => ungroupNotes(childGroup.id)}
                      onDelete={() => deleteGroup(childGroup.id)}
                      onCreateParentGroup={() => createParentGroup([childGroup.id])}
                      isChildGroup={true}
                      hasChildGroups={hasChildGroups}
                      onStartDrag={(e) => {
                        // 與父群組相同的拖曳邏輯
                        const getAllElementsInGroup = (groupId: string): {notes: StickyNote[], images: ImageElement[]} => {
                          const currentGroup = whiteboardData.groups?.find(g => g.id === groupId);
                          if (!currentGroup) return {notes: [], images: []};
                          
                          let allNotes = getGroupNotes(groupId);
                          let allImages = whiteboardData.images?.filter(img => img.groupId === groupId) || [];
                          
                          if (currentGroup.childGroupIds) {
                            for (const childId of currentGroup.childGroupIds) {
                              const childElements = getAllElementsInGroup(childId);
                              allNotes = allNotes.concat(childElements.notes);
                              allImages = allImages.concat(childElements.images);
                            }
                          }
                          
                          return {notes: allNotes, images: allImages};
                        };
                        
                        const {notes: allNotes, images: allImages} = getAllElementsInGroup(childGroup.id);
                        const positions: {[key: string]: {x: number, y: number}} = {};
                        
                        allNotes.forEach(note => {
                          positions[note.id] = { x: note.x, y: note.y };
                        });
                        allImages.forEach(img => {
                          positions[img.id] = { x: img.x, y: img.y };
                        });
                        
                        setGroupDragState({
                          isDragging: true,
                          groupId: childGroup.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          initialPositions: positions
                        });
                        
                        setSelectedGroup(childGroup.id);
                        setSelectedNote(null);
                        setSelectedImage(null);
                        setSelectedNotes([]);
                        setSelectedImages([]);
                      }}
                    />,
                    // 遞歸渲染這個子群組的子群組
                    ...renderChildGroups(childGroup.id)
                  ];
                });
              };
              
              // 為所有頂層群組渲染子群組
              return (whiteboardData.groups || [])
                .filter(group => !group.parentGroupId)
                .flatMap(group => renderChildGroups(group.id));
            })()}


            {/* 多選邊框 */}
            {(selectedNotes.length + selectedImages.length + selectedGroups.length > 1) && (() => {
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

            {/* 線條 - 渲染在群組之上以確保可以被選取 */}
            {whiteboardData.edges.map(edge => (
              <EdgeComponent 
                key={edge.id}
                edge={edge}
                notes={whiteboardData.notes}
                images={whiteboardData.images || []}
                isSelected={selectedEdge === edge.id}
                onSelect={() => {
                  setSelectedEdge(edge.id);
                  setSelectedNote(null); // 清除便利貼選取
                  setSelectedImage(null); // 清除圖片選取
                  setSelectedImages([]);
                }}
                onDelete={() => {
                  console.log('Deleting edge from Whiteboard:', edge.id);
                  deleteEdge(edge.id);
                }}
              />
            ))}

            {/* 跟隨滑鼠的預覽連線 */}
            {connectingFrom && (() => {
              // 查找起點（可能是便利貼或圖片）
              const fromNote = whiteboardData.notes.find(note => note.id === connectingFrom);
              const fromImage = whiteboardData.images?.find(img => img.id === connectingFrom);
              const fromElement = fromNote || fromImage;
              
              if (!fromElement) return null;

              const fromX = fromElement.x + fromElement.width / 2;
              const fromY = fromElement.y + fromElement.height / 2;
              let toX = mousePosition.x;
              let toY = mousePosition.y;

              // 如果懸停在目標上（便利貼或圖片），連到其中心
              if (hoveredNote) {
                const hoveredNoteData = whiteboardData.notes.find(note => note.id === hoveredNote);
                if (hoveredNoteData) {
                  toX = hoveredNoteData.x + hoveredNoteData.width / 2;
                  toY = hoveredNoteData.y + hoveredNoteData.height / 2;
                }
              } else if (hoveredImage) {
                const hoveredImageData = whiteboardData.images?.find(img => img.id === hoveredImage);
                if (hoveredImageData) {
                  toX = hoveredImageData.x + hoveredImageData.width / 2;
                  toY = hoveredImageData.y + hoveredImageData.height / 2;
                }
              }

              // 計算箭頭角度
              const angle = Math.atan2(toY - fromY, toX - fromX);
              
              // 計算到正方形邊緣的實際距離（與 Edge 組件相同的計算方式）
              const getDistanceToEdge = (width: number, height: number, angle: number) => {
                const halfWidth = width / 2;
                const halfHeight = height / 2;
                
                if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
                  return halfWidth / Math.abs(Math.cos(angle));
                } else {
                  return halfHeight / Math.abs(Math.sin(angle));
                }
              };
              
              // 調整起點位置，留出間距（與實際線條一致）
              const gap = 15;
              const fromDistance = getDistanceToEdge(fromElement.width, fromElement.height, angle) + gap;
              const adjustedFromX = fromX + Math.cos(angle) * fromDistance;
              const adjustedFromY = fromY + Math.sin(angle) * fromDistance;
              
              // 調整終點位置
              let adjustedToX = toX;
              let adjustedToY = toY;
              
              if (hoveredNote) {
                const hoveredNoteData = whiteboardData.notes.find(note => note.id === hoveredNote);
                if (hoveredNoteData) {
                  const toDistance = getDistanceToEdge(hoveredNoteData.width, hoveredNoteData.height, angle) + gap;
                  adjustedToX = toX - Math.cos(angle) * toDistance;
                  adjustedToY = toY - Math.sin(angle) * toDistance;
                }
              } else if (hoveredImage) {
                const hoveredImageData = whiteboardData.images?.find(img => img.id === hoveredImage);
                if (hoveredImageData) {
                  const toDistance = getDistanceToEdge(hoveredImageData.width, hoveredImageData.height, angle) + gap;
                  adjustedToX = toX - Math.cos(angle) * toDistance;
                  adjustedToY = toY - Math.sin(angle) * toDistance;
                }
              }

              // 箭頭設定（與 Edge 組件保持一致）
              const arrowSize = 16;
              const arrowOffset = 8;
              const arrowTipX = adjustedToX + Math.cos(angle) * arrowOffset;
              const arrowTipY = adjustedToY + Math.sin(angle) * arrowOffset;
              
              const arrowPoints = [
                [arrowTipX, arrowTipY],
                [
                  arrowTipX - arrowSize * Math.cos(angle - Math.PI / 6),
                  arrowTipY - arrowSize * Math.sin(angle - Math.PI / 6)
                ],
                [
                  arrowTipX - arrowSize * Math.cos(angle + Math.PI / 6),
                  arrowTipY - arrowSize * Math.sin(angle + Math.PI / 6)
                ]
              ].map(point => point.join(',')).join(' ');

              // 預覽線條顏色和樣式
              const previewColor = hoveredNote ? '#10b981' : '#6B7280';
              const strokeWidth = 3.5;

              return (
                <g key="preview-line">
                  <line
                    x1={adjustedFromX}
                    y1={adjustedFromY}
                    x2={arrowTipX - Math.cos(angle) * (arrowSize * 0.7)}
                    y2={arrowTipY - Math.sin(angle) * (arrowSize * 0.7)}
                    stroke={previewColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={hoveredNote ? "none" : "5,5"}
                    style={{
                      pointerEvents: 'none',
                      opacity: hoveredNote ? 0.9 : 0.6,
                      transition: 'all 0.2s ease'
                    }}
                    className={hoveredNote ? "" : "animate-pulse"}
                  />
                  {/* 箭頭 */}
                  <polygon
                    points={arrowPoints}
                    fill={previewColor}
                    style={{ 
                      pointerEvents: 'none',
                      opacity: hoveredNote ? 0.9 : 0.6,
                      transition: 'all 0.2s ease'
                    }}
                    className={hoveredNote ? "" : "animate-pulse"}
                  />
                </g>
              );
            })()}

            {/* 拖曳選取框 - 放在最上層 */}
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
          </svg>

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
              isDarkMode={isDarkMode}
              onSelect={(isMultiSelect?: boolean) => {
                if (isMultiSelect) {
                  // Ctrl/Cmd 被按下，進入多選模式
                  
                  // 如果有單選的便利貼但還沒有多選，先將單選的加入多選
                  if (selectedNote && selectedNotes.length === 0) {
                    setSelectedNotes([selectedNote]);
                    setSelectedNote(null);
                  }
                  
                  if (selectedNotes.includes(note.id)) {
                    // 如果已經選中，則取消選中
                    setSelectedNotes(prev => prev.filter(id => id !== note.id));
                    if (selectedNotes.length === 1) {
                      // 如果只剩一個選中的，清除多選狀態
                      setSelectedNote(null);
                    }
                  } else {
                    // 如果未選中，則添加到多選
                    setSelectedNotes(prev => [...prev, note.id]);
                    setSelectedNote(null);
                  }
                  // 清除其他類型的選取
                  setSelectedImage(null);
                  setSelectedImages([]);
                  setSelectedEdge(null);
                } else {
                  // 沒有按 Ctrl/Cmd，正常單選
                  if (selectedNotes.includes(note.id) && selectedNotes.length > 1) {
                    // 如果當前便利貼在多選中，且有多個選中，保持多選狀態
                    return;
                  }
                  
                  // 否則進行正常選取
                  setSelectedNote(note.id);
                  setSelectedNotes([]); // 清除多選
                  setSelectedImage(null); // 清除圖片選取
                  setSelectedImages([]); // 清除圖片多選
                  setSelectedEdge(null); // 清除連線選取
                  // 清除自動編輯標記
                  if (autoEditNoteId === note.id) {
                    setAutoEditNoteId(null);
                  }
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
              onQuickConnect={(direction) => handleQuickConnect(note.id, direction)}
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
                setDragHoveredGroup(null);
              }}
              onDragOverGroup={handleNoteDragOverGroup}
              onDragEndGroup={(noteId, x, y, width, height) => {
                if (dragHoveredGroup) {
                  addNoteToGroup(noteId, dragHoveredGroup);
                }
                setDragHoveredGroup(null);
              }}
            />
          ))}

          {/* 圖片 */}
          {(whiteboardData.images || []).map(image => (
            <ImageElementComponent
              key={image.id}
              image={image}
              isSelected={selectedImage === image.id || selectedImages.includes(image.id)}
              isSingleSelected={selectedImage === image.id && selectedImages.length === 0}
              isMultiSelected={selectedImages.length > 0}
              isPreviewSelected={false} // TODO: 加入圖片的預覽選取
              isConnecting={connectingFrom === image.id}
              isConnectTarget={connectingFrom !== null && connectingFrom !== image.id}
              isHoveredForConnection={connectingFrom !== null && connectingFrom !== image.id && hoveredImage === image.id}
              zoomLevel={zoomLevel}
              panOffset={panOffset}
              viewportToLogical={viewportToLogical}
              onSelect={(isMultiSelect?: boolean) => {
                if (isMultiSelect) {
                  // Ctrl/Cmd 被按下，進入多選模式
                  
                  // 如果有單選的圖片但還沒有多選，先將單選的加入多選
                  if (selectedImage && selectedImages.length === 0) {
                    setSelectedImages([selectedImage]);
                    setSelectedImage(null);
                  }
                  
                  if (selectedImages.includes(image.id)) {
                    // 如果已經選中，則取消選中
                    setSelectedImages(prev => prev.filter(id => id !== image.id));
                    if (selectedImages.length === 1) {
                      // 如果只剩一個選中的，清除多選狀態
                      setSelectedImage(null);
                    }
                  } else {
                    // 如果未選中，則添加到多選
                    setSelectedImages(prev => [...prev, image.id]);
                    setSelectedImage(null);
                  }
                  // 清除其他類型的選取
                  setSelectedNote(null);
                  setSelectedNotes([]);
                  setSelectedEdge(null);
                } else {
                  // 沒有按 Ctrl/Cmd，正常單選
                  if (selectedImages.includes(image.id) && selectedImages.length > 1) {
                    // 如果當前圖片在多選中，且有多個選中，保持多選狀態
                    return;
                  }
                  
                  // 否則進行正常選取
                  setSelectedImage(image.id);
                  setSelectedImages([]);
                  setSelectedNote(null);
                  setSelectedNotes([]);
                  setSelectedEdge(null);
                }
              }}
              onUpdatePosition={(x, y) => updateImagePosition(image.id, x, y)}
              onUpdateSize={(width, height) => updateImageSize(image.id, width, height)}
              onDelete={() => deleteImage(image.id)}
              onStartConnection={() => {
                setConnectingFrom(image.id);
                setHoveredNote(null);
                setHoveredImage(null);
              }}
              onQuickConnect={(direction) => handleImageQuickConnect(image.id, direction)}
              onCreateGroup={() => {
                if (selectedImages.length >= 2 || (selectedImages.length + selectedNotes.length >= 2)) {
                  createGroup(selectedNotes, selectedImages);
                }
              }}
              onUngroupImages={() => {
                if (image.groupId) {
                  ungroupNotes(image.groupId);
                }
              }}
              onBatchMove={handleBatchMove}
              onInitBatchDrag={initBatchDragPositions}
              onMouseEnter={() => setHoveredImage(image.id)}
              onMouseLeave={() => setHoveredImage(null)}
              onStartDrag={() => setIsDraggingNote(true)}
              onEndDrag={() => setIsDraggingNote(false)}
            />
          ))}
        </div>

        {/* 儲存狀態指示器 - 固定在畫面上方 */}
        {lastSaveTime && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full shadow-md text-xs z-30 ${
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
      </div>

      {/* 右側面板 */}
      <SidePanel 
        currentProject={currentProject}
        syncStatus={syncStatus}
        whiteboardData={whiteboardData}
        onProjectSelect={async (projectId) => {
          // 切換專案
          try {
            const project = await ProjectService.getProject(projectId);
            if (project) {
              // 儲存當前專案的資料
              if (currentProjectId && user?.id) {
                await ProjectService.saveProjectData(currentProjectId, whiteboardData);
              }
              
              // 切換到新專案
              ProjectService.setCurrentProject(projectId);
              setCurrentProjectId(projectId);
              setCurrentProject(project);
              
              // Google Analytics 追蹤
              gtag.trackProjectEvent('open', projectId, {
                user_id: user?.id,
                project_name: project.name,
                notes_count: whiteboardData.notes.length
              });
              
              // 載入新專案的資料
              const projectData = await ProjectService.loadProjectData(projectId);
              if (projectData) {
                setWhiteboardData(projectData);
                // 重置歷史記錄
                setHistory([projectData]);
                setHistoryIndex(0);
              } else {
                const emptyData = { notes: [], edges: [], groups: [], images: [] };
                setWhiteboardData(emptyData);
                setHistory([emptyData]);
                setHistoryIndex(0);
              }
            }
          } catch (error) {
            console.error('Failed to switch project:', error);
          }
          
          // 重置視圖
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        }}
        onProjectCreate={async (name, description) => {
          // 創建新專案並切換到它
          const newProject = await ProjectService.createProject(name, description);
          ProjectService.setCurrentProject(newProject.id);
          setCurrentProjectId(newProject.id);
          setCurrentProject(newProject);
          
          // Google Analytics 追蹤
          gtag.trackProjectEvent('create', newProject.id, {
            user_id: user?.id,
            project_name: name,
            project_description: description
          });
          
          // 初始化空白板
          setWhiteboardData({ notes: [], edges: [], groups: [] });
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
          
          // 初始化歷史記錄
          setHistory([{ notes: [], edges: [], groups: [] }]);
          setHistoryIndex(0);
        }}
        onProjectDelete={async (projectId) => {
          // 刪除專案
          try {
            await ProjectService.deleteProject(projectId);
            
            // 如果刪除的是當前專案，切換到第一個專案
            if (projectId === currentProjectId) {
              const projects = await ProjectService.getAllProjects();
              if (projects.length > 0) {
                const firstProject = projects[0];
                setCurrentProjectId(firstProject.id);
                setCurrentProject(firstProject);
                
                const projectData = await ProjectService.loadProjectData(firstProject.id);
                if (projectData) {
                  setWhiteboardData(projectData);
                } else {
                  setWhiteboardData({ notes: [], edges: [], groups: [], images: [] });
                }
              } else {
                // 沒有專案了，創建預設專案
                const defaultProject = await ProjectService.createProject('我的白板', '預設專案');
                setCurrentProjectId(defaultProject.id);
                setCurrentProject(defaultProject);
                setWhiteboardData({ notes: [], edges: [], groups: [], images: [] });
              }
            }
          } catch (error) {
            console.error('Failed to delete project:', error);
          }
        }}
        cloudSyncEnabled={cloudSyncEnabled}
        onToggleCloudSync={handleToggleCloudSync}
      />

      {/* 桌面版底部懸浮工具列 - 只在大螢幕顯示 */}
      <div className="hidden md:block">
        <FloatingToolbar
        onAnalyze={handleAIAnalyze}
        onSummarize={handleAISummarize}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        selectedCount={selectedNotes.length}
        aiLoadingStates={aiLoadingStates}
        onImageUpload={handleImageUpload}
        onVersions={() => setShowVersionDialog(true)}
        onExport={async (format) => {
          try {
            if (format === 'json') {
              const { exportWhiteboard } = await import('../services/exportService');
              await exportWhiteboard.asJSON(whiteboardData);
              
              // Google Analytics 追蹤
              gtag.trackExportEvent('json', whiteboardData.notes.length, {
                user_id: user?.id,
                edges_count: whiteboardData.edges.length,
                groups_count: whiteboardData.groups?.length || 0
              });
              
            } else if (format === 'png') {
              const { exportWhiteboard } = await import('../services/exportService');
              await exportWhiteboard.asPNG('whiteboard-canvas');
              
              // Google Analytics 追蹤
              gtag.trackExportEvent('png', whiteboardData.notes.length, {
                user_id: user?.id,
                edges_count: whiteboardData.edges.length,
                groups_count: whiteboardData.groups?.length || 0
              });
              
            } else if (format === 'pdf') {
              const { exportWhiteboard } = await import('../services/exportService');
              await exportWhiteboard.asPDF('whiteboard-canvas');
              
              // Google Analytics 追蹤
              gtag.trackExportEvent('pdf', whiteboardData.notes.length, {
                user_id: user?.id,
                edges_count: whiteboardData.edges.length,
                groups_count: whiteboardData.groups?.length || 0
              });
              
            }
          } catch (error) {
            console.error('匯出失敗:', error);
            
          }
        }}
        onImport={async () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              try {
                const { exportWhiteboard } = await import('../services/exportService');
                const importedData = await exportWhiteboard.importJSON(file);
                
                // 確認是否要替換當前白板
                if (whiteboardData.notes.length > 0) {
                  if (!confirm('匯入會替換當前的白板內容，確定要繼續嗎？')) {
                    return;
                  }
                }
                
                // 設定匯入的資料
                setWhiteboardData(importedData);
                // 儲存到歷史記錄
                setHistory([...history.slice(0, historyIndex + 1), importedData]);
                setHistoryIndex(historyIndex + 1);
                // 儲存到本地儲存
                StorageService.saveWhiteboardData(importedData);
                
              } catch (error) {
                console.error('匯入失敗:', error);
                
              }
            }
          };
          input.click();
        }}
        onTemplate={() => {
          setShowTemplates(true);
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
      </div>

      {/* 行動版選單 - 只在小螢幕顯示 */}
      <div className="md:hidden">
        <MobileMenu
          onNewNote={() => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const centerX = rect.width / 2;
              const centerY = rect.height / 2;
              const logicalPoint = viewportToLogical(centerX, centerY);
              addStickyNote(logicalPoint.x - 100, logicalPoint.y - 50);
            }
          }}
          onTemplate={() => setShowTemplates(true)}
          onSearch={() => console.log('Search')}
          onExport={async (format) => {
            try {
              if (format === 'json') {
                const { exportWhiteboard } = await import('../services/exportService');
                await exportWhiteboard.asJSON(whiteboardData);
                
              } else if (format === 'png') {
                const { exportWhiteboard } = await import('../services/exportService');
                await exportWhiteboard.asPNG('whiteboard-canvas');
                
              } else if (format === 'pdf') {
                const { exportWhiteboard } = await import('../services/exportService');
                await exportWhiteboard.asPDF('whiteboard-canvas');
                
              }
            } catch (error) {
              console.error('匯出失敗:', error);
              
            }
          }}
          onClear={handleClearCanvas}
          onAnalyze={handleAIAnalyze}
          onSummarize={handleAISummarize}
          selectedCount={selectedNotes.length}
        />
      </div>

      
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
              groupId: undefined
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
              color: groupData.color || '#F3F4F6',
              createdAt: new Date()
            };
            
            // 將便利貼加入群組（根據原始模板的 noteIds）
            if (groupData.noteIds) {
              groupData.noteIds.forEach(oldNoteId => {
                const newNoteId = idMap.get(oldNoteId);
                if (newNoteId) {
                  const note = newNotes.find(n => n.id === newNoteId);
                  if (note) {
                    note.groupId = newGroupId;
                    newGroup.noteIds.push(newNoteId);
                  }
                }
              });
            }
            
            return newGroup;
          }) || [];
          
          // 套用範本
          updateWhiteboardData({
            notes: [...whiteboardData.notes, ...newNotes],
            edges: [...whiteboardData.edges, ...newEdges],
            groups: [...(whiteboardData.groups || []), ...newGroups]
          });
          
          
        }}
      />
      
      {/* 版本管理對話框 */}
      <VersionDialog
        isOpen={showVersionDialog}
        onClose={() => setShowVersionDialog(false)}
        projectId={currentProjectId}
        currentData={whiteboardData}
        onRestore={(restoredData) => {
          // 還原版本資料
          setWhiteboardData(restoredData);
          // 重置歷史記錄
          setHistory([restoredData]);
          setHistoryIndex(0);
          // 重新啟動自動備份
          if (currentProjectId) {
            VersionService.stopAutoBackup();
            VersionService.startAutoBackup(
              currentProjectId,
              () => whiteboardDataRef.current,
              (error) => {
                console.error('Auto-backup error:', error);
              }
            );
          }
        }}
      />
      
      {/* 專案選擇對話框 */}
      <ProjectDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        onSelectProject={async (projectId) => {
          try {
            // 切換專案
            ProjectService.setCurrentProject(projectId);
            setCurrentProjectId(projectId);
            
            // 載入新專案資料
            const projectData = await ProjectService.loadProjectData(projectId);
              
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
          } catch (error) {
            console.error('Failed to switch project:', error);
          }
          
          // 更新當前專案資訊
          try {
            const projects = await ProjectService.getAllProjects();
            const project = projects.find(p => p.id === projectId);
            setCurrentProject(project || null);
          } catch (error) {
            console.error('Failed to update current project:', error);
          }
          
          setShowProjectDialog(false);
          
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

      {/* GA4 測試按鈕 - 已暫時註解 */}
      {/* {process.env.NODE_ENV === 'development' && <GATestButton />} */}
    </div>
  );
};

export default Whiteboard;