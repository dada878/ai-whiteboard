'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AnalyticsService } from '../services/analyticsService';
import { UserSegmentationChart } from '../components/admin/UserSegmentationChart';
import { RetentionChart } from '../components/admin/RetentionChart';
import { UsageTimeChart } from '../components/admin/UsageTimeChart';
import { KPICards } from '../components/admin/KPICards';
import { TimeRangeSelector } from '../components/admin/TimeRangeSelector';
import { UserSegmentFilter } from '../components/admin/UserSegmentFilter';
import CohortAnalysis from '../components/admin/CohortAnalysis';

type TimeRange = 'day' | 'week' | 'month' | 'quarter';
type UserSegment = 'all' | 'new' | 'returning' | 'premium' | 'free';

interface AnalyticsData {
  userStats: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    premiumUsers: number;
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
  usage: {
    avgSessionTime: number;
    avgNotesPerSession: number;
    avgAIOperations: number;
  };
  segmentation: {
    segments: Array<{
      name: string;
      count: number;
      percentage: number;
      growth: number;
    }>;
  };
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'cohort'>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedSegment, setSelectedSegment] = useState<UserSegment>('all');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 檢查管理員權限
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        setError('請先登入');
        setLoading(false);
        return;
      }

      try {
        // 使用客戶端環境變量進行簡單權限檢查
        console.log('Checking admin access for user:', user.email);
        
        const adminEmailsEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
        console.log('Admin emails env:', adminEmailsEnv);
        
        // 臨時硬編碼管理員列表，確保能正常工作
        const adminEmails = adminEmailsEnv 
          ? adminEmailsEnv.split(',').map(email => email.trim())
          : ['xx0932399@gmail.com', 'dada909090a@gmail.com']; // 臨時硬編碼
        console.log('Admin emails list:', adminEmails);
        console.log('User email:', user.email);
        
        const isAdminUser = user.email ? adminEmails.includes(user.email) : false;
        console.log('Is admin user:', isAdminUser);
        
        setIsAdmin(isAdminUser);
        console.log('Setting isAdmin to:', isAdminUser);
        if (!isAdminUser) {
          setError('無管理員權限');
        } else {
          setError(null); // 清除任何之前的錯誤
        }
      } catch (err) {
        console.error('Admin access error:', err);
        setError('權限檢查失敗');
      }
      setLoading(false);
    };

    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const data = await AnalyticsService.getAnalytics({
          timeRange,
          segment: selectedSegment
        });
        setAnalyticsData(data);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
        setError('數據載入失敗');
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, [timeRange, selectedSegment, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">載入中...</p>
        </div>
      </div>
    );
  }

  console.log('Render check - error:', error, 'isAdmin:', isAdmin);
  
  if (error || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error || '無管理員權限'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            請聯繫系統管理員獲取權限
          </p>
          <div className="mt-4 text-sm text-gray-500">
            Debug: error=&quot;{error}&quot;, isAdmin={isAdmin ? 'true' : 'false'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                AI Whiteboard 後台管理
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                用戶行為分析與留存追蹤
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {activeTab === 'overview' && (
                <>
                  <UserSegmentFilter 
                    value={selectedSegment}
                    onChange={setSelectedSegment}
                  />
                  <TimeRangeSelector 
                    value={timeRange}
                    onChange={setTimeRange}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              總覽分析
            </button>
            <button
              onClick={() => setActiveTab('cohort')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cohort'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              時間群組分析
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && analyticsData && (
          <>
            {/* KPI Cards */}
            <KPICards data={analyticsData.userStats} timeRange={timeRange} />

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              {/* 用戶分群分析 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  用戶分群分析
                </h3>
                <UserSegmentationChart 
                  data={analyticsData.segmentation}
                  timeRange={timeRange}
                />
              </div>

              {/* 留存率分析 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  留存率趨勢
                </h3>
                <RetentionChart 
                  data={analyticsData.retention}
                  timeRange={timeRange}
                  segment={selectedSegment}
                />
              </div>

              {/* 使用時間分析 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  使用行為分析
                </h3>
                <UsageTimeChart 
                  data={analyticsData.usage}
                  timeRange={timeRange}
                  segment={selectedSegment}
                />
              </div>
            </div>

            {/* 詳細數據表 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-8">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  詳細數據
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {analyticsData.usage.avgSessionTime}分鐘
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      平均會話時間
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analyticsData.usage.avgNotesPerSession}個
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      平均每次創建便利貼數
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {analyticsData.usage.avgAIOperations}次
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      平均AI操作次數
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'cohort' && (
          <CohortAnalysis />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;