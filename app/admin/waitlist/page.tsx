'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Check, X, Mail, Loader2, UserCheck, UserX, Clock } from 'lucide-react';
import { useTheme } from '@/app/contexts/ThemeContext';
import { isAdmin } from '@/app/utils/adminUtils';

interface WaitlistEntry {
  id: string;
  email: string;
  name: string;
  school: string;
  major: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export default function AdminWaitlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return;
    
    // Check if user is admin using environment variable
    const adminEmailsEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    const adminEmails = adminEmailsEnv 
      ? adminEmailsEnv.split(',').map(email => email.trim())
      : [];
    
    const isUserAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;
    
    if (!isUserAdmin) {
      console.log('Not admin, redirecting. Email:', session?.user?.email);
      console.log('Admin emails:', adminEmails);
      router.push('/');
    }
  }, [session, status, router]);

  // Fetch waitlist
  useEffect(() => {
    fetchWaitlist();
  }, [filter]);

  const fetchWaitlist = async () => {
    try {
      const response = await fetch(`/api/waitlist?status=${filter}`);
      const data = await response.json();
      setWaitlist(data.waitlist || []);
    } catch (error) {
      console.error('Failed to fetch waitlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/waitlist/${id}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchWaitlist();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/waitlist/${id}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchWaitlist();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
            <Clock className="w-3 h-3" />
            待審核
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
            <UserCheck className="w-3 h-3" />
            已通過
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
            <UserX className="w-3 h-3" />
            已拒絕
          </span>
        );
      default:
        return null;
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-dark-bg text-white' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Waiting List 管理</h1>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === tab
                  ? 'bg-purple-600 text-white'
                  : isDarkMode
                  ? 'bg-dark-bg-secondary text-gray-300 hover:bg-dark-bg-tertiary'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'all' && '全部'}
              {tab === 'pending' && '待審核'}
              {tab === 'approved' && '已通過'}
              {tab === 'rejected' && '已拒絕'}
            </button>
          ))}
        </div>

        {/* Waitlist Table */}
        <div className={`rounded-xl overflow-hidden shadow-lg ${
          isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    申請者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    學校/科系
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    申請原因
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    狀態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    申請時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {waitlist.map((entry) => (
                  <tr key={entry.id} className={isDarkMode ? 'hover:bg-dark-bg-tertiary' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium">{entry.name}</div>
                        <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {entry.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div>{entry.school}</div>
                        {entry.major && (
                          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {entry.major}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate" title={entry.reason}>
                        {entry.reason || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(entry.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-6 py-4">
                      {entry.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(entry.id)}
                            disabled={processingId === entry.id}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                            title="通過"
                          >
                            {processingId === entry.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(entry.id)}
                            disabled={processingId === entry.id}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                            title="拒絕"
                          >
                            {processingId === entry.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                      {entry.status === 'approved' && (
                        <button
                          className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          title="發送邀請信"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {waitlist.length === 0 && (
              <div className="text-center py-12">
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  沒有找到相關的申請
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}