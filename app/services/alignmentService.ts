import { StickyNote } from '../types';

interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
}

interface AlignmentResult {
  guides: AlignmentGuide[];
  snappedPosition: { x: number; y: number };
}

const SNAP_THRESHOLD = 10; // 吸附閾值（像素）
const GUIDE_EXTENSION = 50; // 輔助線延伸長度

export class AlignmentService {
  /**
   * 計算對齊輔助線和吸附位置
   * @param movingNote 正在移動的便利貼
   * @param targetPosition 目標位置
   * @param allNotes 所有便利貼
   * @param selectedNoteIds 選中的便利貼ID（這些不參與對齊計算）
   * @returns 對齊結果
   */
  static calculateAlignment(
    movingNote: StickyNote,
    targetPosition: { x: number; y: number },
    allNotes: StickyNote[],
    selectedNoteIds: string[] = []
  ): AlignmentResult {
    const guides: AlignmentGuide[] = [];
    let snappedX = targetPosition.x;
    let snappedY = targetPosition.y;
    
    // 移動便利貼的邊界
    const movingBounds = {
      left: targetPosition.x,
      right: targetPosition.x + movingNote.width,
      top: targetPosition.y,
      bottom: targetPosition.y + movingNote.height,
      centerX: targetPosition.x + movingNote.width / 2,
      centerY: targetPosition.y + movingNote.height / 2
    };
    
    // 用於記錄最小吸附距離
    let minHorizontalDiff = Infinity;
    let minVerticalDiff = Infinity;
    let horizontalSnapTarget: number | null = null;
    let verticalSnapTarget: number | null = null;
    
    // 檢查與其他便利貼的對齊
    allNotes.forEach(note => {
      // 跳過自己和選中的便利貼
      if (note.id === movingNote.id || selectedNoteIds.includes(note.id)) {
        return;
      }
      
      const targetBounds = {
        left: note.x,
        right: note.x + note.width,
        top: note.y,
        bottom: note.y + note.height,
        centerX: note.x + note.width / 2,
        centerY: note.y + note.height / 2
      };
      
      // 垂直對齊檢查（水平輔助線）
      const horizontalAlignments = [
        { moving: movingBounds.top, target: targetBounds.top, type: 'top' },
        { moving: movingBounds.top, target: targetBounds.bottom, type: 'top-bottom' },
        { moving: movingBounds.bottom, target: targetBounds.top, type: 'bottom-top' },
        { moving: movingBounds.bottom, target: targetBounds.bottom, type: 'bottom' },
        { moving: movingBounds.centerY, target: targetBounds.centerY, type: 'center' }
      ];
      
      horizontalAlignments.forEach(align => {
        const diff = Math.abs(align.moving - align.target);
        if (diff < SNAP_THRESHOLD && diff < minHorizontalDiff) {
          minHorizontalDiff = diff;
          horizontalSnapTarget = align.target;
          
          // 根據對齊類型計算吸附位置
          switch (align.type) {
            case 'top':
            case 'top-bottom':
              snappedY = align.target;
              break;
            case 'bottom':
            case 'bottom-top':
              snappedY = align.target - movingNote.height;
              break;
            case 'center':
              snappedY = align.target - movingNote.height / 2;
              break;
          }
        }
      });
      
      // 水平對齊檢查（垂直輔助線）
      const verticalAlignments = [
        { moving: movingBounds.left, target: targetBounds.left, type: 'left' },
        { moving: movingBounds.left, target: targetBounds.right, type: 'left-right' },
        { moving: movingBounds.right, target: targetBounds.left, type: 'right-left' },
        { moving: movingBounds.right, target: targetBounds.right, type: 'right' },
        { moving: movingBounds.centerX, target: targetBounds.centerX, type: 'center' }
      ];
      
      verticalAlignments.forEach(align => {
        const diff = Math.abs(align.moving - align.target);
        if (diff < SNAP_THRESHOLD && diff < minVerticalDiff) {
          minVerticalDiff = diff;
          verticalSnapTarget = align.target;
          
          // 根據對齊類型計算吸附位置
          switch (align.type) {
            case 'left':
            case 'left-right':
              snappedX = align.target;
              break;
            case 'right':
            case 'right-left':
              snappedX = align.target - movingNote.width;
              break;
            case 'center':
              snappedX = align.target - movingNote.width / 2;
              break;
          }
        }
      });
    });
    
    // 生成輔助線
    if (horizontalSnapTarget !== null) {
      // 找出所有在這條線上的便利貼的範圍
      let minX = snappedX;
      let maxX = snappedX + movingNote.width;
      
      allNotes.forEach(note => {
        if (note.id === movingNote.id || selectedNoteIds.includes(note.id)) return;
        
        const noteBounds = {
          top: note.y,
          bottom: note.y + note.height,
          centerY: note.y + note.height / 2,
          left: note.x,
          right: note.x + note.width
        };
        
        // 檢查是否在同一水平線上
        if (horizontalSnapTarget !== null && 
            (Math.abs(noteBounds.top - horizontalSnapTarget) < 1 ||
             Math.abs(noteBounds.bottom - horizontalSnapTarget) < 1 ||
             Math.abs(noteBounds.centerY - horizontalSnapTarget) < 1)) {
          minX = Math.min(minX, noteBounds.left);
          maxX = Math.max(maxX, noteBounds.right);
        }
      });
      
      guides.push({
        type: 'horizontal',
        position: horizontalSnapTarget,
        start: minX - GUIDE_EXTENSION,
        end: maxX + GUIDE_EXTENSION
      });
    }
    
    if (verticalSnapTarget !== null) {
      // 找出所有在這條線上的便利貼的範圍
      let minY = snappedY;
      let maxY = snappedY + movingNote.height;
      
      allNotes.forEach(note => {
        if (note.id === movingNote.id || selectedNoteIds.includes(note.id)) return;
        
        const noteBounds = {
          left: note.x,
          right: note.x + note.width,
          centerX: note.x + note.width / 2,
          top: note.y,
          bottom: note.y + note.height
        };
        
        // 檢查是否在同一垂直線上
        if (verticalSnapTarget !== null &&
            (Math.abs(noteBounds.left - verticalSnapTarget) < 1 ||
             Math.abs(noteBounds.right - verticalSnapTarget) < 1 ||
             Math.abs(noteBounds.centerX - verticalSnapTarget) < 1)) {
          minY = Math.min(minY, noteBounds.top);
          maxY = Math.max(maxY, noteBounds.bottom);
        }
      });
      
      guides.push({
        type: 'vertical',
        position: verticalSnapTarget,
        start: minY - GUIDE_EXTENSION,
        end: maxY + GUIDE_EXTENSION
      });
    }
    
    return {
      guides,
      snappedPosition: { x: snappedX, y: snappedY }
    };
  }
  
