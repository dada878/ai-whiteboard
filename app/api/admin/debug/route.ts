import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb as db } from '../../../config/firebase-admin';

// 調試 API - 顯示詳細的權限檢查信息
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = session.user.email;

    // 環境變量檢查
    const adminEmailsEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    const adminEmails = adminEmailsEnv?.split(',').map(email => email.trim()) || [];
    const isAdminEmail = adminEmails.includes(userEmail);

    // 查找用戶資料
    let userData = null;
    let userExists = false;
    try {
      const usersSnapshot = await db.collection('users')
        .where('email', '==', userEmail)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        userExists = true;
        userData = usersSnapshot.docs[0].data();
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // 權限檢查邏輯
    const isDev = process.env.NODE_ENV === 'development';
    const hasAdminDomain = userEmail?.includes('@admin.');
    const hasAdminRole = userData?.role === 'admin' || userData?.isAdmin === true;

    const finalIsAdmin = isAdminEmail || hasAdminRole || (isDev && hasAdminDomain);

    const debugInfo = {
      userEmail,
      userExists,
      userData: userData ? {
        role: userData.role,
        isAdmin: userData.isAdmin,
        adminGrantedAt: userData.adminGrantedAt?.toDate()?.toISOString(),
        createdAt: userData.createdAt?.toDate()?.toISOString()
      } : null,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        adminEmailsEnv,
        adminEmails,
        isDev
      },
      checks: {
        isAdminEmail,
        hasAdminRole,
        hasAdminDomain,
        finalIsAdmin
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({ 
      isAdmin: finalIsAdmin,
      debugInfo
    });

  } catch (error) {
    console.error('Error in debug API:', error);
    return NextResponse.json(
      { 
        error: 'Debug API failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}