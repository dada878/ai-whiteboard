import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  const { pathname } = request.nextUrl;
  
  // 根路徑的智能路由 - 在伺服器端決定顯示什麼
  if (pathname === '/') {
    if (token) {
      // 檢查用戶是否已批准
      const isApproved = token.isApproved as boolean;
      
      if (isApproved) {
        // 已批准用戶 → 顯示主應用
        return NextResponse.rewrite(new URL('/app', request.url));
      } else {
        // 未批准用戶 → 顯示 Landing Page（會有 WaitlistDialog）
        return NextResponse.rewrite(new URL('/landing', request.url));
      }
    } else {
      // 未登入用戶 → 顯示 Landing Page
      return NextResponse.rewrite(new URL('/landing', request.url));
    }
  }
  
  // 防止未登入或未批准用戶訪問 /app
  if (pathname.startsWith('/app')) {
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    const isApproved = token.isApproved as boolean;
    if (!isApproved) {
      // 未批准用戶不能訪問 app
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match specific paths:
     * - / (root)
     * - /app and /app/*
     * - /landing
     * Exclude:
     * - /admin and /admin/* (admin routes)
     * - /api/* (API routes)
     * - /_next/* (Next.js internals)
     * - /auth/* (auth pages)
     */
    '/',
    '/app/:path*',
    '/landing',
  ],
};