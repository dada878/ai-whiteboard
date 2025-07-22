'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Group as GroupType } from '../types';

interface GroupComponentProps {
  group: GroupType;
  bounds: { x: number; y: number; width: number; height: number };
  isSelected: boolean;
  zoomLevel?: number;
  onSelect: () => void;
  onUpdateName: (name: string) => void;
  onUpdateColor: (color: string) => void;
  onUngroup: () => void;
  onDelete: () => void;
  onStartDrag?: (e: React.MouseEvent) => void;
}

const GROUP_COLORS = [
  { color: '#E3F2FD', name: '淺藍' },
  { color: '#F3E5F5', name: '淺紫' },
  { color: '#E8F5E8', name: '淺綠' },
  { color: '#FFF3E0', name: '淺橙' },
  { color: '#FCE4EC', name: '淺粉' },
  { color: '#E8EAF6', name: '淺靛' },
  { color: '#FFF9C4', name: '淺黃' },
  { color: '#EFEBE9', name: '淺棕' }
];

const GroupComponent: React.FC<GroupComponentProps> = ({
  group,
  bounds,
  isSelected,
  zoomLevel = 1,
  onSelect,
  onUpdateName,
  onUpdateColor,
  onUngroup,
  onDelete,
  onStartDrag
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(group.name);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
    setTempName(group.name);
  };

  const handleNameSave = () => {
    if (tempName.trim() && tempName !== group.name) {
      onUpdateName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setTempName(group.name);
      setIsEditingName(false);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
    onSelect();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isEditingName) {
      onSelect();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !isEditingName) { // 左鍵點擊且非編輯模式
      e.stopPropagation();
      onSelect();
      if (onStartDrag) {
        onStartDrag(e);
      }
    }
  };

  return (
    <>
      <g 
        style={{ cursor: 'move', pointerEvents: 'all' }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleRightClick}
      >
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={group.color}
          fillOpacity="0.5"
          stroke={isSelected ? "rgb(59, 130, 246)" : group.color}
          strokeWidth={isSelected ? "3" : "2"}
          strokeDasharray={isSelected ? "6,3" : "5,3"}
          rx="8"
          style={{ pointerEvents: 'all', cursor: 'move' }}
        />
        
        {/* 群組名稱 */}
        {isEditingName ? (
          <foreignObject
            x={bounds.x + 8}
            y={bounds.y - 28}
            width="250"
            height="28"
          >
            <input
              ref={nameInputRef}
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-0 text-base font-bold bg-white border border-gray-400 rounded"
              style={{
                fontSize: `${16 / zoomLevel}px`,
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'left top'
              }}
            />
          </foreignObject>
        ) : (
          <text
            x={bounds.x + 8}
            y={bounds.y - 8}
            fontSize="18"
            fill={isSelected ? "rgb(59, 130, 246)" : "#374151"}
            fillOpacity="1"
            fontWeight="700"
            style={{ cursor: 'text' }}
            onClick={handleNameClick}
          >
            {group.name}
          </text>
        )}
      </g>

      {/* 右鍵選單 */}
      {showContextMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="context-menu fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-48 backdrop-blur-sm"
            style={{
              left: Math.min(menuPosition.x + 10, window.innerWidth - 200),
              top: Math.min(menuPosition.y + 10, window.innerHeight - 300),
            }}
          >
            <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b border-gray-100 mb-1">
              群組操作
            </div>
            
            <button
              className="w-full px-4 py-2.5 text-left hover:bg-blue-50 text-sm flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => {
                setIsEditingName(true);
                setShowContextMenu(false);
              }}
            >
              <span className="text-base">✏️</span>
              <span>重新命名</span>
            </button>

            {/* 顏色選擇區域 */}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <div className="px-3 py-2">
                <div className="text-xs text-gray-500 mb-2">更換顏色</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {GROUP_COLORS.map((colorObj, index) => (
                    <button
                      key={index}
                      className="w-8 h-8 rounded border-2 hover:scale-110 transition-all shadow-sm hover:shadow-md"
                      style={{ 
                        backgroundColor: colorObj.color,
                        borderColor: group.color === colorObj.color ? 'rgb(59, 130, 246)' : '#D1D5DB'
                      }}
                      onClick={() => {
                        onUpdateColor(colorObj.color);
                        setShowContextMenu(false);
                      }}
                      title={colorObj.name}
                    >
                      {group.color === colorObj.color && (
                        <div className="flex items-center justify-center w-full h-full">
                          <span className="text-xs font-bold text-gray-700">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <hr className="my-1 border-gray-100" />
            
            <button
              className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 text-sm flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition-colors"
              onClick={() => {
                onUngroup();
                setShowContextMenu(false);
              }}
            >
              <span className="text-base">📂</span>
              <span>解散群組</span>
            </button>
            
            <button
              className="w-full px-4 py-2.5 text-left hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors"
              onClick={() => {
                onDelete();
                setShowContextMenu(false);
              }}
            >
              <span className="text-base">🗑️</span>
              <span>刪除群組</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default GroupComponent;