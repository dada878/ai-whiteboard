import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function PlusPage() {
  const session = await getServerSession(authOptions);
  const isPlus = Boolean(session?.user && (session.user as { isPlus?: boolean }).isPlus);

  const bmcUsername = process.env.NEXT_PUBLIC_BMC_USERNAME || '';
  const coffeeText = process.env.NEXT_PUBLIC_BMC_BUTTON_TEXT || 'Buy Me a Coffee';
  const bmcLink = bmcUsername ? `https://www.buymeacoffee.com/${bmcUsername}` : 'https://www.buymeacoffee.com/';

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-4">升級 Plus</h1>
      <p className="text-gray-600 mb-8">解鎖高級 AI 功能、更快的處理速度與更多便利貼工具。</p>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="p-6 rounded-xl border border-gray-200 bg-white">
          <h2 className="text-xl font-semibold mb-3">Plus 特色</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✅ 進階 AI 發想與結構分析</li>
            <li>✅ 批次自動連線與整理</li>
            <li>✅ 更高的速率與配額</li>
            <li>✅ 優先功能預覽</li>
          </ul>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 bg-white">
          <h2 className="text-xl font-semibold mb-3">價格</h2>
          <p className="text-4xl font-bold mb-1">$3</p>
          <p className="text-sm text-gray-600 mb-6">一次性支持，即可獲得 Plus（測試版）</p>
          {isPlus ? (
            <div className="text-green-600 font-medium">您已是 Plus 會員 🎉</div>
          ) : (
            <a
              href={bmcLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold"
            >
              ☕ {coffeeText}
            </a>
          )}
          <p className="text-xs text-gray-500 mt-3">完成付款後，系統會自動透過 Webhook 升級您的帳號。</p>
        </div>
      </div>

      <div className="p-6 rounded-xl border border-gray-200 bg-white">
        <h2 className="text-xl font-semibold mb-3">如何生效？</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>前往 Buy Me a Coffee 完成支持。</li>
          <li>Webhook 會通知我們，將您的 Email 授權為 Plus。</li>
          <li>如果已登入，最多 1 分鐘內會自動更新；或重新整理頁面。</li>
        </ol>
        <p className="text-xs text-gray-500 mt-4">
          如果沒有自動升級，請使用相同 Email 登入，或聯繫我們手動協助。
        </p>
        <div className="mt-6">
          <Link href="/" className="text-blue-600 hover:underline text-sm">返回首頁</Link>
        </div>
      </div>
    </div>
  );
}


