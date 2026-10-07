// Create or update the schema on the deployed database, then reseed the demo
// data. Reads .env.deploy.local (or the file in DEPLOY_ENV_FILE) and uses
// DATABASE_URL_DIRECT, because the pooled string does not suit a long script.
//
//   npm run deploy:seed
//
// After a reseed, the deployed app can still show cached revenue figures.
// Pass --revalidate=<site URL> to clear the revenue cache afterwards:
//
//   npm run deploy:seed -- --revalidate=https://ledgerline.vercel.app

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const file = process.env.DEPLOY_ENV_FILE ?? ".env.deploy.local";
if (!fs.existsSync(file)) {
  console.error(`deploy:seed: ${file} not found. See DEPLOY.md.`);
  process.exit(1);
}
process.loadEnvFile(file);

const direct = process.env.DATABASE_URL_DIRECT;
if (!direct) {
  console.error(`deploy:seed: DATABASE_URL_DIRECT is empty in ${file}.`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: direct };
for (const script of ["scripts/db-setup.ts", "scripts/seed-mock.ts"]) {
  console.log(`\n── ${script}`);
  const r = spawnSync("npx", ["tsx", script], { stdio: "inherit", env });
  if (r.status !== 0) {
    console.error(`deploy:seed: ${script} failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}

async function clearCache() {
  const arg = process.argv.find((a) => a.startsWith("--revalidate="));
  if (!arg) return;
  const site = arg.slice("--revalidate=".length).replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("deploy:seed: CRON_SECRET is empty, so the cache was not cleared.");
    process.exit(1);
  }
  const res = await fetch(`${site}/api/cache/revalidate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    redirect: "manual",
  });
  if (res.status !== 200) {
    console.error(`deploy:seed: cache clear returned HTTP ${res.status}.`);
    process.exit(1);
  }
  console.log("\nRevenue cache cleared.");
}

clearCache().catch((err) => {
  console.error(err);
  process.exit(1);
});
