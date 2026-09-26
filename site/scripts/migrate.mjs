import { readFile, readdir } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL_UNPOOLED for the intended branch.");
const sql = neon(url);
await sql.query(
  "CREATE TABLE IF NOT EXISTS portal_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
);
const dir = new URL("../migrations/", import.meta.url);
for (const file of (await readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const id = file.replace(/\.sql$/, "");
  const existing = await sql.query(
    "SELECT id FROM portal_migrations WHERE id=$1",
    [id],
  );
  if (existing.length) {
    console.log(`${id}: already applied`);
    continue;
  }
  const migration = await readFile(new URL(file, dir), "utf8");
  await sql.transaction([
    ...migration
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => sql.query(s)),
    sql.query("INSERT INTO portal_migrations(id) VALUES($1)", [id]),
  ]);
  console.log(`${id}: applied`);
}
