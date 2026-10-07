// Database bootstrap: applies every migration in ./migrations that is not yet
// recorded in schema_migrations, in order, each in its own transaction.
// 0001_baseline.sql creates the whole schema on an empty database.
//
// Idempotent and safe to re-run.
//
//   npm run db:setup

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function sslMode(): "require" | false {
  const url = process.env.DATABASE_URL ?? "";
  return /sslmode=require|neon\.tech/.test(url) ? "require" : false;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — copy .env.local.example to .env.local");
  }
  const sql = postgres(process.env.DATABASE_URL, { ssl: sslMode(), max: 1, onnotice: () => {} });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const applied = new Set(
      (await sql`SELECT version FROM schema_migrations`).map((r: any) => r.version as string)
    );
    const dir = path.join(process.cwd(), "migrations");
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    let ran = 0;
    for (const f of files) {
      const m = f.match(/^(\d{4,})_(.+)\.sql$/);
      if (!m) throw new Error(`migration filename must be NNNN_name.sql: ${f}`);
      if (applied.has(m[1])) continue;
      const migSql = fs.readFileSync(path.join(dir, f), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(migSql);
        await tx`INSERT INTO schema_migrations (version, name) VALUES (${m[1]}, ${m[2]})`;
      });
      ran++;
    }
    console.log(`ran ${ran} migration(s) — schema current`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
