import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan?: 'free' | 'plus';
      isPlus?: boolean;
      profileComplete?: boolean;
      onboardingStatus?: string;
      isApproved?: boolean;
      isAdmin?: boolean;
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: 'free' | 'plus';
    planCheckAt?: number;
    profileComplete?: boolean;
    onboardingStatus?: string;
    isApproved?: boolean;
  }
}