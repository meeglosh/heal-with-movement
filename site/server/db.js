import { neon, types } from "@neondatabase/serverless";
// PostgreSQL DATE is a calendar date, not a timestamp. Keep birth dates timezone-free.
types.setTypeParser(types.builtins.DATE, (value) => value);
export function database(env) {
  if (!env.DATABASE_URL) throw new Error("Database not configured");
  const sql = neon(env.DATABASE_URL);
  return { query: (text, params = []) => sql.query(text, params) };
}
