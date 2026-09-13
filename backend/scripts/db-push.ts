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

  /**
 * Split SQL into individual statements. Aware of line/block comments,
 * single-quoted strings, double-quoted identifiers and dollar-quoted
 * blocks (DO $$ ... $$), so a semicolon inside a function body does not
 * split. Empty statements are dropped.
 */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const two = sql.slice(i, i + 2);
    // Line comment.
    if (two === "--") {
      const end = sql.indexOf("\n", i);
      current += sql.slice(i, end === -1 ? n : end);
      i = end === -1 ? n : end;
      continue;
    }
    // Block comment.
    if (two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      current += sql.slice(i, end === -1 ? n : end + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    const ch = sql[i];
    // Quoted string or identifier.
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }
    // Dollar-quoted block: $tag$ ... $tag$.
    if (ch === "$") {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? n : end + tag[0].length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }
    if (ch === ";") {
      if (current.trim()) out.push(current.trim());
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * ALTER TYPE ... ADD VALUE cannot run inside a transaction block
 * (Postgres error 25001), and the new value cannot be used until it
 * commits - so these statements go first, each in its own implicit
 * transaction, before the rest of the file runs in an explicit one.
 */
function isEnumAddition(stmt: string): boolean {
  return /^\s*alter\s+type\s+\S+\s+add\s+value\b/i.test(
    stmt.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""),
  );
}

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
        // Enum additions are the exception: they must run outside any
        // transaction, and before anything that uses the new values.
        const statements = splitStatements(sql);
        const outside = statements.filter(isEnumAddition);
        const inside = statements.filter((s) => !isEnumAddition(s));
        for (const stmt of outside) {
          await client.query(stmt);
        }
        if (inside.length > 0) {
          await client.query("begin");
          try {
            for (const stmt of inside) {
              await client.query(stmt);
            }
            await client.query("insert into _jharsetu_migrations (name) values ($1)", [file]);
            await client.query("commit");
          } catch (inner) {
            await client.query("rollback");
            throw inner;
          }
        } else {
          await client.query("insert into _jharsetu_migrations (name) values ($1)", [file]);
        }
        console.log("ok");
        ran++;
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          // Already outside a transaction (or nothing to roll back).
        }
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
