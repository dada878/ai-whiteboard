import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { cert } from "firebase-admin/app";

const authOptions = {
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    
    // Email/Password Provider
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // 這裡你可以實現自己的認證邏輯
        // 例如：檢查資料庫中的使用者
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        // TODO: 實現真實的密碼驗證
        // 暫時的示範邏輯
        if (credentials.email === "demo@example.com" && credentials.password === "demo123") {
          return {
            id: "1",
            email: credentials.email,
            name: "Demo User",
          };
        }
        
        return null;
      }
    })
  ],
  
  adapter: FirestoreAdapter({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    })
  }),
  
  session: {
    strategy: "jwt" as const,
  },
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  
  pages: {
    signIn: "/auth/signin", // 自定義登入頁面（可選）
    error: "/auth/error",   // 錯誤頁面（可選）
  },
  
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST, authOptions };