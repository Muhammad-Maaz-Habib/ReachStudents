import type { UserRole } from "@/generated/prisma/browser";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      organizationId: string | null;
      organizationName: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    organizationId: string | null;
    organizationName: string | null;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    organizationId: string | null;
    organizationName: string | null;
    mustChangePassword: boolean;
  }
}
