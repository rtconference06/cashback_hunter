import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function getOwner() {
  const email = process.env.OWNER_EMAIL?.trim() || process.env.DIGEST_TO?.trim() || "owner@localhost";
  const name = process.env.OWNER_NAME?.trim() || "Owner";
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
}
