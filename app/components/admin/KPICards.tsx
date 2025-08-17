'use client';

import React from 'react';

interface KPICardsProps {
  data: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    premiumUsers: number;
  };
  timeRange: string;
}

interface KPICardProps {
  title: string;
  value: number;
  change?: number;
  icon: string;
  color: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {value.toLocaleString()}
        </p>
        {change !== undefined && (
          <p className={`text-sm flex items-center mt-2 ${
            change >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            <span className="mr-1">
              {change >= 0 ? '↗' : '↘'}
            </span>
            {Math.abs(change)}%
          </p>
        )}
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  </div>
);

export const KPICards: React.FC<KPICardsProps> = ({ data, timeRange }) => {
  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case 'day': return '昨日';
      case 'week': return '本週';
      case 'month': return '本月';
      case 'quarter': return '本季';
      default: return '本期';
    }
  };

  const kpis = [
    {
      title: `總用戶數`,
      value: data.totalUsers,
      change: 12.5,
      icon: '👥',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: `${getTimeRangeLabel(timeRange)}活躍用戶`,
      value: data.activeUsers,
      change: 8.2,
      icon: '📈',
      color: 'bg-green-100 text-green-600'
    },
    {
      title: `${getTimeRangeLabel(timeRange)}新用戶`,
      value: data.newUsers,
      change: 15.7,
      icon: '✨',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Premium 用戶',
      value: data.premiumUsers,
      change: 23.1,
      icon: '💎',
      color: 'bg-yellow-100 text-yellow-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
};