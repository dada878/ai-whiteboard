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
8. [右鍵選單實作](#右鍵選單實作)
9. [測試檢查清單](#測試檢查清單)

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
  onQuickConnect?: (direction: 'top' | 'right' | 'bottom' | 'left') => void;
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

### 3. 快速連接功能實作

圖片連接點支援兩種模式：
- **拖曳模式**：觸發自由連接，可以連接到任何元素
- **點擊模式**：快速在指定方向創建新便利貼並自動連接

#### 連接點事件處理

```typescript
onMouseDown={(e) => {
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  let isDragging = false;
  
  const handleMouseMove = (moveEvent: MouseEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    if (Math.hypot(dx, dy) > 5) {
      isDragging = true;
      onStartConnection?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };
  
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (!isDragging && onQuickConnect) {
      onQuickConnect('top'); // 根據連接點方向
    }
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}}
```

#### 快速連接處理函數

在 Whiteboard 組件中實作 `handleImageQuickConnect`：

```typescript
const handleImageQuickConnect = useCallback((imageId: string, direction: 'top' | 'right' | 'bottom' | 'left') => {
  const fromImage = whiteboardData.images?.find(img => img.id === imageId);
  if (!fromImage) return;
  
  // 計算起始圖片的中心點
  const fromX = fromImage.x + fromImage.width / 2;
  const fromY = fromImage.y + fromImage.height / 2;
  
  // 根據方向計算角度
  let angle = 0;
  switch (direction) {
    case 'top': angle = -Math.PI / 2; break;
    case 'right': angle = 0; break;
    case 'bottom': angle = Math.PI / 2; break;
    case 'left': angle = Math.PI; break;
  }
  
  // 新便利貼參數
  const newNoteWidth = 200;
  const newNoteHeight = 200;
  const gap = 15;
  const defaultDistance = 180;
  
  // 計算邊緣距離的函數
  const getDistanceToEdge = (width: number, height: number, angleToEdge: number) => {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    if (Math.abs(Math.cos(angleToEdge)) > Math.abs(Math.sin(angleToEdge))) {
      return halfWidth / Math.abs(Math.cos(angleToEdge));
    } else {
      return halfHeight / Math.abs(Math.sin(angleToEdge));
    }
  };
  
  // 計算總距離和新便利貼位置
  const fromEdgeDistance = getDistanceToEdge(fromImage.width, fromImage.height, angle);
  const toEdgeDistance = getDistanceToEdge(newNoteWidth, newNoteHeight, angle);
  const totalDistance = fromEdgeDistance + gap + defaultDistance + gap + toEdgeDistance;
  
  const newNoteCenterX = fromX + Math.cos(angle) * totalDistance;
  const newNoteCenterY = fromY + Math.sin(angle) * totalDistance;
  const newNoteX = newNoteCenterX - newNoteWidth / 2;
  const newNoteY = newNoteCenterY - newNoteHeight / 2;
  
  // 創建新便利貼
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
  
  // 更新數據並建立連接
  saveToHistory(whiteboardData);
  updateWhiteboardData(prev => ({
    ...prev,
    notes: [...prev.notes, newNote]
  }));
  addEdge(imageId, newNoteId);
  
  // 自動選中新便利貼
  setSelectedNote(newNoteId);
  setSelectedImage(null);
  setAutoEditNoteId(newNoteId);
}, [whiteboardData, saveToHistory, updateWhiteboardData, addEdge]);
```

#### 在圖片渲染中綁定快速連接

```typescript
<ImageElementComponent
  // ... 其他 props
  onQuickConnect={(direction) => handleImageQuickConnect(image.id, direction)}
/>
```

### 4. 連接完成邏輯

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

## 右鍵選單實作

### 1. 使用 Portal 渲染選單

為了避免位置問題，右鍵選單使用 React Portal 渲染到 document.body：

```typescript
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
        left: Math.min(contextMenuPosition.x + 10, window.innerWidth - 200),
        top: Math.min(contextMenuPosition.y + 10, window.innerHeight - 200),
      }}
    >
      {/* 選單內容 */}
    </div>
  </>,
  document.body
)}
```

### 2. 選單位置計算

確保選單不會超出視窗邊界：

```typescript
const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setShowContextMenu(true);
  setContextMenuPosition({ x: e.clientX, y: e.clientY });
  
  // 如果不是多選狀態或目前圖片未被選取，才執行選取
  if (!isMultiSelected || !isSelected) {
    onSelect();
  }
};
```

### 3. 選單樣式統一

確保與便利貼選單樣式一致：

```typescript
// 標題區域
<div className={`px-3 py-1 text-xs font-medium border-b mb-1 ${
  isDarkMode 
    ? 'text-gray-400 border-gray-700' 
    : 'text-gray-500 border-gray-100'
}`}>
  {isMultiSelected ? '批量操作' : '圖片操作'}
</div>

// 選單項目
<button
  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
    isDarkMode 
      ? 'text-gray-300 hover:bg-gray-700/50' 
      : 'text-gray-700 hover:bg-gray-50'
  }`}
>
  <span className="text-base">📋</span>
  <span>複製圖片連結</span>
</button>
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

### 基本選取功能
- [ ] 單選圖片時，便利貼選取被清除
- [ ] 單選便利貼時，圖片選取被清除
- [ ] 點擊畫布空白處，所有選取被清除
- [ ] 框選可以同時選中便利貼和圖片
- [ ] Ctrl+A 可以選中所有元素

### 拖曳和移動功能
- [ ] 多選拖曳時所有選中元素一起移動
- [ ] 單個圖片拖曳功能正常
- [ ] 圖片調整大小功能正常
- [ ] 多選時顯示邊界框

### 連接功能
- [ ] 圖片可以與便利貼建立連接（拖曳模式）
- [ ] 圖片可以與圖片建立連接（拖曳模式）
- [ ] 點擊圖片連接點可以快速創建便利貼
- [ ] 快速連接的便利貼位置正確（上、下、左、右四個方向）
- [ ] 快速連接後自動建立連線
- [ ] 快速連接後自動選中新便利貼並進入編輯模式
- [ ] 拖曳連接點超過5px後進入自由連接模式

### 群組功能
- [ ] 圖片可以加入群組
- [ ] 群組拖曳時包含的圖片一起移動
- [ ] 圖片可以與便利貼混合群組
- [ ] 取消群組功能正常

### 視覺回饋
- [ ] 選取狀態有正確的視覺回饋
- [ ] 連接模式時圖片有正確的視覺提示
- [ ] 懸停連接目標時有正確的視覺回饋
- [ ] 右鍵選單位置正確且功能完整
- [ ] 右鍵時自動選中圖片

### 其他功能
- [ ] 圖片永久陰影效果
- [ ] 不顯示檔案名稱
- [ ] 支援Firebase Storage上傳（已登入用戶）
- [ ] 支援base64本地存儲（訪客模式）

## 最新更新記錄

### 2024 年更新：圖片快速連接功能

#### 問題描述
圖片的連接點原本只支援拖曳連接模式，缺少便利貼的快速連接功能（點擊連接點直接創建新便利貼）。

#### 解決方案
1. **更新 ImageElement Props 接口**
   - 添加 `onQuickConnect?: (direction: 'top' | 'right' | 'bottom' | 'left') => void`

2. **實現連接點雙模式支援**
   - 拖曳超過 5px：觸發 `onStartConnection()` 進入自由連接模式
   - 點擊不拖曳：觸發 `onQuickConnect(direction)` 快速創建便利貼

3. **新增 handleImageQuickConnect 函數**
   - 計算圖片中心點和目標方向
   - 使用與便利貼相同的距離計算邏輯
   - 創建 200x200 的黃色便利貼
   - 自動建立連接並進入編輯模式

4. **更新所有四個連接點的事件處理**
   - 統一使用滑鼠事件監聽模式
   - 支援方向感知的快速連接

#### 修改的文件
- `app/components/ImageElement.tsx`: 更新連接點邏輯
- `app/components/Whiteboard.tsx`: 新增快速連接處理函數
- `docs/IMAGE_FEATURE_IMPLEMENTATION.md`: 更新文件

#### 測試要點
- ✅ 點擊連接點創建便利貼位置正確
- ✅ 拖曳連接點進入自由連接模式
- ✅ 四個方向（上下左右）都正常工作
- ✅ 自動選中新便利貼並進入編輯模式

## 相關文件
- [白板架構文件](./WHITEBOARD_ARCHITECTURE.md)
- [項目說明文件](../CLAUDE.md)