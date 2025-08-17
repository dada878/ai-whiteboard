# 圖片功能實作指南

本文件記錄了如何為白板應用中的圖片元素實現與便利貼相同的完整功能，包括連接、選取、群組等特性。

## 目錄
1. [核心架構](#核心架構)
2. [圖片元素基本結構](#圖片元素基本結構)
3. [選取功能實作](#選取功能實作)
4. [連接功能實作](#連接功能實作)
5. [群組功能實作](#群組功能實作)
6. [批量操作實作](#批量操作實作)
7. [視覺回饋實作](#視覺回饋實作)

## 核心架構

### 1. 數據結構定義 (`types.ts`)

```typescript
export interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  filename?: string;
  uploadedAt?: Date;
  groupId?: string;  // 所屬群組 ID
}

export interface WhiteboardData {
  notes: StickyNote[];
  edges: Edge[];
  groups: Group[];
  images?: ImageElement[];  // 添加圖片陣列
  viewport?: ViewportState;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  noteIds: string[];
  imageIds?: string[];  // 支援圖片群組
}
```

### 2. 座標系統
- 使用邏輯座標系統（與便利貼相同）
- 所有元素位置使用絕對定位
- 縮放和平移通過容器層級的 CSS transform 實現

## 圖片元素基本結構

### ImageElement 組件 Props

```typescript
interface ImageElementProps {
  image: ImageElementType;
  isSelected: boolean;
  isSingleSelected?: boolean;
  isMultiSelected?: boolean;
  isPreviewSelected?: boolean;
  isConnecting?: boolean;
  isConnectTarget?: boolean;
  isHoveredForConnection?: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  onSelect: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number, height: number) => void;
  onDelete: () => void;
  onStartConnection?: () => void;
  onCreateGroup?: () => void;
  onUngroupImages?: () => void;
  onBatchMove?: (deltaX: number, deltaY: number) => void;
  onInitBatchDrag?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onStartDrag?: () => void;
  onEndDrag?: () => void;
  viewportToLogical?: (viewportX: number, viewportY: number) => { x: number; y: number };
}
```

## 選取功能實作

### 1. 單選和多選狀態管理

在 Whiteboard 組件中維護選取狀態：

```typescript
const [selectedImage, setSelectedImage] = useState<string | null>(null);
const [selectedImages, setSelectedImages] = useState<string[]>([]);
```

### 2. 選取互斥邏輯

點擊便利貼時清除圖片選取：
```typescript
onSelect={() => {
  setSelectedNote(note.id);
  setSelectedNotes([]);
  setSelectedImage(null);    // 清除圖片選取
  setSelectedImages([]);     // 清除圖片多選
  setSelectedEdge(null);
})
```

點擊圖片時清除便利貼選取：
```typescript
onSelect={() => {
  setSelectedImage(image.id);
  setSelectedImages([]);
  setSelectedNote(null);      // 清除便利貼選取
  setSelectedNotes([]);       // 清除便利貼多選
  setSelectedEdge(null);
})
```

### 3. 點擊畫布清除選取

在 `handleCanvasMouseDown` 中：
```typescript
// 檢查是否點擊圖片
if (target.closest('.image-element')) {
  return;
}

// 清除所有選取狀態
setSelectedNote(null);
setSelectedNotes([]);
setSelectedImage(null);
setSelectedImages([]);
setSelectedEdge(null);
setSelectedGroup(null);
```

### 4. 框選功能

更新框選邏輯以包含圖片：
```typescript
// 檢查圖片是否在選取框內
const imagesInSelection = whiteboardData.images?.filter(img => {
  const imgCenterX = img.x + img.width / 2;
  const imgCenterY = img.y + img.height / 2;
  return imgCenterX >= minX && imgCenterX <= maxX && 
         imgCenterY >= minY && imgCenterY <= maxY;
}) || [];

setSelectedImages(imagesInSelection.map(img => img.id));
```

### 5. 全選功能 (Ctrl+A)

```typescript
const selectAllNotes = useCallback(() => {
  const allNoteIds = whiteboardData.notes.map(note => note.id);
  const allImageIds = whiteboardData.images?.map(img => img.id) || [];
  setSelectedNotes(allNoteIds);
  setSelectedImages(allImageIds);
  setSelectedNote(null);
  setSelectedImage(null);
}, [whiteboardData.notes, whiteboardData.images]);
```

## 連接功能實作

### 1. 連接點 UI

在 ImageElement 中添加四個方向的連接點：

```typescript
{isSelected && isSingleSelected && !isResizing && (
  <>
    {/* 上方連接點 */}
    <div
      className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
      onMouseDown={(e) => {
        e.stopPropagation();
        onStartConnection?.();
      }}
      title="開始連接"
    >
      <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
    </div>
    {/* 右方、下方、左方連接點類似... */}
  </>
)}
```

### 2. Edge 組件支援圖片

更新 Edge 組件 props：
```typescript
interface EdgeComponentProps {
  edge: Edge;
  notes: StickyNote[];
  images?: ImageElement[];  // 添加圖片陣列
  // ...
}
```

查找連接的起點和終點：
```typescript
const fromNote = notes.find(note => note.id === edge.from);
const fromImage = images.find(img => img.id === edge.from);
const toNote = notes.find(note => note.id === edge.to);
const toImage = images.find(img => img.id === edge.to);

const fromElement = fromNote || fromImage;
const toElement = toNote || toImage;

if (!fromElement || !toElement) return null;

// 計算連線位置（使用統一的邏輯）
const fromX = fromElement.x + fromElement.width / 2;
const fromY = fromElement.y + fromElement.height / 2;
const toX = toElement.x + toElement.width / 2;
const toY = toElement.y + toElement.height / 2;
```

### 3. 連接完成邏輯

在 `handleCanvasMouseUp` 中處理連接到圖片：
```typescript
// 連接到圖片
if (hoveredImage && connectingFrom !== hoveredImage) {
  addEdge(connectingFrom, hoveredImage);
  setConnectingFrom(null);
  setHoveredImage(null);
  return;
}
```

## 群組功能實作

### 1. 創建群組

更新 `createGroup` 函數以支援圖片：

```typescript
const createGroup = useCallback((noteIds: string[], imageIds: string[] = []) => {
  if (noteIds.length + imageIds.length < 2) return null;
  
  const groupId = uuidv4();
  const newGroup: Group = {
    id: groupId,
    name: `群組 ${(whiteboardData.groups || []).length + 1}`,
    color: randomColor,
    createdAt: new Date(),
    noteIds: noteIds,
    imageIds: imageIds
  };

  updateWhiteboardData(prev => ({
    ...prev,
    groups: [...(prev.groups || []), newGroup],
    notes: prev.notes.map(note => 
      noteIds.includes(note.id) 
        ? { ...note, groupId }
        : note
    ),
    images: (prev.images || []).map(img => 
      imageIds.includes(img.id) 
        ? { ...img, groupId }
        : img
    )
  }));

  return groupId;
}, [whiteboardData, saveToHistory]);
```

### 2. 取消群組

```typescript
const ungroupNotes = useCallback((groupId: string) => {
  updateWhiteboardData(prev => ({
    ...prev,
    groups: (prev.groups || []).filter(g => g.id !== groupId),
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
}, [whiteboardData, saveToHistory]);
```

### 3. 群組邊界計算

```typescript
const getGroupBounds = useCallback((groupId: string) => {
  const groupNotes = getGroupNotes(groupId);
  const groupImages = whiteboardData.images?.filter(img => img.groupId === groupId) || [];
  
  if (groupNotes.length === 0 && groupImages.length === 0) return null;

  const allElements = [...groupNotes, ...groupImages];
  const minX = Math.min(...allElements.map(el => el.x));
  const minY = Math.min(...allElements.map(el => el.y));
  const maxX = Math.max(...allElements.map(el => el.x + el.width));
  const maxY = Math.max(...allElements.map(el => el.y + el.height));

  return {
    x: minX - 10,
    y: minY - 10,
    width: maxX - minX + 20,
    height: maxY - minY + 20
  };
}, [getGroupNotes, whiteboardData.groups, whiteboardData.images]);
```

## 批量操作實作

### 1. 初始化批量拖曳

```typescript
const initBatchDragPositions = useCallback(() => {
  const positions: {[key: string]: {x: number, y: number}} = {};
  
  // 加入選中的便利貼
  selectedNotes.forEach(noteId => {
    const note = whiteboardData.notes.find(n => n.id === noteId);
    if (note) {
      positions[noteId] = { x: note.x, y: note.y };
    }
  });
  
  // 加入選中的圖片
  selectedImages.forEach(imgId => {
    const img = whiteboardData.images?.find(i => i.id === imgId);
    if (img) {
      positions[imgId] = { x: img.x, y: img.y };
    }
  });
  
  if (Object.keys(positions).length > 0) {
    setBatchDragInitialPositions(positions);
  }
}, [selectedNotes, selectedImages, whiteboardData.notes, whiteboardData.images]);
```

### 2. 批量移動

```typescript
const handleBatchMove = useCallback((deltaX: number, deltaY: number) => {
  if (selectedNotes.length > 0 || selectedImages.length > 0) {
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
      }),
      images: (prev.images || []).map(img => {
        if (selectedImages.includes(img.id)) {
          const initialPos = batchDragInitialPositions[img.id];
          if (initialPos) {
            return {
              ...img,
              x: initialPos.x + deltaX,
              y: initialPos.y + deltaY
            };
          }
        }
        return img;
      })
    }));
  }
}, [selectedNotes, selectedImages, batchDragInitialPositions]);
```

### 3. 圖片組件中的批量拖曳邏輯

```typescript
// 在拖曳開始時
if (isMultiSelected && onInitBatchDrag) {
  onInitBatchDrag();
}

// 在拖曳移動時
if (isMultiSelected && onBatchMove) {
  onBatchMove(deltaX, deltaY);
} else {
  // 單獨移動圖片
  const newX = dragState.initialImageX + deltaX;
  const newY = dragState.initialImageY + deltaY;
  onUpdatePosition(newX, newY);
}
```

## 視覺回饋實作

### 1. 選取框樣式

```typescript
className={`w-full h-full rounded-lg overflow-hidden shadow-lg transition-all ${
  dragState?.isDragging
    ? 'cursor-grabbing border-2 border-blue-500 opacity-80'
    : isConnecting 
    ? `shadow-xl ring-2 ${
        isDarkMode ? 'border-green-400 ring-green-400/30' : 'border-green-500 ring-green-300'
      }` 
    : isHoveredForConnection
    ? `shadow-xl ring-2 cursor-pointer ${
        isDarkMode ? 'border-purple-900 ring-purple-900/20' : 'border-purple-500 ring-purple-300'
      }`
    : isSelected 
    ? `shadow-xl ring-2 ${
        isDarkMode ? 'ring-blue-400 border-blue-400' : 'ring-blue-500 border-blue-500'
      }` 
    : isPreviewSelected
    ? `shadow-lg ring-2 ring-dashed ${
        isDarkMode ? 'ring-blue-400 border-blue-400' : 'ring-blue-300 border-blue-300'
      }`
    : isDarkMode 
    ? 'ring-1 ring-gray-600'
    : 'ring-1 ring-gray-300'
}`}
```

### 2. 多選邊界框

計算並顯示包圍所有選中元素的邊界框：

```typescript
const getMultiSelectionBounds = useCallback(() => {
  const selectedNoteObjects = whiteboardData.notes.filter(note => selectedNotes.includes(note.id));
  const selectedImageObjects = whiteboardData.images?.filter(img => selectedImages.includes(img.id)) || [];
  const allSelectedObjects = [...selectedNoteObjects, ...selectedImageObjects];
  
  if (allSelectedObjects.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  allSelectedObjects.forEach(obj => {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  });

  const padding = 20;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding
  };
}, [whiteboardData.notes, whiteboardData.images, selectedNotes, selectedImages]);
```

在 SVG 層渲染邊界框：
```typescript
{(selectedNotes.length + selectedImages.length > 1) && (() => {
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
      strokeWidth={2}
      strokeDasharray="8,4"
      rx="12"
      style={{ pointerEvents: 'none' }}
    />
  );
})()}
```

## 重要注意事項

### 1. 類名標識
為圖片元素添加獨特的類名以便識別：
```typescript
className={`image-element absolute select-none ...`}
```

### 2. 事件處理順序
- 先處理拖曳初始化
- 再處理選取邏輯
- 最後處理視覺更新

### 3. 狀態同步
確保所有相關狀態同時更新：
- 選取狀態
- 批量拖曳位置
- 視覺回饋

### 4. 性能優化
- 使用 `useCallback` 避免不必要的重新渲染
- 批量更新狀態減少渲染次數
- 避免在渲染過程中進行複雜計算

## 測試檢查清單

- [ ] 單選圖片時，便利貼選取被清除
- [ ] 單選便利貼時，圖片選取被清除
- [ ] 點擊畫布空白處，所有選取被清除
- [ ] 框選可以同時選中便利貼和圖片
- [ ] Ctrl+A 可以選中所有元素
- [ ] 多選拖曳時所有選中元素一起移動
- [ ] 圖片可以與便利貼建立連接
- [ ] 圖片可以與圖片建立連接
- [ ] 圖片可以加入群組
- [ ] 群組拖曳時包含的圖片一起移動
- [ ] 多選時顯示邊界框
- [ ] 選取狀態有正確的視覺回饋

## 相關文件
- [白板架構文件](./WHITEBOARD_ARCHITECTURE.md)
- [項目說明文件](../CLAUDE.md)