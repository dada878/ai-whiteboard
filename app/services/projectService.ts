import { Project, ProjectWithData, WhiteboardData, ViewportState } from '../types';
import { v4 as uuidv4 } from 'uuid';

const CURRENT_PROJECT_KEY = 'thinkboard-current-project';

// Helper function to check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

export class ProjectService {
  private static currentUserId: string | null = null;

  // 設定當前使用者 ID
  static setUserId(userId: string | null) {
    this.currentUserId = userId;
  }

  // 取得當前使用者 ID
  static getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // 獲取所有專案列表（從 Firebase）
  static async getAllProjects(): Promise<Project[]> {
    if (!isBrowser() || !this.currentUserId) {
      return [];
    }
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.projects) {
        // 確保日期是 Date 物件
        return result.projects.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to load projects from Firebase:', error);
      return [];
    }
  }

  // 獲取單個專案
  static async getProject(projectId: string): Promise<Project | null> {
    const projects = await this.getAllProjects();
    return projects.find(p => p.id === projectId) || null;
  }

  // 獲取當前專案 ID（僅保留在 localStorage 中暫存）
  static getCurrentProjectId(): string | null {
    if (!isBrowser()) {
      return null;
    }
    
    try {
      const key = this.currentUserId ? `${CURRENT_PROJECT_KEY}:${this.currentUserId}` : CURRENT_PROJECT_KEY;
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Failed to get current project ID:', error);
      return null;
    }
  }

  // 設定當前專案（僅保留在 localStorage 中暫存）
  static setCurrentProject(projectId: string): void {
    if (!isBrowser()) {
      return;
    }
    
    try {
      const key = this.currentUserId ? `${CURRENT_PROJECT_KEY}:${this.currentUserId}` : CURRENT_PROJECT_KEY;
      localStorage.setItem(key, projectId);
    } catch (error) {
      console.error('Failed to set current project:', error);
    }
  }

  // 移除本地快取功能，完全依賴 Firebase

  // 創建新專案（直接在 Firebase 中創建）
  static async createProject(name: string, description?: string): Promise<Project> {
    if (!isBrowser() || !this.currentUserId) {
      throw new Error('Cannot create project: not authenticated');
    }

    const newProject: Project = {
      id: uuidv4(),
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      // 直接在 Firebase 中創建專案
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          projectId: newProject.id,
          projectMetadata: {
            name: newProject.name,
            description: newProject.description,
            createdAt: newProject.createdAt.toISOString(),
            updatedAt: newProject.updatedAt.toISOString()
          },
          data: {
            notes: [],
            edges: [],
            groups: [],
            images: []
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 檢查是否是第一個專案，如果是則設為當前專案
      const allProjects = await this.getAllProjects();
      if (allProjects.length === 1 || this.getCurrentProjectId() === null) {
        this.setCurrentProject(newProject.id);
      }
      
      return newProject;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  // 更新專案資訊（直接在 Firebase 中更新）
  static async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    if (!isBrowser() || !this.currentUserId) {
      return;
    }
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          projectId,
          projectMetadata: {
            ...updates,
            updatedAt: new Date().toISOString()
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  // 刪除專案（直接在 Firebase 中刪除）
  static async deleteProject(projectId: string): Promise<void> {
    if (!isBrowser() || !this.currentUserId) {
      return;
    }
    
    try {
      // 從 Firebase 刪除專案
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          projectId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 如果刪除的是當前專案，清除當前專案設定
      if (this.getCurrentProjectId() === projectId) {
        const remainingProjects = await this.getAllProjects();
        if (remainingProjects.length > 0) {
          this.setCurrentProject(remainingProjects[0].id);
        } else {
          // 移除當前專案設定
          const key = this.currentUserId ? `${CURRENT_PROJECT_KEY}:${this.currentUserId}` : CURRENT_PROJECT_KEY;
          localStorage.removeItem(key);
        }
      }
      
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  // 儲存專案資料（直接在 Firebase 中儲存）
  static async saveProjectData(projectId: string, data: WhiteboardData, viewport?: ViewportState): Promise<void> {
    if (!isBrowser() || !this.currentUserId) {
      return;
    }
    
    try {
      const dataWithViewport = viewport ? { ...data, viewport } : data;
      
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          projectId,
          data: dataWithViewport
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 生成縮圖並更新專案 metadata
      const thumbnail = this.generateThumbnail(data);
      await this.updateProject(projectId, { 
        updatedAt: new Date(),
        thumbnail 
      });
    } catch (error) {
      console.error('Failed to save project data:', error);
      throw error;
    }
  }

  // 載入專案資料（從 Firebase 載入）
  static async loadProjectData(projectId: string): Promise<WhiteboardData | null> {
    if (!isBrowser() || !this.currentUserId) {
      return null;
    }
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load',
          projectId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.data) {
        const data = result.data;
        return {
          notes: data.notes || [],
          edges: data.edges || [],
          groups: data.groups || [],
          images: data.images || [],
          viewport: data.viewport
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load project data:', error);
      return null;
    }
  }

  // 生成專案縮圖（簡化版）
  private static generateThumbnail(data: WhiteboardData): string {
    // 簡單的縮圖資訊，包含便利貼、連線、群組和圖片數量
    return JSON.stringify({
      noteCount: data.notes.length,
      edgeCount: data.edges.length,
      groupCount: data.groups?.length || 0,
      imageCount: data.images?.length || 0
    });
  }

  // 匯出專案
  static async exportProject(projectId: string): Promise<ProjectWithData | null> {
    const projects = await this.getAllProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    
    const whiteboardData = await this.loadProjectData(projectId);
    if (!whiteboardData) return null;
    
    return {
      ...project,
      whiteboardData
    };
  }

  // 匯入專案（直接在 Firebase 中創建）
  static async importProject(projectData: ProjectWithData): Promise<Project> {
    if (!isBrowser() || !this.currentUserId) {
      throw new Error('Cannot import project: not authenticated');
    }

    const newProject: Project = {
      ...projectData,
      id: uuidv4(), // 生成新的 ID 避免衝突
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      // 在 Firebase 中創建專案
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          projectId: newProject.id,
          projectMetadata: {
            name: newProject.name,
            description: newProject.description,
            createdAt: newProject.createdAt.toISOString(),
            updatedAt: newProject.updatedAt.toISOString()
          },
          data: projectData.whiteboardData
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return newProject;
    } catch (error) {
      console.error('Failed to import project:', error);
      throw error;
    }
  }

  // 初始化預設專案（如果沒有任何專案）
  static async initializeDefaultProject(): Promise<void> {
    if (!isBrowser() || !this.currentUserId) {
      return;
    }
    
    const projects = await this.getAllProjects();
    if (projects.length === 0) {
      await this.createProject('我的第一個專案', '歡迎使用 ThinkBoard！');
    }
  }
}