  /**
   * 計算多個便利貼移動時的對齊
   */
  static calculateMultipleAlignment(
    movingNotes: StickyNote[],
    deltaX: number,
    deltaY: number,
    allNotes: StickyNote[]
  ): AlignmentResult {
    if (movingNotes.length === 0) {
      return { guides: [], snappedPosition: { x: 0, y: 0 } };
    }
    
    // 找出移動便利貼組的邊界
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    movingNotes.forEach(note => {
      minX = Math.min(minX, note.x + deltaX);
      minY = Math.min(minY, note.y + deltaY);
      maxX = Math.max(maxX, note.x + note.width + deltaX);
      maxY = Math.max(maxY, note.y + note.height + deltaY);
    });
    
    // 創建一個虛擬的包圍盒便利貼
    const virtualNote: StickyNote = {
      id: 'virtual',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      content: '',
      color: ''
    };
    
    // 排除正在移動的便利貼
    const movingNoteIds = movingNotes.map(n => n.id);
    const targetPosition = { x: minX, y: minY };
    
    // 使用單個便利貼的對齊邏輯
    const result = this.calculateAlignment(virtualNote, targetPosition, allNotes, movingNoteIds);
    
    // 調整吸附位置為相對位移
    return {
      guides: result.guides,
      snappedPosition: {
        x: result.snappedPosition.x - minX + deltaX,
        y: result.snappedPosition.y - minY + deltaY
      }
    };
  }
}