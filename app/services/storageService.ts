import { WhiteboardData, ViewportState } from '../types';

const STORAGE_KEY = 'thinkboard-data';
const STORAGE_VERSION = 'v1';

// Helper function to check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

export class StorageService {
  // 儲存白板資料到 localStorage
  static saveWhiteboardData(data: WhiteboardData, viewport?: ViewportState): void {
    if (!isBrowser()) {
      return;
    }
    
    try {
      const dataWithViewport = viewport ? { ...data, viewport } : data;
      const storageData = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        data: dataWithViewport
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    } catch (error) {
      console.error('Failed to save whiteboard data:', error);
    }
  }

  // 從 localStorage 載入白板資料
  static loadWhiteboardData(): WhiteboardData | null {
    if (!isBrowser()) {
      return null;
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsedData = JSON.parse(stored);
      
      // 檢查版本相容性
      if (parsedData.version !== STORAGE_VERSION) {
        console.warn('Storage version mismatch, clearing old data');
        this.clearWhiteboardData();
        return null;
      }

      // 確保資料結構完整
      const data = parsedData.data as WhiteboardData;
      return {
        notes: data.notes || [],
        edges: data.edges || [],
        groups: data.groups || [],
        viewport: data.viewport
      };
    } catch (error) {
      console.error('Failed to load whiteboard data:', error);
      return null;
    }
  }

  // 清除儲存的資料
  static clearWhiteboardData(): void {
    if (!isBrowser()) {
      return;
    }
    
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear whiteboard data:', error);
    }
  }

  // 取得最後儲存時間
  static getLastSaveTime(): Date | null {
    if (!isBrowser()) {
      return null;
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsedData = JSON.parse(stored);
      return new Date(parsedData.timestamp);
    } catch (error) {
      console.error('Failed to get last save time:', error);
      return null;
    }
  }
}