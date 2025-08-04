import { Project, ProjectWithData, WhiteboardData, ViewportState } from '../types';
import { v4 as uuidv4 } from 'uuid';

const PROJECTS_KEY = 'ai-whiteboard-projects';
const CURRENT_PROJECT_KEY = 'ai-whiteboard-current-project';
const PROJECT_DATA_PREFIX = 'ai-whiteboard-project-data-';
const STORAGE_VERSION = 'v2';

// Helper function to check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

export class ProjectService {
  // 獲取所有專案列表
  static getAllProjects(): Project[] {
    if (!isBrowser()) {
      return [];
    }
    
    try {
      const stored = localStorage.getItem(PROJECTS_KEY);
      if (!stored) return [];
      
      const projects = JSON.parse(stored) as Project[];
      // 確保日期是 Date 物件
      return projects.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt)
      }));
    } catch (error) {
      console.error('Failed to load projects:', error);
      return [];
    }
  }

  // 獲取當前專案 ID
  static getCurrentProjectId(): string | null {
    if (!isBrowser()) {
      return null;
    }
    
    try {
      return localStorage.getItem(CURRENT_PROJECT_KEY);
    } catch (error) {
      console.error('Failed to get current project ID:', error);
      return null;
    }
  }

  // 設定當前專案
  static setCurrentProject(projectId: string): void {
    if (!isBrowser()) {
      return;
    }
    
    try {
      localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
    } catch (error) {
      console.error('Failed to set current project:', error);
    }
  }

  // 創建新專案
  static createProject(name: string, description?: string): Project {
    const newProject: Project = {
      id: uuidv4(),
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const projects = this.getAllProjects();
    projects.push(newProject);
    
    if (!isBrowser()) {
      throw new Error('Cannot create project: not in browser environment');
    }
    
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      
      // 初始化空的專案資料
      const emptyData: WhiteboardData = {
        notes: [],
        edges: [],
        groups: []
      };
      this.saveProjectData(newProject.id, emptyData);
      
      // 如果是第一個專案，自動設為當前專案
      if (projects.length === 1) {
        this.setCurrentProject(newProject.id);
      }
      
      return newProject;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  // 更新專案資訊
  static updateProject(projectId: string, updates: Partial<Project>): void {
    if (!isBrowser()) {
      return;
    }
    
    const projects = this.getAllProjects();
    const index = projects.findIndex(p => p.id === projectId);
    
    if (index !== -1) {
      projects[index] = {
        ...projects[index],
        ...updates,
        updatedAt: new Date()
      };
      
      try {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      } catch (error) {
        console.error('Failed to update project:', error);
        throw error;
      }
    }
  }

  // 刪除專案
  static deleteProject(projectId: string): void {
    if (!isBrowser()) {
      return;
    }
    
    const projects = this.getAllProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
      localStorage.removeItem(PROJECT_DATA_PREFIX + projectId);
      
      // 如果刪除的是當前專案，切換到第一個專案
      if (this.getCurrentProjectId() === projectId) {
        if (filtered.length > 0) {
          this.setCurrentProject(filtered[0].id);
        } else {
          localStorage.removeItem(CURRENT_PROJECT_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  // 儲存專案資料
  static saveProjectData(projectId: string, data: WhiteboardData, viewport?: ViewportState): void {
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
      
      localStorage.setItem(PROJECT_DATA_PREFIX + projectId, JSON.stringify(storageData));
      
      // 更新專案的更新時間
      this.updateProject(projectId, { updatedAt: new Date() });
      
      // 生成縮圖（簡化版，只記錄便利貼數量）
      const thumbnail = this.generateThumbnail(data);
      this.updateProject(projectId, { thumbnail });
    } catch (error) {
      console.error('Failed to save project data:', error);
      throw error;
    }
  }

  // 載入專案資料
  static loadProjectData(projectId: string): WhiteboardData | null {
    if (!isBrowser()) {
      return null;
    }
    
    try {
      const stored = localStorage.getItem(PROJECT_DATA_PREFIX + projectId);
      if (!stored) return null;
      
      const parsedData = JSON.parse(stored);
      
      // 檢查版本相容性
      if (parsedData.version !== STORAGE_VERSION) {
        console.warn('Storage version mismatch for project:', projectId);
        return null;
      }
      
      const data = parsedData.data as WhiteboardData;
      return {
        notes: data.notes || [],
        edges: data.edges || [],
        groups: data.groups || [],
        viewport: data.viewport
      };
    } catch (error) {
      console.error('Failed to load project data:', error);
      return null;
    }
  }

  // 生成專案縮圖（簡化版）
  private static generateThumbnail(data: WhiteboardData): string {
    // 簡單的縮圖資訊，包含便利貼和連線數量
    return JSON.stringify({
      noteCount: data.notes.length,
      edgeCount: data.edges.length,
      groupCount: data.groups?.length || 0
    });
  }

  // 匯出專案
  static exportProject(projectId: string): ProjectWithData | null {
    const projects = this.getAllProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    
    const whiteboardData = this.loadProjectData(projectId);
    if (!whiteboardData) return null;
    
    return {
      ...project,
      whiteboardData
    };
  }

  // 匯入專案
  static importProject(projectData: ProjectWithData): Project {
    const newProject: Project = {
      ...projectData,
      id: uuidv4(), // 生成新的 ID 避免衝突
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const projects = this.getAllProjects();
    projects.push(newProject);
    
    if (!isBrowser()) {
      throw new Error('Cannot import project: not in browser environment');
    }
    
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      this.saveProjectData(newProject.id, projectData.whiteboardData);
      return newProject;
    } catch (error) {
      console.error('Failed to import project:', error);
      throw error;
    }
  }

  // 初始化預設專案（如果沒有任何專案）
  static initializeDefaultProject(): void {
    if (!isBrowser()) {
      return;
    }
    
    const projects = this.getAllProjects();
    if (projects.length === 0) {
      this.createProject('我的第一個專案', '歡迎使用 AI 白板！');
    }
  }
}