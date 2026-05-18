import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { serverEnv } from "@/lib/server/env";
import * as schema from "./schema";

export function createDatabaseClient(connectionString = serverEnv("DATABASE_URL")) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a database client.");
  }

  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export type PracticeLoopDatabase = ReturnType<typeof createDatabaseClient>;
