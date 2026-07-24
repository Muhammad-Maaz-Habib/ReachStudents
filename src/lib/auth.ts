import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required behind Vercel/proxies so Auth.js trusts X-Forwarded-Host.
  // Also set AUTH_TRUST_HOST=true in Vercel; this makes it explicit in code.
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { organization: true },
        });

        if (!user?.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization?.name ?? null,
          organizationLogoUrl: user.organization?.logoUrl ?? null,
          organizationPrimaryColor: user.organization?.primaryColor ?? null,
          organizationSecondaryColor: user.organization?.secondaryColor ?? null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role as UserRole;
        token.organizationId = user.organizationId as string | null;
        token.organizationName = user.organizationName as string | null;
        token.organizationLogoUrl = user.organizationLogoUrl as string | null;
        token.organizationPrimaryColor =
          user.organizationPrimaryColor as string | null;
        token.organizationSecondaryColor =
          user.organizationSecondaryColor as string | null;
        token.mustChangePassword = Boolean(user.mustChangePassword);
      }

      if (trigger === "update") {
        if (token.sub) {
          const fresh = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              mustChangePassword: true,
              role: true,
              organizationId: true,
            },
          });
          if (fresh) {
            token.mustChangePassword = fresh.mustChangePassword;
            token.role = fresh.role;
            token.organizationId = fresh.organizationId;
          }
        }

        if (session && typeof session === "object") {
          if ("organizationName" in session) {
            token.organizationName =
              (session.organizationName as string | null) ?? null;
          }
          if ("organizationLogoUrl" in session) {
            token.organizationLogoUrl =
              (session.organizationLogoUrl as string | null) ?? null;
          }
        }
      }

      // Keep branding fresh from DB (name/logo edits without re-login).
      if (token.organizationId) {
        const org = await prisma.organization.findUnique({
          where: { id: token.organizationId as string },
          select: {
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
          },
        });
        if (org) {
          token.organizationName = org.name;
          token.organizationLogoUrl = org.logoUrl;
          token.organizationPrimaryColor = org.primaryColor;
          token.organizationSecondaryColor = org.secondaryColor;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.organizationId = token.organizationId as string | null;
        session.user.organizationName = token.organizationName as string | null;
        session.user.organizationLogoUrl =
          (token.organizationLogoUrl as string | null) ?? null;
        session.user.organizationPrimaryColor =
          (token.organizationPrimaryColor as string | null) ?? null;
        session.user.organizationSecondaryColor =
          (token.organizationSecondaryColor as string | null) ?? null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
});

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export function isStaffRole(role: UserRole) {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.SESSION_ADMIN ||
    role === UserRole.STAFF ||
    role === UserRole.NURSE
  );
}

export function isParentRole(role: UserRole) {
  return role === UserRole.PARENT;
}
