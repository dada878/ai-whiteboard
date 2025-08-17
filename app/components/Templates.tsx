'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { StickyNote, Edge, Group } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  preview: string;
  data: {
    notes: Partial<StickyNote>[];
    edges: Partial<Edge>[];
    groups?: Partial<Group>[];
  };
}

interface TemplatesProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: Template) => void;
}

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'planning', name: '企劃規劃' },
  { id: 'brainstorm', name: '腦力激盪' },
  { id: 'project', name: '專案管理' },
  { id: 'education', name: '教育學習' },
  { id: 'business', name: '商業分析' },
];

const TEMPLATES: Template[] = [
  {
    id: 'brainstorm-basic',
    name: '基礎腦力激盪',
    description: '適合快速發想和收集想法',
    category: 'brainstorm',
    preview: '🧠',
    data: {
      notes: [
        { content: '主題', x: 400, y: 300, width: 150, height: 100, color: '#FEF3C7' },
        { content: '想法 1', x: 200, y: 200, width: 120, height: 80, color: '#DBEAFE' },
        { content: '想法 2', x: 600, y: 200, width: 120, height: 80, color: '#DBEAFE' },
        { content: '想法 3', x: 200, y: 400, width: 120, height: 80, color: '#DBEAFE' },
        { content: '想法 4', x: 600, y: 400, width: 120, height: 80, color: '#DBEAFE' },
      ],
      edges: []
    }
  },
  {
    id: 'swot-analysis',
    name: 'SWOT 分析',
    description: '優勢、劣勢、機會、威脅分析',
    category: 'business',
    preview: '📊',
    data: {
      notes: [
        { content: 'SWOT 分析', x: 400, y: 100, width: 200, height: 60, color: '#FEF3C7' },
        { content: '優勢 Strengths', x: 200, y: 200, width: 150, height: 60, color: '#D1FAE5' },
        { content: '劣勢 Weaknesses', x: 600, y: 200, width: 150, height: 60, color: '#FECACA' },
        { content: '機會 Opportunities', x: 200, y: 400, width: 150, height: 60, color: '#DBEAFE' },
        { content: '威脅 Threats', x: 600, y: 400, width: 150, height: 60, color: '#FED7AA' },
      ],
      edges: [],
      groups: [
        { 
          id: 'swot-group',
          name: 'SWOT',
          noteIds: [],
          color: '#F3F4F6',
          createdAt: new Date()
        }
      ]
    }
  },
  {
    id: 'mind-map',
    name: '心智圖',
    description: '從中心概念向外擴散的思維導圖',
    category: 'brainstorm',
    preview: '🗺️',
    data: {
      notes: [
        { content: '中心概念', x: 400, y: 300, width: 150, height: 100, color: '#FEF3C7' },
        { content: '分支 1', x: 250, y: 200, width: 100, height: 60, color: '#FCE7F3' },
        { content: '分支 2', x: 550, y: 200, width: 100, height: 60, color: '#FCE7F3' },
        { content: '分支 3', x: 250, y: 400, width: 100, height: 60, color: '#FCE7F3' },
        { content: '分支 4', x: 550, y: 400, width: 100, height: 60, color: '#FCE7F3' },
        { content: '子分支 1-1', x: 150, y: 150, width: 80, height: 50, color: '#EDE9FE' },
        { content: '子分支 1-2', x: 150, y: 250, width: 80, height: 50, color: '#EDE9FE' },
      ],
      edges: []
    }
  },
  {
    id: 'kanban-board',
    name: '看板',
    description: '待辦、進行中、已完成的任務管理',
    category: 'project',
    preview: '📋',
    data: {
      notes: [
        { content: '待辦', x: 200, y: 100, width: 150, height: 60, color: '#FECACA' },
        { content: '進行中', x: 400, y: 100, width: 150, height: 60, color: '#FEF3C7' },
        { content: '已完成', x: 600, y: 100, width: 150, height: 60, color: '#D1FAE5' },
      ],
      edges: [],
      groups: [
        { 
          id: 'todo-group',
          name: '待辦事項',
          noteIds: [],
          color: '#FEE2E2',
          createdAt: new Date()
        },
        { 
          id: 'doing-group',
          name: '進行中',
          noteIds: [],
          color: '#FEF9C3',
          createdAt: new Date()
        },
        { 
          id: 'done-group',
          name: '已完成',
          noteIds: [],
          color: '#DCFCE7',
          createdAt: new Date()
        }
      ]
    }
  },
  {
    id: 'user-journey',
    name: '使用者旅程圖',
    description: '追蹤使用者的體驗流程',
    category: 'business',
    preview: '🚶',
    data: {
      notes: [
        { content: '發現', x: 150, y: 300, width: 100, height: 80, color: '#DBEAFE' },
        { content: '研究', x: 300, y: 300, width: 100, height: 80, color: '#DBEAFE' },
        { content: '決策', x: 450, y: 300, width: 100, height: 80, color: '#DBEAFE' },
        { content: '購買', x: 600, y: 300, width: 100, height: 80, color: '#DBEAFE' },
        { content: '使用', x: 750, y: 300, width: 100, height: 80, color: '#DBEAFE' },
        { content: '情緒高峰', x: 450, y: 200, width: 120, height: 60, color: '#D1FAE5' },
        { content: '痛點', x: 300, y: 400, width: 120, height: 60, color: '#FECACA' },
      ],
      edges: []
    }
  },
  {
    id: 'meeting-agenda',
    name: '會議議程',
    description: '組織結構化的會議討論',
    category: 'planning',
    preview: '📅',
    data: {
      notes: [
        { content: '會議主題', x: 400, y: 100, width: 200, height: 80, color: '#FEF3C7' },
        { content: '1. 開場介紹', x: 200, y: 250, width: 150, height: 60, color: '#DBEAFE' },
        { content: '2. 議題討論', x: 400, y: 250, width: 150, height: 60, color: '#DBEAFE' },
        { content: '3. 行動項目', x: 600, y: 250, width: 150, height: 60, color: '#DBEAFE' },
        { content: '決議事項', x: 300, y: 400, width: 150, height: 60, color: '#D1FAE5' },
        { content: '待辦事項', x: 500, y: 400, width: 150, height: 60, color: '#FED7AA' },
      ],
      edges: []
    }
  },
  {
    id: 'pros-cons',
    name: '優缺點分析',
    description: '評估決策的正反面',
    category: 'planning',
    preview: '⚖️',
    data: {
      notes: [
        { content: '決策主題', x: 400, y: 100, width: 200, height: 80, color: '#FEF3C7' },
        { content: '優點 ✅', x: 250, y: 250, width: 150, height: 60, color: '#D1FAE5' },
        { content: '缺點 ❌', x: 550, y: 250, width: 150, height: 60, color: '#FECACA' },
      ],
      edges: [],
      groups: [
        { 
          id: 'pros-group',
          name: '優點',
          noteIds: [],
          color: '#DCFCE7',
          createdAt: new Date()
        },
        { 
          id: 'cons-group',
          name: '缺點',
          noteIds: [],
          color: '#FEE2E2',
          createdAt: new Date()
        }
      ]
    }
  },
  {
    id: 'cornell-notes',
    name: '康乃爾筆記法',
    description: '系統化的筆記記錄方式',
    category: 'education',
    preview: '📝',
    data: {
      notes: [
        { content: '主題', x: 400, y: 50, width: 300, height: 60, color: '#FEF3C7' },
        { content: '關鍵字/問題', x: 150, y: 200, width: 150, height: 300, color: '#FCE7F3' },
        { content: '筆記內容', x: 450, y: 200, width: 300, height: 300, color: '#DBEAFE' },
        { content: '總結', x: 400, y: 550, width: 400, height: 100, color: '#D1FAE5' },
      ],
      edges: []
    }
  }
];

