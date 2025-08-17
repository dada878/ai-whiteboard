import { WhiteboardData } from '../types';

export interface Version {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  type: 'auto' | 'manual';
  createdAt: string;
  stats: {
    notes: number;
    edges: number;
    groups: number;
    images: number;
  };
  hasData?: boolean;
}

export interface VersionData extends Version {
  data: WhiteboardData;
}

export class VersionService {
  // 自動備份間隔（5分鐘）
  private static AUTO_SAVE_INTERVAL = 5 * 60 * 1000;
  private static autoSaveTimer: NodeJS.Timeout | null = null;
  private static lastAutoSaveHash: string = '';

  // 開始自動備份
  static startAutoBackup(
    projectId: string,
    getData: () => WhiteboardData,
    onError?: (error: Error) => void
  ) {
    this.stopAutoBackup();

    this.autoSaveTimer = setInterval(async () => {
      try {
        const data = getData();
        const currentHash = this.generateHash(data);
        
        // 只有資料有變更時才儲存
        if (currentHash !== this.lastAutoSaveHash) {
          await this.saveVersion(projectId, data, true);
          this.lastAutoSaveHash = currentHash;
          console.log('Auto-backup saved successfully');
        }
      } catch (error) {
        console.error('Auto-backup failed:', error);
        if (onError) {
          onError(error as Error);
        }
      }
    }, this.AUTO_SAVE_INTERVAL);
  }

  // 停止自動備份
  static stopAutoBackup() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // 生成資料雜湊值（用於檢測變更）
  private static generateHash(data: WhiteboardData): string {
    const str = JSON.stringify({
      notes: data.notes?.length || 0,
      edges: data.edges?.length || 0,
      groups: data.groups?.length || 0,
      images: data.images?.length || 0,
      // 簡單的內容雜湊
      noteContents: data.notes?.map(n => n.content).join(''),
    });
    
    // 簡單的雜湊函數
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  // 儲存版本
  static async saveVersion(
    projectId: string,
    data: WhiteboardData,
    isAuto: boolean = false,
    name?: string,
    description?: string
  ): Promise<string> {
    const response = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        projectId,
        versionData: {
          ...data,
          isAuto,
          name,
          description
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save version');
    }

    const result = await response.json();
    return result.versionId;
  }

  // 取得版本列表
  static async getVersions(projectId: string): Promise<Version[]> {
    const response = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        projectId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get versions');
    }

    const result = await response.json();
    return result.versions;
  }

  // 載入特定版本
  static async loadVersion(projectId: string, versionId: string): Promise<VersionData> {
    const response = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'load',
        projectId,
        versionId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to load version');
    }

    const result = await response.json();
    return result.version;
  }

  // 還原版本
  static async restoreVersion(projectId: string, versionId: string): Promise<WhiteboardData> {
    const response = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restore',
        projectId,
        versionId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to restore version');
    }

    const result = await response.json();
    return result.data;
  }

  // 刪除版本
  static async deleteVersion(projectId: string, versionId: string): Promise<void> {
    const response = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        projectId,
        versionId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to delete version');
    }
  }

  // 手動建立備份
  static async createManualBackup(
    projectId: string,
    data: WhiteboardData,
    name: string,
    description?: string
  ): Promise<string> {
    return this.saveVersion(projectId, data, false, name, description);
  }
}