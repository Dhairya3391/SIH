/**
 * Applies the SQL migrations in supabase/migrations, in order.
 *
 *   npm run db:push            apply anything not yet applied
 *   npm run db:push -- --reset drop the public schema first, then apply all
 *
 * Connects with the Postgres connection string rather than the REST API,
 * because migrations create extensions, types, triggers and policies that
 * PostgREST cannot express. Applied files are tracked in a small table, so
 * re-running is safe.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      "SUPABASE_DB_URL is not set.\n" +
        "Find it in Supabase under Project Settings, Database, Connection string, and copy the URI.\n" +
        "Put it in .env.local, and remember to substitute your database password for [YOUR-PASSWORD].",
    );
    process.exit(1);
  }

  const reset = process.argv.includes("--reset");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    if (reset) {
      console.log("Dropping and recreating the public schema.");
      await client.query(`
        drop schema if exists public cascade;
        create schema public;
        grant usage on schema public to anon, authenticated, service_role;
        grant all on schema public to postgres;
      `);
    }

    await client.query(`
      create table if not exists _jharsetu_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows: applied } = await client.query<{ name: string }>(
      "select name from _jharsetu_migrations",
    );
    const done = new Set(applied.map((r) => r.name));

    // Only the four-digit JharSetu migrations. The team's earlier skeleton file,
    // 001_initial_schema.sql, uses three digits and is deliberately left alone:
    // it describes the same tables and applying both would collide.
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (done.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`  apply ${file} ... `);
      try {
        // Each migration runs in its own transaction, so a failure leaves the
        // database on the last good migration rather than half-way through one.
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into _jharsetu_migrations (name) values ($1)", [file]);
        await client.query("commit");
        console.log("ok");
        ran++;
      } catch (error) {
        await client.query("rollback");
        console.log("failed");
        throw error;
      }
    }

    console.log(ran ? `\nApplied ${ran} migration(s).` : "\nNothing to apply; already up to date.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\nMigration failed:\n", error instanceof Error ? error.message : error);
  process.exit(1);
});
