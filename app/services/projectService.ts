import { Project, ProjectWithData, WhiteboardData, ViewportState } from '../types';
import { v4 as uuidv4 } from 'uuid';

const PROJECTS_KEY = 'thinkboard-projects';
const CURRENT_PROJECT_KEY = 'thinkboard-current-project';
const PROJECT_DATA_PREFIX = 'thinkboard-project-data-';
const USER_KEY = 'thinkboard-user-id';
const STORAGE_VERSION = 'v2';

// Helper function to check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

export class ProjectService {
  private static userKeySuffix: string | null = null;

  // 在使用者切換時設定 key 後綴，讓每位使用者有獨立的本地專案空間
  static setUserId(userId: string | null) {
    this.userKeySuffix = userId ? String(userId) : null;
    if (isBrowser()) {
      try {
        if (userId) {
          localStorage.setItem(USER_KEY, userId);
        } else {
          localStorage.removeItem(USER_KEY);
        }
      } catch {
        // ignore
      }
    }
  }

  private static key(base: string): string {
    return this.userKeySuffix ? `${base}:${this.userKeySuffix}` : base;
  }

  static getProjectsKey(): string { return this.key(PROJECTS_KEY); }
  static getCurrentProjectKey(): string { return this.key(CURRENT_PROJECT_KEY); }
  static getProjectDataKey(projectId: string): string { return this.key(PROJECT_DATA_PREFIX + projectId); }

  // 獲取所有專案列表
  static getAllProjects(): Project[] {
    if (!isBrowser()) {
      return [];
    }
    
    try {
      const stored = localStorage.getItem(this.getProjectsKey()) || localStorage.getItem(PROJECTS_KEY);
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

  // 獲取單個專案
  static getProject(projectId: string): Project | null {
    const projects = this.getAllProjects();
    return projects.find(p => p.id === projectId) || null;
  }

  // 獲取當前專案 ID
  static getCurrentProjectId(): string | null {
    if (!isBrowser()) {
      return null;
    }
    
    try {
      return localStorage.getItem(this.getCurrentProjectKey()) || localStorage.getItem(CURRENT_PROJECT_KEY);
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
      localStorage.setItem(this.getCurrentProjectKey(), projectId);
    } catch (error) {
      console.error('Failed to set current project:', error);
    }
  }

  // 創建新專案
  static async createProject(name: string, description?: string, syncToCloud: boolean = true): Promise<Project> {
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
      localStorage.setItem(this.getProjectsKey(), JSON.stringify(projects));
      
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
      
      // 如果需要同步到雲端
      if (syncToCloud && typeof window !== 'undefined') {
        // 使用動態導入來避免循環依賴
        const { SyncService } = await import('./syncService');
        const userId = localStorage.getItem(USER_KEY);
        if (userId) {
          try {
            await SyncService.saveProjectData(userId, newProject.id, emptyData);
          } catch (error) {
            console.error('Failed to sync new project to cloud:', error);
            // 不拋出錯誤，讓專案在本地創建成功
          }
        }
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
          localStorage.setItem(this.getProjectsKey(), JSON.stringify(projects));
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
      // 更新專案列表
      localStorage.setItem(this.getProjectsKey(), JSON.stringify(filtered));
      
      // 刪除專案資料
      localStorage.removeItem(this.getProjectDataKey(projectId));
      
      // 如果刪除的是當前專案，清除當前專案設定
      if (this.getCurrentProjectId() === projectId) {
        if (filtered.length > 0) {
          this.setCurrentProject(filtered[0].id);
        } else {
          // 移除當前專案設定
          localStorage.removeItem(this.getCurrentProjectKey());
          // 同時移除舊版的 key（向後相容）
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
      
      localStorage.setItem(this.getProjectDataKey(projectId), JSON.stringify(storageData));
      
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
      const stored = localStorage.getItem(this.getProjectDataKey(projectId)) || localStorage.getItem(PROJECT_DATA_PREFIX + projectId);
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
        images: data.images || [],  // Add images array to the returned data
        viewport: data.viewport
      };
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
  static async initializeDefaultProject(): Promise<void> {
    if (!isBrowser()) {
      return;
    }
    
    const projects = this.getAllProjects();
    if (projects.length === 0) {
      await this.createProject('我的第一個專案', '歡迎使用 ThinkBoard！');
    }
  }
}