'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const AdminSetup: React.FC = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // 自動填入當前用戶的 email
    if (user?.email) {
      setEmail(user.email);
    }
    
    // 檢查當前用戶的管理員狀態
    checkCurrentStatus();
    loadDebugInfo();
  }, [user]);

  const checkCurrentStatus = async () => {
    try {
      const response = await fetch('/api/admin/grant-access');
      const data = await response.json();
      setCurrentStatus(data);
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const loadDebugInfo = async () => {
    try {
      const response = await fetch('/api/admin/debug');
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      console.error('Failed to load debug info:', error);
    }
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/admin/grant-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, secretKey }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(`✅ 成功！${data.message}`);
        checkCurrentStatus(); // 重新檢查狀態
        loadDebugInfo(); // 重新載入調試信息
      } else {
        setResult(`❌ 錯誤：${data.error}`);
      }
    } catch (error) {
      setResult(`❌ 網路錯誤：${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              管理員權限設定
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              設定您的管理員權限以訪問後台面板
            </p>
          </div>

          {/* 當前狀態 */}
          {currentStatus && (
            <div className={`mb-6 p-4 rounded-lg ${
              currentStatus.isAdmin 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            }`}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                當前狀態
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Email:</strong> {currentStatus.email}</p>
                <p><strong>管理員權限:</strong> {currentStatus.isAdmin ? '✅ 是' : '❌ 否'}</p>
                {currentStatus.role && <p><strong>角色:</strong> {currentStatus.role}</p>}
                {currentStatus.adminGrantedAt && (
                  <p><strong>權限授予時間:</strong> {new Date(currentStatus.adminGrantedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}

          {!currentStatus?.isAdmin && (
            <form onSubmit={handleGrantAccess} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email 地址
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  設定密鑰
                </label>
                <input
                  type="password"
                  id="secretKey"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="請輸入設定密鑰"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  請向系統管理員獲取密鑰，或查看環境變量 ADMIN_SETUP_SECRET
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? '處理中...' : '授予管理員權限'}
              </button>
            </form>
          )}

          {currentStatus?.isAdmin && (
            <div className="text-center">
              <p className="text-green-600 dark:text-green-400 mb-4">
                🎉 您已擁有管理員權限！
              </p>
              <a
                href="/admin"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                前往管理後台
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}

          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              result.includes('✅') 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}>
              {result}
            </div>
          )}

          {/* 調試信息 */}
          {debugInfo && (
            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                🔍 調試信息
              </h3>
              
              {/* 環境變量信息 */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">環境變量</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 font-mono">
                  <div><strong>NODE_ENV:</strong> {debugInfo.debugInfo?.environment?.NODE_ENV}</div>
                  <div><strong>ADMIN_EMAILS:</strong> {debugInfo.debugInfo?.environment?.adminEmailsEnv}</div>
                  <div><strong>解析後的管理員列表:</strong> [{debugInfo.debugInfo?.environment?.adminEmails?.join(', ')}]</div>
                </div>
              </div>

              {/* 權限檢查結果 */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">權限檢查</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>✉️ 當前 Email: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{debugInfo.debugInfo?.userEmail}</code></div>
                  <div>📋 Email 在管理員列表中: {debugInfo.debugInfo?.checks?.isAdminEmail ? '✅' : '❌'}</div>
                  <div>👤 用戶資料庫存在: {debugInfo.debugInfo?.userExists ? '✅' : '❌'}</div>
                  <div>🔑 資料庫中有管理員角色: {debugInfo.debugInfo?.checks?.hasAdminRole ? '✅' : '❌'}</div>
                  <div>🏠 開發環境 @admin 域名: {debugInfo.debugInfo?.checks?.hasAdminDomain ? '✅' : '❌'}</div>
                  <div className="font-semibold">🎯 最終結果: {debugInfo.debugInfo?.checks?.finalIsAdmin ? '✅ 有權限' : '❌ 無權限'}</div>
                </div>
              </div>

              {/* 用戶資料 */}
              {debugInfo.debugInfo?.userData && (
                <div>
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">用戶資料</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>角色: {debugInfo.debugInfo.userData.role || '未設定'}</div>
                    <div>isAdmin: {debugInfo.debugInfo.userData.isAdmin ? '是' : '否'}</div>
                    {debugInfo.debugInfo.userData.adminGrantedAt && (
                      <div>權限授予時間: {new Date(debugInfo.debugInfo.userData.adminGrantedAt).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={loadDebugInfo}
                className="mt-3 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                重新載入調試信息
              </button>
            </div>
          )}

          {/* 說明部分 */}
          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              獲得管理員權限的方法：
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>1. 使用正確的設定密鑰（ADMIN_SETUP_SECRET）</li>
              <li>2. 在環境變量 NEXT_PUBLIC_ADMIN_EMAILS 中添加您的 email</li>
              <li>3. 開發環境下使用包含 @admin. 的測試郵箱</li>
              <li className="text-yellow-600 dark:text-yellow-400 font-medium">⚠️ 修改環境變量後需要重啟開發服務器！</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;