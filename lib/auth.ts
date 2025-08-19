import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
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
    })
    // 只使用 Google 登入，移除 Email/Password Provider
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
    async signIn({ user, account, profile }) {
      // Allow all users to sign in
      if (user?.email && account) {
        const db = getFirestore();
        
        // Use profiles collection for app data (not users which is for NextAuth)
        const profileRef = db.collection('profiles').doc(user.email);
        const profileDoc = await profileRef.get();
        
        if (!profileDoc.exists) {
          // New user - create profile and add to waitlist
          await profileRef.set({
            userId: user.id,
            email: user.email,
            name: user.name || '',
            createdAt: new Date().toISOString(),
            profileComplete: true,
            onboardingStatus: 'completed',
            isApproved: false, // Needs admin approval
            plan: 'free',
          }, { merge: true });
          
          // Add to waitlist for admin review
          await db.collection('waitlist').add({
            userId: user.email,
            email: user.email,
            name: user.name || 'User',
            status: 'pending',
            createdAt: new Date().toISOString(),
            source: 'direct-login',
          });
        }
      }
      
      return true;
    },
    
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // persist email for pregrant claim checks
        if ((user as { email?: string }).email) token.email = (user as { email?: string }).email;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      // Attach plan info (free/plus) from Firestore profile
      try {
        if (token.email) {
          const db = getFirestore();
          // Use profiles collection (not users which is for NextAuth)
          const profileRef = db.collection('profiles').doc(String(token.email));
          const snap = await profileRef.get();
          const now = Date.now();
          const shouldRefresh = !token.planCheckAt || (now - (token.planCheckAt as number)) > 60_000; // refresh every 60s
          if (shouldRefresh) {
            if (snap.exists) {
              const data = snap.data() as { 
                plan?: 'free' | 'plus'; 
                email?: string; 
                name?: string;
                profileComplete?: boolean;
                onboardingStatus?: string;
                school?: string;
                major?: string;
                isApproved?: boolean;
              } | undefined;
              token.plan = data?.plan || 'free';
              token.profileComplete = data?.profileComplete || false;
              token.onboardingStatus = data?.onboardingStatus || 'pending';
              token.isApproved = data?.isApproved || false;
              // ensure token has email for pregrant claim
              if (!token.email && data?.email) token.email = data.email;
              // sync display name from Firestore if present
              if (data?.name) token.name = data.name;
              // Auto-claim pregrants by email
              const email: string | undefined = token.email || data?.email;
              if (email && token.plan === 'free') {
                const preDoc = await db.collection('plus_pregrants').doc(email.toLowerCase()).get();
                if (preDoc.exists) {
                  await profileRef.set({ plan: 'plus', plusGrantedAt: new Date(), plusSource: 'bmc-pregrant' }, { merge: true });
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
        session.user.profileComplete = token.profileComplete as boolean || false;
        session.user.onboardingStatus = token.onboardingStatus as string || 'pending';
        session.user.isApproved = token.isApproved as boolean || false;
        // Admin check for special access
        const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
        session.user.isAdmin = session.user.email ? adminEmails.includes(session.user.email) : false;
        if (token.name) {
          session.user.name = token.name as string;
        }
      }
      return session;
    },
  },
  
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  
  debug: process.env.NODE_ENV === "development",
};