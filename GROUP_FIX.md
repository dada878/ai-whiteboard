# 群組創建修復

## 問題
當框選群組和便利貼時，群組內的便利貼會被重複選中，導致創建父群組時，原有群組變成空群組而消失。

## 解決方案
在創建群組前，需要過濾掉已經在選中群組內的便利貼和圖片。

## 修改位置
檔案：`app/components/Whiteboard.tsx`
位置：第 1387 行附近，在 `console.log(\`GROUP_SELECT: selectedImages: [${selectedImages.join(',')}\]\`);` 之後

## 要插入的程式碼

```typescript
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
```

## 要修改的地方

### 1. 修改情況1的條件判斷（約第 1390 行）
原本：
```typescript
if (allSelectedGroups.length >= 1 && (allSelectedGroups.length >= 2 || selectedNotes.length > 0 || selectedImages.length > 0)) {
```

改為：
```typescript
if (allSelectedGroups.length >= 1 && (allSelectedGroups.length >= 2 || independentNotes.length > 0 || independentImages.length > 0)) {
```

### 2. 修改情況1中的群組創建（約第 1394 行）
原本：
```typescript
if (selectedNotes.length > 0 || selectedImages.length > 0) {
  console.log(`GROUP_SELECT: Creating group for notes/images first`);
  const newGroupId = createGroup(selectedNotes, selectedImages);
```

改為：
```typescript
if (independentNotes.length > 0 || independentImages.length > 0) {
  console.log(`GROUP_SELECT: Creating group for independent notes/images first`);
  const newGroupId = createGroup(independentNotes, independentImages);
```

## 原理說明
1. 當框選時，群組和群組內的便利貼都會被選中
2. 修復後會先收集所有選中群組內的便利貼ID
3. 過濾出真正獨立的便利貼（不在任何選中群組內）
4. 只為這些獨立的便利貼創建新群組
5. 這樣原有的群組保持完整，不會因為便利貼被移走而消失