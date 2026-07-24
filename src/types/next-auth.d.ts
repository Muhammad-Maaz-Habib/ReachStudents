import type { UserRole } from "@/generated/prisma/browser";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      organizationId: string | null;
      organizationName: string | null;
      organizationLogoUrl: string | null;
      organizationPrimaryColor: string | null;
      organizationSecondaryColor: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    organizationId: string | null;
    organizationName: string | null;
    organizationLogoUrl: string | null;
    organizationPrimaryColor: string | null;
    organizationSecondaryColor: string | null;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    organizationId: string | null;
    organizationName: string | null;
    organizationLogoUrl: string | null;
    organizationPrimaryColor: string | null;
    organizationSecondaryColor: string | null;
    mustChangePassword: boolean;
  }
}
