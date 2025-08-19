import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  const { pathname } = request.nextUrl;
  
  // 準備 response
  let response: NextResponse;
  
  // 根路徑的智能路由
  if (pathname === '/') {
    if (token) {
      const isApproved = token.isApproved as boolean;
      
      if (isApproved) {
        response = NextResponse.rewrite(new URL('/app', request.url));
      } else {
        response = NextResponse.rewrite(new URL('/landing', request.url));
      }
    } else {
      response = NextResponse.rewrite(new URL('/landing', request.url));
    }
  }
  // 防止未登入或未批准用戶訪問 /app
  else if (pathname.startsWith('/app')) {
    if (!token) {
      response = NextResponse.redirect(new URL('/', request.url));
    } else {
      const isApproved = token.isApproved as boolean;
      if (!isApproved) {
        response = NextResponse.redirect(new URL('/', request.url));
      } else {
        response = NextResponse.next();
      }
    }
  } else {
    response = NextResponse.next();
  }
  
  // 把用戶資訊注入到 headers，前端可以直接使用！
  if (token) {
    response.headers.set('x-user-email', token.email as string || '');
    response.headers.set('x-user-approved', String(token.isApproved || false));
    response.headers.set('x-user-plan', token.plan as string || 'free');
    response.headers.set('x-user-name', token.name as string || '');
  }
  
  return response;
}