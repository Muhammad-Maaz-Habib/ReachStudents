import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const log =
    process.env.NODE_ENV === "development"
      ? (["error", "warn"] as const)
      : (["error"] as const);

  if (
    databaseUrl.startsWith("prisma+") ||
    databaseUrl.startsWith("prisma://")
  ) {
    return new PrismaClient({
      accelerateUrl: databaseUrl,
      log: [...log],
    });
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: [...log],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
