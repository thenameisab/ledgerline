// Minimal forward-only migration runner.
//
// Scans migrations/*.sql in lexical order, applies any not yet recorded
// in schema_migrations, each in its own transaction. No down migrations —
// roll-forward only. If a migration fails it aborts and leaves the prior
// state intact.
//
// Usage:
//   npm run migrate           # apply pending
//   npm run migrate -- --list # show status
//   npm run migrate -- --baseline <version>   # mark applied without running

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

function loadFiles(): { version: string; name: string; sql: string; path: string }[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const m = f.match(/^(\d{4,})_(.+)\.sql$/);
      if (!m) throw new Error(`migration filename must be NNNN_name.sql: ${f}`);
      const full = path.join(MIGRATIONS_DIR, f);
      return { version: m[1], name: m[2], sql: fs.readFileSync(full, "utf8"), path: full };
    });
}

function sslMode(): "require" | false {
  const url = process.env.DATABASE_URL ?? "";
  return /sslmode=require|neon\.tech/.test(url) ? "require" : false;
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: sslMode(), max: 1, onnotice: () => {} });
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
    const files = loadFiles();
    const args = process.argv.slice(2);

    if (args[0] === "--list") {
      console.log("version  status   name");
      for (const f of files) {
        console.log(`${f.version}   ${applied.has(f.version) ? "applied" : "pending"}  ${f.name}`);
      }
      return;
    }

    if (args[0] === "--baseline") {
      const v = args[1];
      if (!v) throw new Error("--baseline requires a version");
      const f = files.find((x) => x.version === v);
      if (!f) throw new Error(`no migration file for version ${v}`);
      await sql`
        INSERT INTO schema_migrations (version, name) VALUES (${f.version}, ${f.name})
        ON CONFLICT DO NOTHING
      `;
      console.log(`baselined ${f.version}_${f.name}`);
      return;
    }

    let appliedCount = 0;
    for (const f of files) {
      if (applied.has(f.version)) continue;
      console.log(`applying ${f.version}_${f.name}...`);
      await sql.begin(async (tx) => {
        await tx.unsafe(f.sql);
        await tx`INSERT INTO schema_migrations (version, name) VALUES (${f.version}, ${f.name})`;
      });
      console.log(`  ok`);
      appliedCount++;
    }
    console.log(appliedCount === 0 ? "no pending migrations" : `applied ${appliedCount}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