const Templates: React.FC<TemplatesProps> = ({ isOpen, onClose, onApplyTemplate }) => {
  const { isDarkMode } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = TEMPLATES.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 範本面板 */}
      <div className={`relative rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden ${
        isDarkMode ? 'bg-dark-bg' : 'bg-white'
      }`}>
        {/* 標題列 */}
        <div className={`px-6 py-4 border-b ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-bold ${
              isDarkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>選擇範本</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-dark-bg-tertiary' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* 搜尋框 */}
          <div className="mt-4 relative">
            <input
              type="text"
              placeholder="搜尋範本..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-dark-bg-tertiary border-gray-500 text-gray-200' 
                  : 'border-gray-300'
              }`}
            />
            <svg 
              className="absolute right-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        {/* 內容區 */}
        <div className="flex h-[calc(80vh-140px)]">
          {/* 側邊分類 */}
          <div className={`w-48 p-4 border-r ${
            isDarkMode 
              ? 'bg-dark-bg-secondary border-gray-600' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <h3 className={`text-sm font-semibold mb-3 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>分類</h3>
            <div className="space-y-1">
              {TEMPLATE_CATEGORIES.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full px-3 py-2 text-left rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? isDarkMode
                        ? 'bg-blue-900/30 text-blue-400 font-medium'
                        : 'bg-blue-100 text-blue-700 font-medium'
                      : isDarkMode
                        ? 'hover:bg-dark-bg-tertiary text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* 範本列表 */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className={`border-2 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer group ${
                    isDarkMode 
                      ? 'bg-dark-bg-secondary border-gray-600 hover:border-blue-500' 
                      : 'bg-white border-gray-200 hover:border-blue-400'
                  }`}
                  onClick={() => {
                    onApplyTemplate(template);
                    onClose();
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-4xl">{template.preview}</div>
                    <div className="flex-1">
                      <h4 className={`font-semibold ${
                        isDarkMode 
                          ? 'text-gray-200 group-hover:text-blue-400' 
                          : 'text-gray-800 group-hover:text-blue-600'
                      }`}>
                        {template.name}
                      </h4>
                      <p className={`text-sm mt-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {template.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* 預覽 */}
                  <div className={`mt-3 h-32 rounded-lg relative overflow-hidden ${
                    isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
                  }`}>
                    <div className="absolute inset-0 p-2">
                      {/* 簡單的視覺化預覽 */}
                      {template.data.notes.slice(0, 5).map((note, idx) => (
                        <div
                          key={idx}
                          className="absolute w-8 h-6 rounded opacity-60"
                          style={{
                            backgroundColor: note.color,
                            left: `${(note.x! / 8) % 80}%`,
                            top: `${(note.y! / 6) % 70}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {template.data.notes.length} 個便利貼
                    </span>
                    <span className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      點擊套用 →
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredTemplates.length === 0 && (
              <div className={`text-center py-12 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <svg className={`w-16 h-16 mx-auto mb-4 ${
                  isDarkMode ? 'text-gray-600' : 'text-gray-300'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h-.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>找不到符合的範本</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Templates;