import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import type { Role } from "@/lib/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      orgId?: string | null;
      customerId?: string | null;
      locale?: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    orgId?: string | null;
    customerId?: string | null;
    locale?: string | null;
  }
}

// next-auth v5 reexports JWT types from @auth/core/jwt; augment there to keep
// `token.role` (and friends) typed on both the jwt() and session() callbacks.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    orgId?: string | null;
    customerId?: string | null;
    locale?: string | null;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as Role,
          orgId: user.orgId,
          customerId: user.customerId,
          locale: user.locale,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.orgId = user.orgId;
        token.customerId = user.customerId;
        token.locale = user.locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id ?? "") as string;
        session.user.role = (token.role ?? "DISPATCHER") as Role;
        session.user.orgId = (token.orgId ?? null) as string | null;
        session.user.customerId = (token.customerId ?? null) as string | null;
        session.user.locale = (token.locale ?? null) as string | null;
      }
      return session;
    },
  },
});
