import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import AuthButton from "./components/AuthButton";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Whiteboard",
  description: "AI 協作白板工具",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const isPlus = Boolean(session?.user && (session.user as { isPlus?: boolean }).isPlus);
  return (
    <html lang="zh-TW" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <Providers>
          <header className="w-full border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="text-lg font-semibold">AI Whiteboard</Link>
              <div className="flex items-center gap-3">
                {!isPlus && (
                  <Link href="/plus" className="text-sm px-3 py-1.5 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200">升級 Plus</Link>
                )}
                <AuthButton />
              </div>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
