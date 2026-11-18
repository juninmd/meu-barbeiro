import { PrismaClient } from "@prisma/client";
import prismaConfig from "../../prisma.config";

export const prisma = new PrismaClient({
  datasources: {
    db: { url: prismaConfig.datasources.db.url },
  },
});