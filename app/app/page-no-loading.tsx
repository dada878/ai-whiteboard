import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Whiteboard from '../components/Whiteboard';
import Header from '../components/Header';

// 這是 Server Component - 在伺服器端執行，無需 loading！
export default async function AppPageNoLoading() {
  // 在伺服器端獲取 session
  const session = await getServerSession(authOptions);
  
  // 在伺服器端檢查權限
  if (!session?.user) {
    redirect('/');
  }
  
  if (!session.user.isApproved) {
    redirect('/');
  }
  
  // 直接渲染，沒有 loading 狀態！
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 overflow-hidden">
        <Whiteboard />
      </div>
    </div>
  );
}