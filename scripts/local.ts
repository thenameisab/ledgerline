// One-command local runner for the Ledgerline portfolio demo — no Docker required.
//
// Boots an embedded PostgreSQL instance (a real Postgres binary managed by the
// `embedded-postgres` package, data persisted in ./.pgdata), makes sure the
// schema + mock data exist, then runs the requested action:
//
//   tsx scripts/local.ts dev        # embedded PG → auto setup+seed if empty → next dev
//   tsx scripts/local.ts build      # ensure data → next build
//   tsx scripts/local.ts start      # ensure data → next start -p 3000
//   tsx scripts/local.ts setup      # apply schema + seed, then exit
//   tsx scripts/local.ts seed       # (re)seed mock data, then exit
//   tsx scripts/local.ts db:setup   # apply schema baseline only, then exit
//   tsx scripts/local.ts migrate    # run pending migrations, then exit
//
// Deploy (Vercel + Neon) never runs this file: there DATABASE_URL points at a
// managed Postgres and `next build` / `next start` run directly. This launcher
// only exists to make the local clone-and-run experience frictionless.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);
const USER = "ledgerline";
const PASSWORD = "ledgerline";
const DB = "ledgerline";
const DATA_DIR = path.join(process.cwd(), ".pgdata");
const DATABASE_URL = `postgres://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`;

type Action = "dev" | "build" | "start" | "setup" | "seed" | "db:setup" | "migrate";
const LONG_LIVED = new Set<Action>(["dev", "start"]);

function log(msg: string) {
  console.log(`\x1b[36m[ledgerline]\x1b[0m ${msg}`);
}

// While the embedded server is shutting down, its internal client emits a
// benign "terminating connection due to administrator command" (57P01). Once
// we're intentionally stopping, swallow those so the CLI exits cleanly.
let stopping = false;
function isShutdownNoise(err: any): boolean {
  const code = err?.code;
  const msg = String(err?.message ?? "");
  return code === "57P01" || /terminating connection|Connection terminated/i.test(msg);
}
process.on("unhandledRejection", (err: any) => {
  if (stopping && isShutdownNoise(err)) return;
  console.error(err);
  process.exit(1);
});
process.on("uncaughtException", (err: any) => {
  if (stopping && isShutdownNoise(err)) return;
  console.error(err);
  process.exit(1);
});

async function startEmbedded(): Promise<EmbeddedPostgres> {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Quiet the server's routine startup/shutdown/checkpoint logging; surface
    // only genuine problems (never the benign shutdown "terminating connection").
    onLog: (message: string) => {
      if (/terminating connection|shutting down|checkpoint|database system|logical replication|starting PostgreSQL|listening on|LOG:/i.test(message)) {
        return;
      }
      if (/error|fatal|panic/i.test(message)) console.error(message);
    },
  });
  // initialise() only on a fresh data dir; PG_VERSION marks an initialised cluster.
  if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    log("initialising embedded Postgres (first run — downloads a Postgres binary)…");
    await pg.initialise();
  }
  log(`starting embedded Postgres on :${PORT}…`);
  await pg.start();
  try {
    await pg.createDatabase(DB);
  } catch {
    // database already exists — fine.
  }
  return pg;
}

// Run one of the repo's own tsx scripts against the embedded DB. Reuses their
// existing main() unchanged; DATABASE_URL is inherited from process.env.
function runScript(file: string): Promise<void> {
  return runCommand("tsx", [file]);
}

function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL },
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on("error", reject);
  });
}

async function isSeeded(): Promise<boolean> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [{ regclass }] = await sql`SELECT to_regclass('public.clients') AS regclass`;
    if (!regclass) return false;
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM clients`;
    return count > 0;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function ensureSeeded() {
  if (await isSeeded()) {
    log("database already has data — skipping setup/seed.");
    return;
  }
  log("empty database — applying schema and seeding mock data (one-time)…");
  await runScript("scripts/db-setup.ts");
  await runScript("scripts/seed-mock.ts");
  clearNextDataCache();
}

// Next keeps revenue reads in its data cache (unstable_cache, tagged, no TTL),
// and the cache survives a dev-server restart. After a reseed every cached
// figure would be stale, so drop the cache whenever the seed rewrites data.
function clearNextDataCache() {
  fs.rmSync(path.join(process.cwd(), ".next", "cache", "fetch-cache"), { recursive: true, force: true });
}

async function main() {
  const action = (process.argv[2] as Action) ?? "dev";
  process.env.DATABASE_URL = DATABASE_URL;

  const pg = await startEmbedded();

  // Ensure PG stops on any exit path.
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    log("stopping embedded Postgres…");
    // Shutting the server down makes its internal client print a benign
    // "terminating connection…" error. Mute just those stderr lines for the
    // brief stop window so the CLI ends cleanly.
    const origWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as any).write = (chunk: any, ...rest: any[]) => {
      const s = String(chunk);
      if (/terminating connection|Connection terminated/i.test(s)) return true;
      return (origWrite as any)(chunk, ...rest);
    };
    try {
      await pg.stop();
    } catch {
      /* ignore */
    } finally {
      // small grace period for async teardown chatter, then restore
      await new Promise((r) => setTimeout(r, 150));
      (process.stderr as any).write = origWrite;
    }
  };
  process.on("SIGINT", async () => {
    await stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await stop();
    process.exit(0);
  });

  try {
    switch (action) {
      case "db:setup":
        await runScript("scripts/db-setup.ts");
        break;
      case "seed":
        await ensureSchema();
        await runScript("scripts/seed-mock.ts");
        clearNextDataCache();
        break;
      case "migrate":
        await runScript("scripts/migrate.ts");
        break;
      case "setup":
        await runScript("scripts/db-setup.ts");
        await runScript("scripts/seed-mock.ts");
        clearNextDataCache();
        break;
      case "build":
        await ensureSeeded();
        await runCommand("next", ["build"]);
        break;
      case "start":
        await ensureSeeded();
        log("starting production server on http://localhost:3000 …");
        await runCommand("next", ["start", "-p", "3000"]);
        break;
      case "dev":
      default:
        await ensureSeeded();
        log("starting dev server — open the printed URL, then click “Enter as Admin”.");
        // Forward extra args (e.g. `npm run dev -- -p 3098`) to next dev.
        await runCommand("next", ["dev", ...process.argv.slice(3)]);
        break;
    }
  } finally {
    if (!LONG_LIVED.has(action)) {
      await stop();
      // Hard-exit so embedded-postgres's async shutdown chatter never surfaces.
      process.exit(0);
    }
  }
}

// A bare `seed` on a brand-new data dir needs the schema first.
async function ensureSchema() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  let hasSchema = false;
  try {
    const [{ regclass }] = await sql`SELECT to_regclass('public.clients') AS regclass`;
    hasSchema = !!regclass;
  } catch {
    hasSchema = false;
  } finally {
    await sql.end({ timeout: 5 });
  }
  if (!hasSchema) await runScript("scripts/db-setup.ts");
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
