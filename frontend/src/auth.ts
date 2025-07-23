import NextAuth, { type DefaultSession, NextAuthConfig } from "next-auth";
import { OAuthConfig } from "next-auth/providers";
import { JWT } from "next-auth/jwt";

export const configForTest = {
  jwt: {
    encode: async ({ token }) => {
      return btoa(JSON.stringify(token));
    },
    decode: async ({ token }) => {
      if (!token) {
        return {};
      }

      return JSON.parse(atob(token));
    },
  },
} satisfies Omit<NextAuthConfig, "providers">;

// Github OAuthとバックエンド側認証を行うための設定
const CustomOAuthProvider = {
  id: 'github-custom',
  name: 'github',
  type: 'oauth',
  authorization: { url: 'https://github.com/login/oauth/authorize', params: { scope: 'user' } },
  token: 'https://github.com/login/oauth/access_token',
  userinfo: {
    url: 'https://api.github.com/user',
    async request(context:any) {
      const res = await fetch('https://api.github.com/user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${context.tokens.access_token}`,
        },
      });
      let user = await res.json();
      const emailres = await fetch('https://api.github.com/user/emails', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${context.tokens.access_token}`,
        },
      });
      const email = await emailres.json();
      for(let i = 0; i < email.length; i++){
        if(email[i].primary){
          user.email = email[i].email;
          break;
        }
      }
      return user;
    },
  },
  clientId: process.env.AUTH_GITHUB_ID,
  clientSecret: process.env.AUTH_GITHUB_SECRET,
  profile(profile,token) {
    return {
      id: profile.id,
      name: profile?.name,
      email: profile?.email,
      image: profile?.avatar_url,
      access_token: token.access_token,
    }
  },
} as OAuthConfig<any>;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CustomOAuthProvider,
  ],
  trustHost: true,
  callbacks: {
    async jwt({ token,user,account,session}): Promise<JWT | null> {
      if(account && user){
        return {
          ...token,
          access_token: account.access_token ?? '',
          expires_at: account.expires_at ?? 0,
          refresh_token: account.refresh_token,
          user:{
            ...user
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.error = token.error
      session.user.access_token = token.access_token;
      return session
    },
  },
  ...(process.env.NEXTAUTH_TEST_MODE === "true" ? configForTest : {}),
}
);

declare module "next-auth" {
  interface Session {
    error?: "RefreshTokenError"
    user?: {
      id?: number,
      name?: string,
      email?: string,
      image?: string,
      access_token?: string,
      refresh_token?: string,
      expires_at?: number
      emailVerified? : boolean | null,
    }
  }
}
 
declare module "next-auth/jwt" {
  interface JWT {
    access_token: string
    expires_at: number
    refresh_token?: string
    error?: "RefreshTokenError"
  }
}
