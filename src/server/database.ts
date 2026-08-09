import "server-only";
import postgres, { type Sql } from "postgres";

let database: Sql | null = null;

export function getDatabase(): Sql {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) throw new Error("SUPABASE_DATABASE_URL is required");
  database ??= postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
  return database;
}

export async function closeDatabaseForTests(): Promise<void> {
  if (!database) return;
  await database.end({ timeout: 1 });
  database = null;
}
