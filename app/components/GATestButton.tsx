'use client';

import React, { useState } from 'react';
import * as gtag from '../../lib/gtag';

export default function GATestButton() {
  const [testCount, setTestCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<string>('');

  const sendTestEvent = () => {
    const count = testCount + 1;
    setTestCount(count);
    
    // 發送測試事件
    gtag.event({
      action: 'test_event',
      category: 'Test',
      label: `Test #${count}`,
      value: count,
      test_timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    });

    // 也發送一個便利貼創建事件測試
    gtag.trackNoteEvent('create', `test-note-${count}`, {
      test_mode: true,
      x_position: Math.random() * 1000,
      y_position: Math.random() * 1000
    });

    const eventInfo = `Test Event #${count} sent at ${new Date().toLocaleTimeString()}`;
    setLastEvent(eventInfo);
    console.log('📊 GA Test:', eventInfo);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
        GA4 測試工具
      </h3>
      
      <div className="space-y-2">
        <button
          onClick={sendTestEvent}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          發送測試事件
        </button>
        
        {testCount > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <p>已發送: {testCount} 個事件</p>
            {lastEvent && <p className="mt-1">{lastEvent}</p>}
          </div>
        )}
        
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
          <p className="font-semibold">檢查步驟:</p>
          <ol className="list-decimal list-inside mt-1 space-y-1">
            <li>開啟 GA4 即時報表</li>
            <li>點擊上方按鈕</li>
            <li>查看 &quot;test_event&quot; 是否出現</li>
            <li>檢查 Console 的 [GA Event] 訊息</li>
          </ol>
        </div>
        
        <div className="text-xs text-gray-400 dark:text-gray-600">
          Measurement ID: {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'Not Set'}
        </div>
      </div>
    </div>
  );
}