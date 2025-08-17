// Google Analytics 4 配置
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

// 檢查是否在生產環境
export const isProd = process.env.NODE_ENV === 'production';

// 頁面瀏覽追蹤
export const pageview = (url: string) => {
  if (!isProd || !GA_MEASUREMENT_ID) return;
  
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// 事件追蹤
interface GtagEvent {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

export const event = ({ action, category, label, value, ...otherParams }: GtagEvent) => {
  if (!isProd || !GA_MEASUREMENT_ID) {
    // 開發環境下在 console 顯示事件
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Event]', action, {
        category,
        label,
        value,
        ...otherParams
      });
    }
    return;
  }
  
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      ...otherParams,
    });
  }
};

// 用戶屬性設定
export const setUserProperties = (userId: string, properties?: object) => {
  if (!isProd || !GA_MEASUREMENT_ID) return;
  
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
      user_id: userId,
      user_properties: properties,
    });
  }
};

// 自定義維度
export const setCustomDimensions = (dimensions: object) => {
  if (!isProd || !GA_MEASUREMENT_ID) return;
  
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
      custom_map: dimensions,
    });
  }
};

// AI Whiteboard 專用事件
export const trackNoteEvent = (
  action: 'create' | 'edit' | 'delete' | 'move',
  noteId: string,
  additionalParams?: object
) => {
  event({
    action: `note_${action}`,
    category: 'Note',
    label: noteId,
    ...additionalParams,
  });
};

export const trackAIEvent = (
  operation: 'brainstorm' | 'analyze' | 'summarize' | 'ask' | 'network',
  success: boolean,
  resultCount?: number,
  additionalParams?: object
) => {
  event({
    action: `ai_${operation}`,
    category: 'AI',
    label: success ? 'success' : 'failed',
    value: resultCount,
    ...additionalParams,
  });
};

export const trackProjectEvent = (
  action: 'create' | 'open' | 'save' | 'delete' | 'share',
  projectId?: string,
  additionalParams?: object
) => {
  event({
    action: `project_${action}`,
    category: 'Project',
    label: projectId,
    ...additionalParams,
  });
};

export const trackAuthEvent = (
  action: 'login' | 'logout' | 'signup',
  method?: string,
  additionalParams?: object
) => {
  event({
    action: `auth_${action}`,
    category: 'Auth',
    label: method,
    ...additionalParams,
  });
};

export const trackExportEvent = (
  format: 'png' | 'pdf' | 'json',
  noteCount: number,
  additionalParams?: object
) => {
  event({
    action: 'export',
    category: 'Export',
    label: format,
    value: noteCount,
    ...additionalParams,
  });
};

// 追蹤用戶參與度
export const trackEngagement = (
  sessionDuration: number,
  notesCreated: number,
  aiOperations: number
) => {
  event({
    action: 'session_engagement',
    category: 'Engagement',
    session_duration: sessionDuration,
    notes_created: notesCreated,
    ai_operations: aiOperations,
  });
};

// 追蹤功能使用
export const trackFeatureUse = (
  feature: string,
  additionalParams?: object
) => {
  event({
    action: 'feature_use',
    category: 'Feature',
    label: feature,
    ...additionalParams,
  });
};