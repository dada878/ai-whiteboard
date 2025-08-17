'use client';

import { useState, useEffect } from 'react';

interface VersionInfo {
  version: string;
  build: number;
  lastCommit: string;
  buildDate: string;
}

export default function VersionDisplay() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Load version info
    fetch('/version.json')
      .then(res => res.json())
      .then((data: VersionInfo) => setVersionInfo(data))
      .catch(err => console.log('Version info not available:', err));
  }, []);

  if (!versionInfo) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatCommit = (commit: string) => {
    return commit ? commit.substring(0, 7) : '';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg transition-all duration-200 ${
          isExpanded ? 'p-3' : 'p-2'
        }`}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {isExpanded ? (
          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 min-w-[120px]">
            <div className="font-semibold">v{versionInfo.version}</div>
            <div>Build #{versionInfo.build}</div>
            {versionInfo.lastCommit && (
              <div>Commit: {formatCommit(versionInfo.lastCommit)}</div>
            )}
            {versionInfo.buildDate && (
              <div>{formatDate(versionInfo.buildDate)}</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            v{versionInfo.version}.{versionInfo.build}
          </div>
        )}
      </div>
    </div>
  );
}