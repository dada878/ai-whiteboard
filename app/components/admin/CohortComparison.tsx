'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

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

interface Props {
  recentWeeks: string[];
}

export default function CohortComparison({ recentWeeks }: Props) {
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [cohortData, setCohortData] = useState<CohortSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparisonType, setComparisonType] = useState<'retention' | 'activity' | 'conversion'>('retention');

  // 載入選中週次的數據
  const loadSelectedCohorts = async () => {
    if (selectedWeeks.length === 0) return;
    
    setLoading(true);
    try {
      const cohorts: CohortSummary[] = [];
      
      for (const week of selectedWeeks) {
        const response = await fetch(`/api/admin/cohorts?action=summary&cohortWeek=${week}`);
        const data = await response.json();
        
        if (response.ok && data.summary) {
          cohorts.push({
            ...data.summary,
            startDate: new Date(data.summary.startDate),
            endDate: new Date(data.summary.endDate),
            lastUpdated: new Date(data.summary.lastUpdated)
          });
        }
      }
      
      setCohortData(cohorts.sort((a, b) => a.cohortWeek.localeCompare(b.cohortWeek)));
    } catch (error) {
      console.error('Error loading cohort data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSelectedCohorts();
  }, [selectedWeeks]);

  // 處理週次選擇
  const handleWeekToggle = (week: string) => {
    setSelectedWeeks(prev => {
      if (prev.includes(week)) {
        return prev.filter(w => w !== week);
      } else if (prev.length < 4) { // 最多選擇4個週次
        return [...prev, week];
      }
      return prev;
    });
  };

  // 準備比較數據
  const getComparisonData = () => {
    switch (comparisonType) {
      case 'retention':
        return cohortData.map(cohort => ({
          week: cohort.cohortWeek,
          totalUsers: cohort.totalUsers,
          week1: cohort.retentionRates.week1,
          week2: cohort.retentionRates.week2,
          week3: cohort.retentionRates.week3,
          week4: cohort.retentionRates.week4,
        }));
      
      case 'activity':
        return cohortData.map(cohort => ({
          week: cohort.cohortWeek,
          sessions: cohort.avgSessionsPerUser,
          notes: cohort.avgNotesPerUser,
          aiOps: cohort.avgAIOperationsPerUser,
          duration: cohort.avgSessionDuration,
        }));
      
      case 'conversion':
        return cohortData.map(cohort => ({
          week: cohort.cohortWeek,
          conversionRate: cohort.premiumConversionRate,
          timeToConversion: cohort.avgTimeToConversion,
          totalUsers: cohort.totalUsers,
        }));
      
      default:
        return [];
    }
  };

  const comparisonData = getComparisonData();

  // 計算週間變化
  const getWeekOverWeekChange = (metric: keyof CohortSummary['retentionRates'] | 'avgNotesPerUser' | 'avgSessionsPerUser' | 'premiumConversionRate') => {
    if (cohortData.length < 2) return null;
    
    const latest = cohortData[cohortData.length - 1];
    const previous = cohortData[cohortData.length - 2];
    
    let latestValue, previousValue;
    
    if (metric in latest.retentionRates) {
      latestValue = latest.retentionRates[metric as keyof typeof latest.retentionRates];
      previousValue = previous.retentionRates[metric as keyof typeof previous.retentionRates];
    } else {
      latestValue = latest[metric as keyof CohortSummary] as number;
      previousValue = previous[metric as keyof CohortSummary] as number;
    }
    
    const change = ((latestValue - previousValue) / previousValue) * 100;
    return {
      value: change,
      positive: change > 0,
      latestValue,
      previousValue
    };
  };

  return (
    <div className="space-y-6">
      {/* 週次選擇器 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          選擇要比較的週次 (最多4個)
        </h3>
        <div className="flex flex-wrap gap-2">
          {recentWeeks.map(week => (
            <button
              key={week}
              onClick={() => handleWeekToggle(week)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedWeeks.includes(week)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${selectedWeeks.length >= 4 && !selectedWeeks.includes(week) ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedWeeks.length >= 4 && !selectedWeeks.includes(week)}
            >
              {week}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          已選擇 {selectedWeeks.length}/4 個週次
        </p>
      </div>

      {selectedWeeks.length > 0 && (
        <>
          {/* 比較類型選擇器 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">比較維度:</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setComparisonType('retention')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    comparisonType === 'retention'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  留存率
                </button>
                <button
                  onClick={() => setComparisonType('activity')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    comparisonType === 'activity'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  活動指標
                </button>
                <button
                  onClick={() => setComparisonType('conversion')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    comparisonType === 'conversion'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  轉換指標
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">載入比較數據...</span>
              </div>
            </div>
          ) : (
            <>
              {/* 週間變化摘要 */}
              {cohortData.length >= 2 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    週間變化摘要 ({cohortData[cohortData.length - 2].cohortWeek} → {cohortData[cohortData.length - 1].cohortWeek})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { key: 'week1' as const, label: '第1週留存率', suffix: '%' },
                      { key: 'avgNotesPerUser' as const, label: '平均便利貼數', suffix: '個' },
                      { key: 'avgSessionsPerUser' as const, label: '平均會話數', suffix: '次' },
                      { key: 'premiumConversionRate' as const, label: '轉換率', suffix: '%' }
                    ].map(({ key, label, suffix }) => {
                      const change = getWeekOverWeekChange(key);
                      return (
                        <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {change?.latestValue.toFixed(1)}{suffix}
                            </span>
                            {change && (
                              <span className={`text-sm font-medium flex items-center ${
                                change.positive ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {change.positive ? '↗' : '↘'} {Math.abs(change.value).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 比較圖表 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {comparisonType === 'retention' && '留存率比較'}
                  {comparisonType === 'activity' && '活動指標比較'}
                  {comparisonType === 'conversion' && '轉換指標比較'}
                </h3>
                
                <ResponsiveContainer width="100%" height={400}>
                  {comparisonType === 'retention' ? (
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                      <Legend />
                      <Bar dataKey="week1" fill="#8884d8" name="第1週留存" />
                      <Bar dataKey="week2" fill="#82ca9d" name="第2週留存" />
                      <Bar dataKey="week3" fill="#ffc658" name="第3週留存" />
                      <Bar dataKey="week4" fill="#ff7c7c" name="第4週留存" />
                    </BarChart>
                  ) : comparisonType === 'activity' ? (
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sessions" fill="#8884d8" name="平均會話數" />
                      <Bar dataKey="notes" fill="#82ca9d" name="平均便利貼數" />
                      <Bar dataKey="aiOps" fill="#ffc658" name="平均AI操作數" />
                    </BarChart>
                  ) : (
                    <LineChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip formatter={(value: number, name: string) => [
                        name === 'conversionRate' ? `${value.toFixed(1)}%` : `${value.toFixed(1)}天`,
                        name === 'conversionRate' ? '轉換率' : '平均轉換時間'
                      ]} />
                      <Legend />
                      <Line type="monotone" dataKey="conversionRate" stroke="#8884d8" name="轉換率 (%)" />
                      <Line type="monotone" dataKey="timeToConversion" stroke="#82ca9d" name="轉換時間 (天)" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* 詳細比較表格 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">詳細數據比較</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">週次</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">用戶數</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">第1週留存</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">第4週留存</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">平均便利貼</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">平均會話</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">轉換率</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {cohortData.map((cohort) => (
                        <tr key={cohort.cohortWeek} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {cohort.cohortWeek}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {cohort.totalUsers}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {cohort.retentionRates.week1.toFixed(1)}%
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {cohort.retentionRates.week4.toFixed(1)}%
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {cohort.avgNotesPerUser.toFixed(1)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {cohort.avgSessionsPerUser.toFixed(1)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {cohort.premiumConversionRate.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}