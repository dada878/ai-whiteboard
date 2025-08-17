import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminDb as db } from '../../../config/firebase-admin';

// 手動設定管理員權限的 API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, secretKey } = body;

    // 檢查密鑰（防止濫用）
    const expectedKey = process.env.ADMIN_SETUP_SECRET || 'your-super-secret-key-here';
    if (secretKey !== expectedKey) {
      return NextResponse.json({ error: 'Invalid secret key' }, { status: 403 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 查找用戶
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = usersSnapshot.docs[0];
    
    // 設定管理員權限
    await userDoc.ref.update({
      role: 'admin',
      isAdmin: true,
      adminGrantedAt: new Date(),
      adminGrantedBy: 'setup-api'
    });

    return NextResponse.json({ 
      success: true, 
      message: `Admin access granted to ${email}`,
      userId: userDoc.id
    });

  } catch (error) {
    console.error('Error granting admin access:', error);
    return NextResponse.json(
      { error: 'Failed to grant admin access' }, 
      { status: 500 }
    );
  }
}

// 查看當前用戶的權限狀態
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 查找當前用戶
    const usersSnapshot = await db.collection('users')
      .where('email', '==', session.user.email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ 
        isAdmin: false, 
        email: session.user.email,
        message: 'User not found in database'
      });
    }

    const userData = usersSnapshot.docs[0].data();
    const userEmail = session.user.email;
    
    // 使用和 AdminService 相同的邏輯檢查管理員權限
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
    const isAdminEmail = adminEmails.includes(userEmail);
    
    const isDev = process.env.NODE_ENV === 'development';
    const hasAdminDomain = userEmail?.includes('@admin.');
    const hasAdminRole = userData.role === 'admin' || userData.isAdmin === true;
    
    const isAdmin = isAdminEmail || hasAdminRole || (isDev && hasAdminDomain);

    return NextResponse.json({ 
      isAdmin,
      email: session.user.email,
      role: userData.role,
      adminGrantedAt: userData.adminGrantedAt?.toDate()?.toISOString(),
      // 調試信息
      debugChecks: {
        isAdminEmail,
        hasAdminRole,
        hasAdminDomain,
        adminEmails: process.env.NEXT_PUBLIC_ADMIN_EMAILS
      }
    });

  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status' }, 
      { status: 500 }
    );
  }
}