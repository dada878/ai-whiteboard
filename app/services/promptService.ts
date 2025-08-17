// 這個服務只能在伺服器端使用
// Client-side 不支援 fs 模組
import path from 'path';

/**
 * Prompt 管理服務
 * 負責載入、編譯和快取 Markdown 格式的 prompts
 */
export class PromptService {
  private cache: Map<string, string> = new Map();
  private baseDir: string;
  
  constructor(baseDir?: string) {
    // 預設使用專案根目錄的 prompts 資料夾
    this.baseDir = baseDir || path.join(process.cwd(), 'prompts');
  }

  /**
   * 載入 Markdown prompt 檔案
   * @param promptPath - 相對於 prompts 資料夾的路徑
   * @returns prompt 內容
   */
  async loadPrompt(promptPath: string): Promise<string> {
    const cacheKey = promptPath;
    
    // 檢查快取
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // 只在伺服器端執行
      if (typeof window === 'undefined') {
        const fs = await import('fs/promises');
        const fullPath = path.join(this.baseDir, promptPath);
        let content = await fs.readFile(fullPath, 'utf-8');
        
        // 移除 HTML 註解（保持 prompts 乾淨）
        content = this.removeHtmlComments(content);
        
        // 處理 import 語句
        const processedContent = await this.processImports(content, path.dirname(promptPath));
        
        // 快取結果
        this.cache.set(cacheKey, processedContent);
        
        return processedContent;
      } else {
        // 瀏覽器端：透過 API 載入
        const response = await fetch(`/api/prompts/load?path=${encodeURIComponent(promptPath)}`);
        if (!response.ok) {
          throw new Error(`Failed to load prompt from API: ${promptPath}`);
        }
        const content = await response.text();
        
        // 快取結果
        this.cache.set(cacheKey, content);
        
        return content;
      }
    } catch (error) {
      console.error(`Failed to load prompt: ${promptPath}`, error);
      throw new Error(`Cannot load prompt file: ${promptPath}`);
    }
  }

  /**
   * 載入並編譯 prompt，替換變數
   * @param promptPath - prompt 檔案路徑
   * @param variables - 要替換的變數
   * @returns 編譯後的 prompt
   */
  async compilePrompt(
    promptPath: string, 
    variables: Record<string, any> = {}
  ): Promise<string> {
    let content = await this.loadPrompt(promptPath);
    
    // 處理條件邏輯
    content = this.processConditionals(content, variables);
    
    // 替換變數
    content = this.replaceVariables(content, variables);
    
    return content;
  }

  /**
   * 處理 import 語句
   * @param content - 原始內容
   * @param currentDir - 當前檔案的目錄
   */
  private async processImports(content: string, currentDir: string): Promise<string> {
    const importRegex = /\{\{import:([^}]+)\}\}/g;
    const matches = [...content.matchAll(importRegex)];
    
    for (const match of matches) {
      const importPath = match[1].trim();
      const resolvedPath = path.join(currentDir, importPath);
      
      try {
        const importedContent = await this.loadPrompt(resolvedPath);
        content = content.replace(match[0], importedContent);
      } catch (error) {
        console.warn(`Failed to import: ${importPath}`, error);
        // 保留原始 import 語句作為 fallback
      }
    }
    
    return content;
  }

  /**
   * 處理條件邏輯
   * @param content - 原始內容
   * @param variables - 變數物件
   */
  private processConditionals(content: string, variables: Record<string, any>): string {
    // 處理 if 條件
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    content = content.replace(ifRegex, (match, condition, body) => {
      const conditionKey = condition.trim();
      const conditionValue = this.resolveVariable(conditionKey, variables);
      
      // 評估條件
      if (this.evaluateCondition(conditionValue)) {
        return body;
      }
      return '';
    });
    
    // 處理 unless 條件（相反邏輯）
    const unlessRegex = /\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
    
    content = content.replace(unlessRegex, (match, condition, body) => {
      const conditionKey = condition.trim();
      const conditionValue = this.resolveVariable(conditionKey, variables);
      
      if (!this.evaluateCondition(conditionValue)) {
        return body;
      }
      return '';
    });
    
    return content;
  }

  /**
   * 替換變數
   * @param content - 原始內容
   * @param variables - 變數物件
   */
  private replaceVariables(content: string, variables: Record<string, any>): string {
    const variableRegex = /\{\{([^#/][^}]*)\}\}/g;
    
    return content.replace(variableRegex, (match, variableName) => {
      const trimmedName = variableName.trim();
      const value = this.resolveVariable(trimmedName, variables);
      
      // 處理不同類型的值
      if (value === undefined || value === null) {
        return '';
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      
      return String(value);
    });
  }

  /**
   * 解析變數值（支援巢狀屬性）
   * @param path - 變數路徑（如 "user.name"）
   * @param variables - 變數物件
   */
  private resolveVariable(path: string, variables: Record<string, any>): any {
    const keys = path.split('.');
    let value: any = variables;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 評估條件值
   * @param value - 要評估的值
   */
  private evaluateCondition(value: any): boolean {
    // Falsy 值
    if (!value) return false;
    
    // 空陣列
    if (Array.isArray(value) && value.length === 0) return false;
    
    // 空物件
    if (typeof value === 'object' && Object.keys(value).length === 0) return false;
    
    // 字串 "false"
    if (value === 'false') return false;
    
    return true;
  }

  /**
   * 移除 HTML 註解
   * @param content - 原始內容
   */
  private removeHtmlComments(content: string): string {
    // 移除 HTML 註解 <!-- ... -->
    // 使用非貪婪匹配，支援多行
    return content.replace(/<!--[\s\S]*?-->/g, '').trim();
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除特定檔案的快取
   * @param promptPath - prompt 檔案路徑
   */
  clearCacheFor(promptPath: string): void {
    this.cache.delete(promptPath);
  }

  /**
   * 批次載入多個 prompts
   * @param paths - prompt 路徑陣列
   */
  async loadMultiple(paths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    await Promise.all(
      paths.map(async (path) => {
        try {
          const content = await this.loadPrompt(path);
          results.set(path, content);
        } catch (error) {
          console.error(`Failed to load ${path}:`, error);
        }
      })
    );
    
    return results;
  }
}

// 建立預設實例
export const promptService = new PromptService();