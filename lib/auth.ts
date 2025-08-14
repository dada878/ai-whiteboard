import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import '@/app/config/firebase-admin';

export const authOptions: NextAuthOptions = {
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
    strategy: "jwt",
  },
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // persist email for pregrant claim checks
        if ((user as { email?: string }).email) token.email = (user as { email?: string }).email;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      // Attach plan info (free/plus) from Firestore user profile
      try {
        if (token.id) {
          const db = getFirestore();
          // Store plan in collection users with doc id equal to user id or email fallback
          const userDocRef = db.collection('users').doc(String(token.id));
          const snap = await userDocRef.get();
          const now = Date.now();
          const shouldRefresh = !token.planCheckAt || (now - (token.planCheckAt as number)) > 60_000; // refresh every 60s
          if (shouldRefresh) {
            if (snap.exists) {
              const data = snap.data() as { plan?: 'free' | 'plus'; email?: string; name?: string } | undefined;
              token.plan = data?.plan || 'free';
              // ensure token has email for pregrant claim
              if (!token.email && data?.email) token.email = data.email;
              // sync display name from Firestore if present
              if (data?.name) token.name = data.name;
              // Auto-claim pregrants by email
              const email: string | undefined = token.email || data?.email;
              if (email && token.plan === 'free') {
                const preDoc = await db.collection('plus_pregrants').doc(email.toLowerCase()).get();
                if (preDoc.exists) {
                  await userDocRef.set({ plan: 'plus', plusGrantedAt: new Date(), plusSource: 'bmc-pregrant' }, { merge: true });
                  await db.collection('plus_pregrants').doc(email.toLowerCase()).delete();
                  token.plan = 'plus';
                }
              }
            } else {
              token.plan = 'free';
            }
            token.planCheckAt = now;
          }
        }
      } catch (e) {
        // Fallback to free on any error
        token.plan = token.plan || 'free';
      }
      return token;
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        const plan = (token.plan as 'free' | 'plus') || 'free';
        session.user.plan = plan;
        session.user.isPlus = plan === 'plus';
        if (token.name) {
          session.user.name = token.name as string;
        }
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