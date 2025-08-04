'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  color: string;
}

interface NotesProps {
  isOpen: boolean;
  onClose: () => void;
}

const NOTE_COLORS = [
  { color: '#FFF9C4', name: '黃色' },
  { color: '#F8BBD0', name: '粉色' },
  { color: '#C5E1A5', name: '綠色' },
  { color: '#B3E5FC', name: '藍色' },
  { color: '#D1C4E9', name: '紫色' },
  { color: '#FFCCBC', name: '橙色' },
];

const Notes: React.FC<NotesProps> = ({ isOpen, onClose }) => {
  const { isDarkMode } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 從 localStorage 載入筆記
  useEffect(() => {
    const savedNotes = localStorage.getItem('whiteboard-notes');
    if (savedNotes) {
      const parsedNotes = JSON.parse(savedNotes);
      setNotes(parsedNotes.map((note: Note) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt)
      })));
    }
  }, []);

  // 儲存筆記到 localStorage
  useEffect(() => {
    localStorage.setItem('whiteboard-notes', JSON.stringify(notes));
  }, [notes]);

  const createNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: '新筆記',
      content: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      color: NOTE_COLORS[0].color
    };
    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
    setIsEditing(true);
    setEditTitle(newNote.title);
    setEditContent(newNote.content);
  };

  const updateNote = () => {
    if (!selectedNote) return;

    setNotes(notes.map(note => 
      note.id === selectedNote.id
        ? {
            ...note,
            title: editTitle || '無標題',
            content: editContent,
            updatedAt: new Date()
          }
        : note
    ));
    setIsEditing(false);
  };

  const deleteNote = (noteId: string) => {
    setNotes(notes.filter(note => note.id !== noteId));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setIsEditing(false);
    }
  };

  const changeNoteColor = (noteId: string, color: string) => {
    setNotes(notes.map(note => 
      note.id === noteId ? { ...note, color } : note
    ));
    if (selectedNote?.id === noteId) {
      setSelectedNote({ ...selectedNote, color });
    }
  };

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? '剛剛' : `${minutes} 分鐘前`;
      }
      return `${hours} 小時前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return date.toLocaleDateString('zh-TW');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* 筆記面板 */}
      <div className={`relative ml-auto w-full max-w-4xl shadow-2xl flex ${
        isDarkMode ? 'bg-dark-bg' : 'bg-white'
      }`}>
        {/* 左側列表 */}
        <div className={`w-80 border-r flex flex-col ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          {/* 標題和新增按鈕 */}
          <div className={`p-4 border-b ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-xl font-bold ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>我的筆記</h2>
              <button
                onClick={createNewNote}
                className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  isDarkMode 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                + 新增筆記
              </button>
            </div>
            
            {/* 搜尋框 */}
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋筆記..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
          
          {/* 筆記列表 */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <div className={`p-8 text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {searchTerm ? '找不到符合的筆記' : '尚無筆記，點擊上方按鈕新增'}
              </div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => {
                    setSelectedNote(note);
                    setIsEditing(false);
                    setEditTitle(note.title);
                    setEditContent(note.content);
                  }}
                  className={`p-4 border-b cursor-pointer transition-colors ${
                    isDarkMode
                      ? `border-gray-600 ${
                          selectedNote?.id === note.id ? 'bg-blue-900/20' : 'hover:bg-dark-bg-tertiary'
                        }`
                      : `border-gray-100 ${
                          selectedNote?.id === note.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium truncate ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>{note.title}</h3>
                      <p className={`text-sm mt-1 line-clamp-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>{note.content || '無內容'}</p>
                      <p className={`text-xs mt-2 ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}>{formatDate(note.updatedAt)}</p>
                    </div>
                    <div 
                      className="ml-2 w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: note.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* 右側內容區 */}
        <div className="flex-1 flex flex-col">
          {selectedNote ? (
            <>
              {/* 筆記標題和操作 */}
              <div className={`p-4 border-b flex items-center justify-between ${
                isDarkMode ? 'border-gray-600' : 'border-gray-200'
              }`}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={`flex-1 text-xl font-bold bg-transparent border-b-2 border-blue-500 outline-none ${
                      isDarkMode ? 'text-gray-200' : ''
                    }`}
                    placeholder="輸入標題..."
                  />
                ) : (
                  <h2 className={`text-xl font-bold ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>{selectedNote.title}</h2>
                )}
                
                <div className="flex items-center gap-2 ml-4">
                  {/* 顏色選擇 */}
                  <div className="flex gap-1">
                    {NOTE_COLORS.map(({ color, name }) => (
                      <button
                        key={color}
                        onClick={() => changeNoteColor(selectedNote.id, color)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          selectedNote.color === color 
                            ? 'border-gray-600 scale-110' 
                            : 'border-gray-300 hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                        title={name}
                      />
                    ))}
                  </div>
                  
                  {isEditing ? (
                    <>
                      <button
                        onClick={updateNote}
                        className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          isDarkMode 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        儲存
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditTitle(selectedNote.title);
                          setEditContent(selectedNote.content);
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          isDarkMode 
                            ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' 
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className={`p-2 rounded-lg transition-colors ${
                          isDarkMode 
                            ? 'text-gray-400 hover:bg-dark-bg-tertiary' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="編輯"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('確定要刪除這個筆記嗎？')) {
                            deleteNote(selectedNote.id);
                          }
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          isDarkMode 
                            ? 'text-red-400 hover:bg-red-900/20' 
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                        title="刪除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* 筆記內容 */}
              <div className="flex-1 p-4 overflow-y-auto" style={{ 
                backgroundColor: isDarkMode 
                  ? selectedNote.color + '10' 
                  : selectedNote.color + '20' 
              }}>
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className={`w-full h-full p-4 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-dark-bg-secondary border-gray-500 text-gray-200' 
                        : 'bg-white border-gray-300'
                    }`}
                    placeholder="開始寫筆記..."
                  />
                ) : (
                  <div className={`whitespace-pre-wrap min-h-full p-4 rounded-lg ${
                    isDarkMode 
                      ? 'text-gray-200 bg-dark-bg-secondary' 
                      : 'text-gray-800 bg-white'
                  }`}>
                    {selectedNote.content || <span className={isDarkMode ? "text-gray-500" : "text-gray-400"}>點擊編輯按鈕開始寫筆記...</span>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>選擇或新增一個筆記</p>
              </div>
            </div>
          )}
        </div>
        
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
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
    </div>,
    document.body
  );
};

export default Notes;