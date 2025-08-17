// Google Analytics 4 Integration Service
// 用於追蹤用戶行為、轉換漏斗和同群分析

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: any
    ) => void;
    dataLayer: any[];
  }
}

interface UserProperties {
  user_id?: string;
  user_type?: 'free' | 'plus' | 'admin';
  signup_date?: string;
  subscription_status?: string;
  auth_method?: string;
  cohort_week?: string; // YYYY-WW format
}

interface EventParameters {
  [key: string]: any;
}

class GA4Service {
  private static instance: GA4Service;
  private measurementId: string = '';
  private userId: string | null = null;
  private sessionStartTime: number = Date.now();
  private onboardingStartTime: number | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): GA4Service {
    if (!GA4Service.instance) {
      GA4Service.instance = new GA4Service();
    }
    return GA4Service.instance;
  }

  // 初始化 GA4
  initialize() {
    if (this.isInitialized) return;

    // 從環境變數獲取 Measurement ID
    this.measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '';
    
    if (!this.measurementId) {
      console.warn('GA4 Measurement ID not found in environment variables');
      return;
    }

    // 動態載入 gtag.js
    if (typeof window !== 'undefined' && !window.gtag) {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      script.async = true;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function(...args) {
        window.dataLayer.push(args);
      };
      window.gtag('js', new Date());
      
      // 初始配置
      window.gtag('config', this.measurementId, {
        send_page_view: false, // 手動控制頁面瀏覽事件
        debug_mode: process.env.NODE_ENV === 'development'
      });
    }

    this.isInitialized = true;
    console.log('GA4 initialized with ID:', this.measurementId);
  }

  // 設定用戶屬性
  setUserProperties(properties: UserProperties) {
    if (!window.gtag) return;

    this.userId = properties.user_id || null;
    
    // 計算 cohort week (週一為週的開始)
    if (properties.signup_date) {
      const date = new Date(properties.signup_date);
      const week = this.getWeekNumber(date);
      const year = date.getFullYear();
      properties.cohort_week = `${year}-W${week.toString().padStart(2, '0')}`;
    }
    
    window.gtag('set', 'user_properties', properties);

    // 設定用戶 ID 用於跨裝置追蹤
    if (properties.user_id) {
      window.gtag('config', this.measurementId, {
        user_id: properties.user_id
      });
    }
  }

  // ===== ONBOARDING FUNNEL EVENTS (10步驟) =====
  
  // 步驟 1: 訪問著陸頁
  trackLandingPageView() {
    this.onboardingStartTime = Date.now();
    
    this.trackEvent('page_view', {
      page_title: 'Landing Page',
      page_location: '/landing',
      page_path: '/landing',
      funnel_step: '01_landing_view',
      funnel_name: 'onboarding',
      engagement_time_msec: 100
    });
  }

  // 步驟 2: 點擊 CTA
  trackCTAClick(buttonLocation: 'hero' | 'features' | 'footer') {
    const timeOnLanding = this.onboardingStartTime 
      ? Date.now() - this.onboardingStartTime 
      : 0;

    this.trackEvent('select_content', {
      content_type: 'cta_button',
      button_location: buttonLocation,
      funnel_step: '02_cta_click',
      funnel_name: 'onboarding',
      time_on_landing_msec: timeOnLanding
    });
  }

  // 步驟 3: 查看登入頁面
  trackLoginPageView() {
    this.trackEvent('view_item', {
      item_name: 'login_page',
      funnel_step: '03_login_view',
      funnel_name: 'onboarding'
    });
  }

  // 步驟 4: 開始登入
  trackLoginAttempt(method: 'google' | 'email' | 'github') {
    this.trackEvent('login', {
      method: method,
      funnel_step: '04_login_attempt',
      funnel_name: 'onboarding'
    });
  }

  // 步驟 5: 登入成功
  trackLoginSuccess(userId: string, method: string, isNewUser: boolean) {
    const totalOnboardingTime = this.onboardingStartTime 
      ? Date.now() - this.onboardingStartTime 
      : null;

    // 使用 sign_up 事件（GA4 預設轉換事件）
    if (isNewUser) {
      this.trackEvent('sign_up', {
        method: method,
        user_id: userId,
        funnel_step: '05_signup_success',
        funnel_name: 'onboarding',
        time_to_signup_msec: totalOnboardingTime
      });
    } else {
      this.trackEvent('login', {
        method: method,
        user_id: userId,
        funnel_step: '05_login_success',
        funnel_name: 'onboarding',
        is_returning_user: true
      });
    }

    // 設定用戶屬性供 Cohort 分析
    this.setUserProperties({
      user_id: userId,
      signup_date: isNewUser ? new Date().toISOString().split('T')[0] : undefined,
      auth_method: method,
      user_type: 'free'
    });
  }

  // 步驟 6: 首次進入白板
  trackFirstWhiteboardView() {
    this.trackEvent('tutorial_begin', {
      funnel_step: '06_whiteboard_first_view',
      funnel_name: 'onboarding'
    });
  }

  // 步驟 7: 創建第一個便利貼
  trackFirstNoteCreation(noteId: string, content?: string) {
    this.trackEvent('level_start', {
      level_name: 'first_note',
      funnel_step: '07_first_note_created',
      funnel_name: 'onboarding',
      note_id: noteId,
      has_content: !!content,
      content_length: content?.length || 0
    });
  }

  // 步驟 8: 使用 AI 功能
  trackFirstAIUsage(aiFeature: 'brainstorm' | 'analyze' | 'summarize' | 'ask') {
    this.trackEvent('unlock_achievement', {
      achievement_id: 'first_ai_use',
      funnel_step: '08_ai_feature_used',
      funnel_name: 'onboarding',
      ai_feature: aiFeature
    });
  }

  // 步驟 9: 保存專案
  trackProjectSave(projectId: string, projectName: string, isFirstProject: boolean) {
    this.trackEvent('generate_lead', {
      funnel_step: '09_project_saved',
      funnel_name: 'onboarding',
      project_id: projectId,
      project_name: projectName,
      is_first_project: isFirstProject,
      value: isFirstProject ? 10 : 5, // 為首次專案設定較高價值
      currency: 'USD'
    });
  }

  // 步驟 10: 升級到 Plus（轉換完成）
  trackPlusUpgrade(planType: 'monthly' | 'yearly', price: number) {
    this.trackEvent('purchase', {
      funnel_step: '10_plus_upgrade',
      funnel_name: 'onboarding',
      transaction_id: `upgrade_${Date.now()}`,
      value: price,
      currency: 'USD',
      items: [{
        item_id: `plus_${planType}`,
        item_name: `ThinkBoard Plus ${planType}`,
        item_category: 'subscription',
        item_variant: planType,
        price: price,
        quantity: 1
      }]
    });

    // 更新用戶類型
    this.setUserProperties({
      user_type: 'plus',
      subscription_status: 'active'
    });

    // 完成 onboarding
    const totalTime = this.onboardingStartTime 
      ? Date.now() - this.onboardingStartTime 
      : null;
      
    this.trackEvent('tutorial_complete', {
      funnel_name: 'onboarding',
      total_time_msec: totalTime,
      success: true
    });
  }

  // ===== ENGAGEMENT & RETENTION METRICS =====

  // 追蹤功能使用（用於 Cohort 分析）
  trackFeatureUsage(featureName: string, metadata?: any) {
    this.trackEvent('feature_usage', {
      feature_name: featureName,
      engagement_time_msec: Date.now() - this.sessionStartTime,
      ...metadata
    });
  }

  // 追蹤便利貼操作
  trackNoteAction(action: 'create' | 'edit' | 'delete', noteId: string, metadata?: any) {
    this.trackEvent(`note_${action}`, {
      note_id: noteId,
      total_notes: metadata?.totalNotes,
      ...metadata
    });
  }

  // 追蹤 AI 操作
  trackAIOperation(operation: string, success: boolean, metadata?: any) {
    this.trackEvent('ai_operation', {
      operation_type: operation,
      success: success,
      generated_notes: metadata?.generatedNotesCount,
      ...metadata
    });
  }

  // 追蹤專案操作
  trackProjectAction(action: 'create' | 'open' | 'delete' | 'export', projectId: string, metadata?: any) {
    this.trackEvent(`project_${action}`, {
      project_id: projectId,
      ...metadata
    });
  }

  // 追蹤用戶參與度
  trackEngagement(action: string, category: string, label?: string, value?: number) {
    this.trackEvent('user_engagement', {
      engagement_type: action,
      engagement_category: category,
      engagement_label: label,
      engagement_value: value,
      engagement_time_msec: Date.now() - this.sessionStartTime
    });
  }

  // 追蹤每日活躍
  trackDailyActive() {
    const today = new Date().toISOString().split('T')[0];
    
    this.trackEvent('daily_active_user', {
      date: today,
      user_id: this.userId
    });
  }

  // 追蹤回訪（用於留存分析）
  trackReturnVisit(daysSinceSignup: number, daysSinceLastVisit: number) {
    this.trackEvent('user_return', {
      days_since_signup: daysSinceSignup,
      days_since_last_visit: daysSinceLastVisit,
      retention_day: this.getRetentionDay(daysSinceSignup)
    });
  }

  // ===== CUSTOM EVENTS =====

  // 追蹤自訂事件
  trackCustomEvent(eventName: string, parameters?: EventParameters) {
    this.trackEvent(eventName, parameters);
  }

  // ===== PERFORMANCE TRACKING =====

  trackPageLoadTime(loadTime: number) {
    this.trackEvent('page_load_time', {
      value: loadTime,
      page_location: window.location.pathname
    });
  }

  trackAPIResponseTime(endpoint: string, responseTime: number) {
    this.trackEvent('api_response_time', {
      api_endpoint: endpoint,
      response_time_ms: responseTime
    });
  }

  // ===== ERROR TRACKING =====

  trackError(error: Error, context?: string) {
    this.trackEvent('exception', {
      description: error.message,
      fatal: false,
      error_context: context,
      error_stack: error.stack?.substring(0, 500) // 限制長度
    });
  }

  // ===== CORE TRACKING METHOD =====

  private trackEvent(eventName: string, parameters?: EventParameters) {
    if (!window.gtag) {
      console.log('GA4 Event (not sent - gtag not loaded):', eventName, parameters);
      return;
    }

    // 添加通用參數
    const enrichedParams: Record<string, any> = {
      ...parameters,
      user_id: this.userId,
      session_id: this.sessionStartTime.toString(),
      timestamp: new Date().toISOString()
    };

    // 移除 undefined 值
    Object.keys(enrichedParams).forEach(key => {
      if (enrichedParams[key] === undefined) {
        delete enrichedParams[key];
      }
    });

    window.gtag('event', eventName, enrichedParams);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('GA4 Event sent:', eventName, enrichedParams);
    }
  }

  // ===== HELPER METHODS =====

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private getRetentionDay(daysSinceSignup: number): string {
    if (daysSinceSignup === 0) return 'D0';
    if (daysSinceSignup === 1) return 'D1';
    if (daysSinceSignup === 7) return 'D7';
    if (daysSinceSignup === 14) return 'D14';
    if (daysSinceSignup === 30) return 'D30';
    if (daysSinceSignup === 60) return 'D60';
    if (daysSinceSignup === 90) return 'D90';
    return `D${daysSinceSignup}`;
  }

  // 取得當前 session ID
  getSessionId(): string {
    return this.sessionStartTime.toString();
  }

  // 取得當前 user ID
  getUserId(): string | null {
    return this.userId;
  }
}

// 創建單例實例
export const ga4 = GA4Service.getInstance();

// 匯出類型定義
export type { UserProperties, EventParameters };