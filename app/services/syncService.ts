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

  // @deprecated 此方法已廢棄：現在 ProjectService 完全依賴 Firebase，不需要本地與雲端同步
  // 所有專案操作直接在 Firebase 中進行
  static async syncAllProjects(userId: string): Promise<void> {
    if (!userId || this.syncStatus.isSyncing) return;

    try {
      this.syncStatus.isSyncing = true;
      this.syncStatus.error = null;

      // 由於現在完全依賴 Firebase，這個方法已經不再需要
      // ProjectService 的所有操作都直接與 Firebase 同步
      console.log('syncAllProjects is deprecated - ProjectService now fully relies on Firebase');

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
            // 先檢查保護期（提前檢查，避免不必要的比較）
            const now = new Date();
            const lastLocalChange = this.syncStatus.lastLocalChangeTime;
            const timeSinceLastChange = lastLocalChange ? now.getTime() - lastLocalChange.getTime() : Infinity;
            
            // 延長保護期到 30 秒
            if (timeSinceLastChange < 30000) {
              console.log(`[Sync] Skipping - local changes ${Math.round(timeSinceLastChange/1000)}s ago`);
              return;
            }
            
            // 檢查是否有更新
            const localData = ProjectService.loadProjectData(projectId);
            if (localData && JSON.stringify(data) !== JSON.stringify(localData)) {
              // 再次檢查保護期（雙重保護）
              if (timeSinceLastChange < 30000) {
                console.log('[Sync] Data differs but still in protection period');
                return;
              }
              
              console.log('[Sync] Applying cloud data - no recent local changes');
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
      const project = await ProjectService.getProject(projectId);
      
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