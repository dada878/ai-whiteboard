'use client';

import React from 'react';

interface UsageTimeChartProps {
  data: {
    avgSessionTime: number;
    avgNotesPerSession: number;
    avgAIOperations: number;
  };
  timeRange: string;
  segment: string;
}

export const UsageTimeChart: React.FC<UsageTimeChartProps> = ({ data, timeRange, segment }) => {
  const metrics = [
    {
      label: '平均會話時間',
      value: data.avgSessionTime,
      unit: '分鐘',
      target: 15,
      icon: '⏱️',
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      label: '平均便利貼數',
      value: data.avgNotesPerSession,
      unit: '個/會話',
      target: 8,
      icon: '📝',
      color: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      label: '平均AI操作',
      value: data.avgAIOperations,
      unit: '次/會話',
      target: 5,
      icon: '🤖',
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    }
  ];

  // 模擬歷史趨勢數據
  const getTrendData = (current: number) => {
    return Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      value: current + (Math.random() - 0.5) * current * 0.3
    }));
  };

  return (
    <div className="space-y-6">
      {/* 核心指標卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric, index) => {
          const progress = Math.min((metric.value / metric.target) * 100, 100);
          const isGood = metric.value >= metric.target * 0.8;
          
          return (
            <div key={index} className={`p-6 ${metric.bgColor} rounded-lg`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{metric.icon}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {metric.label}
                  </span>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  isGood 
                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                }`}>
                  {isGood ? '良好' : '待改善'}
                </div>
              </div>
              
              <div className="mb-3">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
                  <span className="text-lg text-gray-600 dark:text-gray-400 ml-1">
                    {metric.unit}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  目標: {metric.target} {metric.unit}
                </div>
              </div>
              
              {/* 進度條 */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">達成率</span>
                  <span className="font-medium">{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${metric.color} transition-all duration-1000 ease-out`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 趨勢圖 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          近7日趨勢
        </h4>
        
        <div className="space-y-6">
          {metrics.map((metric, index) => {
            const trendData = getTrendData(metric.value);
            const maxValue = Math.max(...trendData.map(d => d.value));
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{metric.icon}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {metric.label}
                  </span>
                </div>
                
                <div className="flex items-end space-x-1 h-20">
                  {trendData.map((point, pointIndex) => (
                    <div key={pointIndex} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full ${metric.color} rounded-t transition-all duration-500 ease-out`}
                        style={{ 
                          height: `${(point.value / maxValue) * 100}%`,
                          minHeight: '4px'
                        }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-1">
                        {pointIndex + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 使用洞察 */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          🎯 使用行為洞察
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="font-medium text-gray-800 dark:text-gray-200">用戶參與度</div>
            <div className="text-gray-600 dark:text-gray-400">
              {data.avgSessionTime >= 12 
                ? '✅ 用戶停留時間充足，產品黏性良好'
                : '⚠️ 用戶停留時間較短，需提升產品吸引力'}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-gray-800 dark:text-gray-200">AI功能採用</div>
            <div className="text-gray-600 dark:text-gray-400">
              {data.avgAIOperations >= 2 
                ? '✅ AI功能使用活躍，價值獲得認可'
                : '💡 建議加強AI功能引導和教育'}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-gray-800 dark:text-gray-200">內容創建</div>
            <div className="text-gray-600 dark:text-gray-400">
              {data.avgNotesPerSession >= 5 
                ? '✅ 用戶創作積極，工具價值體現明顯'
                : '📈 可通過模板和引導提升創作頻率'}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-medium text-gray-800 dark:text-gray-200">建議行動</div>
            <div className="text-gray-600 dark:text-gray-400">
              • 優化新用戶 Onboarding 流程<br/>
              • 推送個性化AI功能建議<br/>
              • 增加協作功能提升黏性
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};