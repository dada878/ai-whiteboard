'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, FunnelChart, Funnel, Cell } from 'recharts';
import CohortComparison from './CohortComparison';

interface CohortSummary {
  cohortWeek: string;
  startDate: Date;
  endDate: Date;
  totalUsers: number;
  retentionRates: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  avgSessionsPerUser: number;
  avgNotesPerUser: number;
  avgAIOperationsPerUser: number;
  avgSessionDuration: number;
  premiumConversionRate: number;
  avgTimeToConversion: number;
  retentionGrowth: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  lastUpdated: Date;
}

interface RetentionFunnelData {
  cohortWeek: string;
  totalUsers: number;
  retentionFunnel: {
    week0: number;
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  retentionRates: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
}

export default function CohortAnalysis() {
  const [cohortSummaries, setCohortSummaries] = useState<CohortSummary[]>([]);
  const [retentionFunnel, setRetentionFunnel] = useState<RetentionFunnelData | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [recentWeeks, setRecentWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(8);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'comparison'>('overview');

  // 獲取最近的群組週列表
  const fetchRecentWeeks = async () => {
    try {
      const response = await fetch(`/api/admin/cohorts?action=recent-weeks&count=${timeRange}`);
      const data = await response.json();
      
      if (response.ok) {
        setRecentWeeks(data.weeks);
        if (data.weeks.length > 0 && !selectedCohort) {
          setSelectedCohort(data.weeks[data.weeks.length - 1]); // 選擇最新的週
        }
      } else {
        throw new Error(data.error || 'Failed to fetch recent weeks');
      }
    } catch (error) {
      console.error('Error fetching recent weeks:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // 獲取群組摘要數據
  const fetchCohortSummaries = async () => {
    if (recentWeeks.length === 0) return;
    
    try {
      const startWeek = recentWeeks[0];
      const endWeek = recentWeeks[recentWeeks.length - 1];
      
      const response = await fetch(`/api/admin/cohorts?action=summaries&startWeek=${startWeek}&endWeek=${endWeek}`);
      const data = await response.json();
      
      if (response.ok) {
        const summaries = data.summaries.map((summary: any) => ({
          ...summary,
          startDate: new Date(summary.startDate),
          endDate: new Date(summary.endDate),
          lastUpdated: new Date(summary.lastUpdated)
        }));
        setCohortSummaries(summaries);
      } else {
        throw new Error(data.error || 'Failed to fetch cohort summaries');
      }
    } catch (error) {
      console.error('Error fetching cohort summaries:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // 獲取特定群組的留存漏斗數據
  const fetchRetentionFunnel = async (cohortWeek: string) => {
    if (!cohortWeek) return;
    
    try {
      const response = await fetch(`/api/admin/cohorts?action=retention-funnel&cohortWeek=${cohortWeek}`);
      const data = await response.json();
      
      if (response.ok) {
        setRetentionFunnel(data);
      } else {
        throw new Error(data.error || 'Failed to fetch retention funnel');
      }
    } catch (error) {
      console.error('Error fetching retention funnel:', error);
    }
  };

  // 重新計算群組數據
  const recalculateAllCohorts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate-all' })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        await fetchCohortSummaries();
        alert('群組數據重新計算完成！');
      } else {
        throw new Error(data.error || 'Failed to recalculate cohorts');
      }
    } catch (error) {
      console.error('Error recalculating cohorts:', error);
      alert('重新計算失敗：' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentWeeks();
  }, [timeRange]);

  useEffect(() => {
    if (recentWeeks.length > 0) {
      fetchCohortSummaries();
    }
  }, [recentWeeks]);

  useEffect(() => {
    if (selectedCohort) {
      fetchRetentionFunnel(selectedCohort);
    }
  }, [selectedCohort]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRecentWeeks(), fetchCohortSummaries()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // 準備留存率趨勢圖數據
  const retentionTrendData = cohortSummaries.map(summary => ({
    week: summary.cohortWeek,
    week1: summary.retentionRates.week1,
    week2: summary.retentionRates.week2,
    week3: summary.retentionRates.week3,
    week4: summary.retentionRates.week4,
    totalUsers: summary.totalUsers
  }));

  // 準備用戶活動趨勢數據
  const activityTrendData = cohortSummaries.map(summary => ({
    week: summary.cohortWeek,
    avgSessions: summary.avgSessionsPerUser,
    avgNotes: summary.avgNotesPerUser,
    avgAI: summary.avgAIOperationsPerUser,
    avgDuration: summary.avgSessionDuration
  }));

  // 準備留存漏斗圖數據
  const funnelData = retentionFunnel ? [
    { name: '註冊用戶', value: retentionFunnel.retentionFunnel.week0, fill: '#8884d8' },
    { name: '第1週留存', value: retentionFunnel.retentionFunnel.week1, fill: '#82ca9d' },
    { name: '第2週留存', value: retentionFunnel.retentionFunnel.week2, fill: '#ffc658' },
    { name: '第3週留存', value: retentionFunnel.retentionFunnel.week3, fill: '#ff7c7c' },
    { name: '第4週留存', value: retentionFunnel.retentionFunnel.week4, fill: '#8dd1e1' }
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">載入群組分析數據...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h3 className="text-red-800 font-medium">載入錯誤</h3>
        <p className="text-red-600 mt-1">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">時間群組分析</h2>
          <div className="flex items-center space-x-4">
            {activeSubTab === 'overview' && (
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={4}>最近 4 週</option>
                <option value={8}>最近 8 週</option>
                <option value={12}>最近 12 週</option>
                <option value={16}>最近 16 週</option>
              </select>
            )}
            <button
              onClick={recalculateAllCohorts}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              重新計算數據
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">總群組數</h3>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{cohortSummaries.length}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-600 dark:text-green-400">總用戶數</h3>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {cohortSummaries.reduce((sum, c) => sum + c.totalUsers, 0)}
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">平均第1週留存率</h3>
            <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
              {cohortSummaries.length > 0 ? 
                (cohortSummaries.reduce((sum, c) => sum + c.retentionRates.week1, 0) / cohortSummaries.length).toFixed(1) + '%' 
                : '0%'}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-600 dark:text-purple-400">平均轉換率</h3>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {cohortSummaries.length > 0 ? 
                (cohortSummaries.reduce((sum, c) => sum + c.premiumConversionRate, 0) / cohortSummaries.length).toFixed(1) + '%' 
                : '0%'}
            </p>
          </div>
        </div>
        
        {/* 子標籤導航 */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeSubTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              總覽分析
            </button>
            <button
              onClick={() => setActiveSubTab('comparison')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeSubTab === 'comparison'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              週間比較
            </button>
          </nav>
        </div>
      </div>

      {activeSubTab === 'overview' && (
        <>
          {/* 留存率趨勢圖 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">留存率趨勢</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={retentionTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
            <Legend />
            <Line type="monotone" dataKey="week1" stroke="#8884d8" name="第1週留存" />
            <Line type="monotone" dataKey="week2" stroke="#82ca9d" name="第2週留存" />
            <Line type="monotone" dataKey="week3" stroke="#ffc658" name="第3週留存" />
            <Line type="monotone" dataKey="week4" stroke="#ff7c7c" name="第4週留存" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 用戶活動趨勢 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">用戶活動趨勢</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={activityTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="avgSessions" fill="#8884d8" name="平均會話數" />
            <Bar dataKey="avgNotes" fill="#82ca9d" name="平均便利貼數" />
            <Bar dataKey="avgAI" fill="#ffc658" name="平均AI操作數" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 特定群組留存漏斗 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">群組留存漏斗</h3>
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選擇群組週</option>
            {recentWeeks.map(week => (
              <option key={week} value={week}>{week}</option>
            ))}
          </select>
        </div>
        
        {retentionFunnel && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">留存詳情</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>總註冊用戶:</span>
                  <span className="font-semibold">{retentionFunnel.totalUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span>第1週留存:</span>
                  <span className="font-semibold">{retentionFunnel.retentionFunnel.week1} ({retentionFunnel.retentionRates.week1.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>第2週留存:</span>
                  <span className="font-semibold">{retentionFunnel.retentionFunnel.week2} ({retentionFunnel.retentionRates.week2.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>第3週留存:</span>
                  <span className="font-semibold">{retentionFunnel.retentionFunnel.week3} ({retentionFunnel.retentionRates.week3.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>第4週留存:</span>
                  <span className="font-semibold">{retentionFunnel.retentionFunnel.week4} ({retentionFunnel.retentionRates.week4.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 群組對比表格 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">群組對比</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">群組週</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">用戶數</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">第1週留存</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">第2週留存</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">第3週留存</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">第4週留存</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">平均便利貼</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">轉換率</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {cohortSummaries.map((summary) => (
                <tr key={summary.cohortWeek} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {summary.cohortWeek}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {summary.totalUsers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {summary.retentionRates.week1.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {summary.retentionRates.week2.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {summary.retentionRates.week3.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {summary.retentionRates.week4.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {summary.avgNotesPerUser.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {summary.premiumConversionRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {activeSubTab === 'comparison' && (
        <CohortComparison recentWeeks={recentWeeks} />
      )}
    </div>
  );
}