# 白板架構與開發指南

## 目錄
1. [白板運作原理](#白板運作原理)
2. [座標系統](#座標系統)
3. [縮放與平移機制](#縮放與平移機制)
4. [元素拖曳實作](#元素拖曳實作)
5. [建立新元素的步驟](#建立新元素的步驟)
6. [開發注意事項](#開發注意事項)
7. [常見問題與解決方案](#常見問題與解決方案)

## 白板運作原理

### 整體架構
白板使用「無限畫布」概念，透過一個超大的容器（50000px × 50000px）來模擬無限空間。所有的縮放和平移都是透過 CSS transform 在容器層級統一處理。

```jsx
<div 
  ref={containerRef}
  style={{
    width: '50000px',
    height: '50000px',
    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
    transformOrigin: '0 0',
  }}
>
  {/* 所有元素都放在這個容器內 */}
</div>
```

### 核心概念
1. **邏輯座標 vs 視口座標**
   - 邏輯座標：元素在白板上的實際位置（不受縮放影響）
   - 視口座標：元素在螢幕上的顯示位置（受縮放和平移影響）

2. **統一的 Transform 處理**
   - 縮放和平移都在容器層級處理
   - 個別元素只需要處理自己的邏輯位置

## 座標系統

### 座標轉換函數
```typescript
// 將視口座標（滑鼠位置）轉換為邏輯座標
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
```

### 重要原則
- **元素定位使用邏輯座標**：直接設定 `left: ${element.x}px, top: ${element.y}px`
- **不要在元素上單獨處理縮放**：縮放由容器統一處理
- **拖曳計算需要座標轉換**：滑鼠位置需要轉換為邏輯座標

## 縮放與平移機制

### 縮放控制
```typescript
// 縮放等級範圍
const MIN_ZOOM = 0.1;  // 最小 10%
const MAX_ZOOM = 2;    // 最大 200%

// 滑鼠滾輪縮放
const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * delta));
    setZoomLevel(newZoom);
  }
};
```

### 平移控制
```typescript
// 右鍵拖曳或 Ctrl+拖曳進行畫布平移
const handleCanvasMouseDown = (event: React.MouseEvent) => {
  if (event.button === 2 || event.ctrlKey || event.metaKey) {
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    setScrollStart({ 
      left: panOffset.x, 
      top: panOffset.y 
    });
  }
};
```

## 元素拖曳實作

### 標準拖曳模式（參考 StickyNote 實作）

```typescript
// 1. 定義拖曳狀態
const [dragState, setDragState] = useState<{
  isDragging: boolean;
  startX: number;
  startY: number;
  initialElementX: number;
  initialElementY: number;
} | null>(null);

// 2. 處理滑鼠按下
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button !== 0) return; // 只處理左鍵
  if (!viewportToLogical) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  setDragState({
    isDragging: false,  // 初始不是拖曳，等待移動閾值
    startX: e.clientX,
    startY: e.clientY,
    initialElementX: element.x,
    initialElementY: element.y
  });
  
  onSelect(); // 選中元素
};

// 3. 全域滑鼠移動處理
useEffect(() => {
  if (!dragState || !viewportToLogical) return;

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!dragState.isDragging) {
      // 檢查是否超過拖曳閾值（5px）
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.hypot(dx, dy) > 5) {
        setDragState(prev => prev ? { ...prev, isDragging: true } : null);
        onStartDrag?.();
      }
      return;
    }

    // 計算位移
    const currentPos = viewportToLogical(e.clientX, e.clientY);
    const startPos = viewportToLogical(dragState.startX, dragState.startY);
    
    const deltaX = currentPos.x - startPos.x;
    const deltaY = currentPos.y - startPos.y;
    
    // 更新元素位置
    const newX = dragState.initialElementX + deltaX;
    const newY = dragState.initialElementY + deltaY;
    onUpdatePosition(newX, newY);
  };

  const handleGlobalMouseUp = () => {
    const wasDragging = dragState.isDragging;
    setDragState(null);
    if (wasDragging) onEndDrag?.();
  };

  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', handleGlobalMouseUp);
  
  return () => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  };
}, [dragState, viewportToLogical, onUpdatePosition]);
```

## 建立新元素的步驟

### 1. 定義類型 (types.ts)
```typescript
export interface NewElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // 其他屬性...
}

export interface WhiteboardData {
  notes: StickyNote[];
  edges: Edge[];
  groups: Group[];
  images: ImageElement[];
  newElements: NewElement[];  // 新增
}
```

### 2. 建立元素組件
```typescript
// components/NewElement.tsx
interface NewElementProps {
  element: NewElement;
  isSelected: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  viewportToLogical?: (viewportX: number, viewportY: number) => { x: number; y: number };
  onSelect: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number, height: number) => void;
  onDelete: () => void;
  onStartDrag?: () => void;
  onEndDrag?: () => void;
}

const NewElementComponent: React.FC<NewElementProps> = ({ ... }) => {
  // 重要：不要使用 react-draggable 或其他拖曳庫
  // 使用上面的標準拖曳模式
  
  return (
    <div
      style={{
        // 使用邏輯座標，不要乘以 zoomLevel 或加上 panOffset
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        position: 'absolute',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 元素內容 */}
    </div>
  );
};
```

### 3. 在 Whiteboard 中加入管理函數
```typescript
// 新增元素
const addNewElement = useCallback((x: number, y: number) => {
  saveToHistory(whiteboardData);
  
  const newElement: NewElement = {
    id: uuidv4(),
    x,
    y,
    width: 200,
    height: 200,
  };
  
  updateWhiteboardData(prev => ({
    ...prev,
    newElements: [...(prev.newElements || []), newElement]
  }));
  
  setSelectedNewElement(newElement.id);
}, [whiteboardData, saveToHistory]);

// 更新位置
const updateNewElementPosition = useCallback((id: string, x: number, y: number) => {
  updateWhiteboardData(prev => ({
    ...prev,
    newElements: (prev.newElements || []).map(elem => 
      elem.id === id ? { ...elem, x, y } : elem
    )
  }));
}, []);

// 刪除元素
const deleteNewElement = useCallback((id: string) => {
  saveToHistory(whiteboardData);
  updateWhiteboardData(prev => ({
    ...prev,
    newElements: (prev.newElements || []).filter(elem => elem.id !== id)
  }));
}, [whiteboardData, saveToHistory]);
```

### 4. 在渲染區域加入元素
```jsx
{/* 在容器內渲染新元素 */}
{(whiteboardData.newElements || []).map(element => (
  <NewElementComponent
    key={element.id}
    element={element}
    isSelected={selectedNewElement === element.id}
    zoomLevel={zoomLevel}
    panOffset={panOffset}
    viewportToLogical={viewportToLogical}
    onSelect={() => {
      setSelectedNewElement(element.id);
      // 清除其他選擇
      setSelectedNote(null);
      setSelectedImage(null);
    }}
    onUpdatePosition={(x, y) => updateNewElementPosition(element.id, x, y)}
    onUpdateSize={(w, h) => updateNewElementSize(element.id, w, h)}
    onDelete={() => deleteNewElement(element.id)}
    onStartDrag={() => setIsDraggingNote(true)}
    onEndDrag={() => setIsDraggingNote(false)}
  />
))}
```

### 5. 更新儲存和載入邏輯
```typescript
// ProjectService.loadProjectData
return {
  notes: data.notes || [],
  edges: data.edges || [],
  groups: data.groups || [],
  images: data.images || [],
  newElements: data.newElements || [],  // 新增
  viewport: data.viewport
};
```

## 開發注意事項

### ❌ 常見錯誤

1. **在元素上處理縮放**
```typescript
// 錯誤：不要這樣做
style={{
  left: `${element.x * zoomLevel + panOffset.x}px`,
  top: `${element.y * zoomLevel + panOffset.y}px`,
}}
```

2. **使用第三方拖曳庫**
```typescript
// 錯誤：react-draggable 不適合這個架構
import Draggable from 'react-draggable';
```

3. **忘記座標轉換**
```typescript
// 錯誤：直接使用滑鼠座標
const newX = e.clientX;
const newY = e.clientY;
```

### ✅ 最佳實踐

1. **使用邏輯座標定位**
```typescript
// 正確
style={{
  left: `${element.x}px`,
  top: `${element.y}px`,
}}
```

2. **拖曳時轉換座標**
```typescript
// 正確
const currentPos = viewportToLogical(e.clientX, e.clientY);
const startPos = viewportToLogical(dragState.startX, dragState.startY);
```

3. **初始化時包含所有陣列**
```typescript
// 正確
const emptyData: WhiteboardData = {
  notes: [],
  edges: [],
  groups: [],
  images: [],
  newElements: []  // 不要忘記新類型
};
```

4. **調整大小時考慮縮放**
```typescript
// 正確：將視窗位移轉換為邏輯位移
const logicalDeltaX = deltaX / zoomLevel;
const logicalDeltaY = deltaY / zoomLevel;
```

## 常見問題與解決方案

### Q1: 元素在縮放時位置跑掉
**原因**：在元素上單獨處理了縮放
**解決**：移除元素上的縮放計算，只使用邏輯座標

### Q2: 拖曳時元素飛走
**原因**：座標系統混亂，沒有正確轉換
**解決**：使用 viewportToLogical 函數轉換座標

### Q3: 新元素不顯示
**原因**：忘記在 WhiteboardData 中初始化陣列
**解決**：確保所有地方都有初始化空陣列

### Q4: 元素無法儲存
**原因**：ProjectService 沒有處理新的資料類型
**解決**：更新 loadProjectData 和 saveProjectData

### Q5: 拖曳反應遲鈍
**原因**：使用了第三方拖曳庫
**解決**：使用原生滑鼠事件處理

## 除錯技巧

1. **加入座標日誌**
```typescript
console.log('Mouse position:', { clientX: e.clientX, clientY: e.clientY });
console.log('Logical position:', viewportToLogical(e.clientX, e.clientY));
console.log('Element position:', { x: element.x, y: element.y });
```

2. **檢查容器 Transform**
```typescript
console.log('Container transform:', {
  zoom: zoomLevel,
  pan: panOffset
});
```

3. **驗證資料結構**
```typescript
console.log('WhiteboardData:', {
  notes: whiteboardData.notes?.length || 0,
  images: whiteboardData.images?.length || 0,
  // ...
});
```

## 總結

白板系統的核心是：
1. 使用邏輯座標系統
2. 容器統一處理縮放和平移
3. 元素只管理自己的邏輯位置
4. 拖曳時正確轉換座標

遵循這些原則，新元素的開發會變得簡單且一致。