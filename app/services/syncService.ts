import { ProjectService } from './projectService';
import { Project, WhiteboardData } from '../types';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  hasConflicts: boolean;
  error: string | null;
  lastLocalChangeTime?: Date | null;
}

export class SyncService {
  private static syncStatus: SyncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    hasConflicts: false,
    error: null,
    lastLocalChangeTime: null
  };
  
  private static syncInterval: NodeJS.Timeout | null = null;

  // 同步所有專案
  static async syncAllProjects(userId: string): Promise<void> {
    if (!userId || this.syncStatus.isSyncing) return;

    try {
      this.syncStatus.isSyncing = true;
      this.syncStatus.error = null;

      // 獲取本地專案
      const localProjects = ProjectService.getAllProjects();
      
      // 同步每個專案到雲端
      for (const project of localProjects) {
        await this.syncProjectToCloud(userId, project);
      }

      // 從雲端獲取專案
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Sync API error response:', errorData);
        throw new Error(`Failed to sync projects: ${errorData.error || response.statusText}`);
      }

      const { projects } = await response.json();
      
      // 合併雲端專案到本地
      for (const cloudProject of projects) {
        const localProjects = ProjectService.getAllProjects();
        const localProject = localProjects.find(p => p.id === cloudProject.id);
        if (!localProject) {
          // 如果本地沒有，直接添加到本地專案列表
          const newProject: Project = {
            id: cloudProject.id,
            name: cloudProject.name || '未命名專案',
            description: cloudProject.description,
            createdAt: new Date(cloudProject.createdAt || Date.now()),
            updatedAt: new Date(cloudProject.updatedAt || Date.now())
          };
          
          // 直接操作本地存儲，避免創建新的 UUID
          const currentProjects = ProjectService.getAllProjects();
          currentProjects.push(newProject);
          
          if (typeof window !== 'undefined' && localStorage) {
            const projectsKey = ProjectService.getProjectsKey();
            localStorage.setItem(projectsKey, JSON.stringify(currentProjects));
          }
          
          // 獲取白板資料
          const dataResponse = await fetch('/api/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'load',
              projectId: cloudProject.id
            })
          });

          if (dataResponse.ok) {
            const { data } = await dataResponse.json();
            if (data) {
              ProjectService.saveProjectData(cloudProject.id, data);
            }
          }
        }
      }

      this.syncStatus.lastSyncTime = new Date();
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncStatus.error = error instanceof Error ? error.message : '同步失敗';
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  // 同步單個專案到雲端
  private static async syncProjectToCloud(userId: string, project: Project): Promise<void> {
    try {
      // 獲取白板資料
      const whiteboardData = ProjectService.loadProjectData(project.id);
      if (!whiteboardData) return;

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          projectId: project.id,
          data: whiteboardData,
          projectMetadata: {
            name: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to sync project ${project.id}`);
      }
    } catch (error) {
      console.error(`Failed to sync project ${project.id}:`, error);
      throw error;
    }
  }

  // 啟用即時同步（使用輪詢代替 Firestore 即時監聽）
  static enableRealtimeSync(projectId: string, userId: string, onUpdate: (data: WhiteboardData) => void): void {
    if (!userId || !projectId) return;
    
    // 停止現有的同步
    this.disableRealtimeSync(projectId);
    
    // 開始輪詢
    this.syncInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'load',
            projectId: projectId
          })
        });

        if (response.ok) {
          const { data } = await response.json();
          if (data) {
            // 檢查是否有更新
            const localData = ProjectService.loadProjectData(projectId);
            if (localData && JSON.stringify(data) !== JSON.stringify(localData)) {
              // 檢查是否在最近10秒內有本地變更，如果有則跳過同步以避免覆蓋用戶正在進行的操作
              const now = new Date();
              const lastLocalChange = this.syncStatus.lastLocalChangeTime;
              if (lastLocalChange && (now.getTime() - lastLocalChange.getTime()) < 10000) {
                return;
              }
              
              // 如果沒有最近的本地變更，才應用雲端資料
              onUpdate(data);
            }
          }
        }
      } catch (error) {
        console.error('Realtime sync error:', error);
        this.syncStatus.error = '即時同步失敗';
      }
    }, 5000); // 每5秒檢查一次
  }

  // 停用即時同步
  static disableRealtimeSync(projectId: string): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // 停用所有即時同步
  static disableAllRealtimeSync(): void {
    this.disableRealtimeSync('');
  }

  // 標記本地變更時間（用於防止同步衝突）
  static markLocalChange(): void {
    this.syncStatus.lastLocalChangeTime = new Date();
  }

  // 保存專案資料到雲端
  static async saveProjectData(userId: string, projectId: string, data: WhiteboardData): Promise<void> {
    
    if (!userId || !projectId) {
      return;
    }
    
    try {
      this.syncStatus.isSyncing = true;
      
      // 獲取專案元數據
      const project = ProjectService.getProject(projectId);
      
      // Filter out base64 images to reduce payload size for cloud storage
      // Keep Firebase Storage URLs (they start with https://)
      const originalImages = data.images || [];
      const cloudImages = originalImages.filter(img => {
        // Keep images that are stored in Firebase Storage or other cloud services
        // Only filter out base64 encoded images
        return !img.url.startsWith('data:');
      });
      
      const cloudData = {
        ...data,
        images: cloudImages
      };
      
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          projectId: projectId,
          data: cloudData,
          projectMetadata: project ? {
            name: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          } : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save project data');
      }
      
      // 同時保存到本地
      ProjectService.saveProjectData(projectId, data);
      
      // 更新同步狀態
      this.syncStatus.lastSyncTime = new Date();
      this.syncStatus.error = null;
    } catch (error) {
      console.error('Failed to save project data to cloud:', error);
      this.syncStatus.error = error instanceof Error ? error.message : '同步失敗';
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  // 獲取同步狀態
  static getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  // 檢查是否有衝突
  private static hasConflict(localData: WhiteboardData, cloudData: WhiteboardData): boolean {
    // 簡單的實現：比較修改時間
    return false;
  }

  // 解決衝突
  static resolveConflicts(localData: WhiteboardData, cloudData: WhiteboardData): WhiteboardData {
    // 簡單策略：合併兩個資料
    return {
      notes: [...localData.notes, ...cloudData.notes].filter((note, index, self) => 
        index === self.findIndex((n) => n.id === note.id)
      ),
      edges: [...localData.edges, ...cloudData.edges].filter((edge, index, self) => 
        index === self.findIndex((e) => e.id === edge.id)
      ),
      groups: [...localData.groups, ...cloudData.groups].filter((group, index, self) => 
        index === self.findIndex((g) => g.id === group.id)
      ),
      images: [...(localData.images || []), ...(cloudData.images || [])].filter((image, index, self) => 
        index === self.findIndex((i) => i.id === image.id)
      )
    };
  }
}