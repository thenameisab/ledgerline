# Deploy Ledgerline (Vercel Hobby + Neon)

This guide deploys Ledgerline to Vercel (Hobby plan) with a Neon Postgres
database, behind Cloudflare DNS and Cloudflare Access. The app code is the same
as in local development. `src/lib/db.ts` turns on SSL when the connection string
contains `sslmode=require` or a `neon.tech` host.

Use the same region for Vercel functions and the Neon database. This guide uses
**US East**: Vercel region `iad1` (Washington, D.C.) and Neon region AWS
`us-east-1` (N. Virginia). If you pick a different region, pick the nearest
match on both sides.

## 1. Create the Neon database

1. Create a Neon project in AWS `us-east-1`.
2. Copy two connection strings from the Neon dashboard:
   - The **pooled** string (host contains `-pooler`). The app uses this one.
   - The **direct** string (no `-pooler`). Use this one for the one-time setup
     and seed in step 2.

   Both strings end with `?sslmode=require`.

## 2. Create the schema and seed data (once, from your machine)

Run the two scripts directly with `npx tsx`. Each script reads `DATABASE_URL`
from the environment. Do not use `npm run db:setup` or `npm run seed` for this
step: those commands go through `scripts/local.ts`, which starts the embedded
Postgres and replaces `DATABASE_URL` with the local address.

```bash
npm install
DATABASE_URL='postgresql://USER:PASSWORD@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require' \
  npx tsx scripts/db-setup.ts
DATABASE_URL='postgresql://USER:PASSWORD@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require' \
  npx tsx scripts/seed-mock.ts
```

- `scripts/db-setup.ts` applies every file in `migrations/` that is not yet
  recorded in `schema_migrations`. Today that is `0001_baseline.sql`. It is safe
  to run again.
- `scripts/seed-mock.ts` truncates the app tables and writes the fictional data.
  It sets `MOCK_INTEGRATIONS=true` for its own run. It is safe to run again.

## 3. Create the Vercel project

1. Push the repository to a Git host and import it at <https://vercel.com/new>.
   Vercel detects Next.js. `vercel.json` sets the build command to
   `npm run next:build`, which runs `next build` without the embedded database.
2. In **Settings → Functions**, set the function region to `iad1`.
3. In **Settings → Environment Variables**, set these variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | The Neon **pooled** connection string, with `sslmode=require` |
   | `AUTH_SECRET` | A random string, for example the output of `openssl rand -base64 32` |
   | `CRON_SECRET` | A random string. Cron routes require `Authorization: Bearer <CRON_SECRET>` |
   | `MOCK_INTEGRATIONS` | `true` |

   Optional: set `AUTH_URL` to the public URL (for example
   `https://revu.adityagaur.xyz`). Ledgerline uses it to build links in emails
   and in the invite banner. Sign-in works without it.

   Do not set these variables:
   - `AUTH_BYPASS`. The app refuses to start with `AUTH_BYPASS=true` when
     `NODE_ENV` is `production`.
   - Mail credentials. Without them, email sends are skipped and the app logs a
     warning. Email previews still work with `?dry=1` on the cron routes.
   - Usage source credentials. With `MOCK_INTEGRATIONS=true`, the usage sync
     and the vendor-side pull generate data locally.
4. Deploy. Open the deployment URL and click **Enter as Admin** to check that
   the app can read the database.

## 4. Point a Cloudflare domain at Vercel

1. In Vercel, open **Settings → Domains** and add the domain, for example
   `revu.adityagaur.xyz`.
2. In Cloudflare DNS, add a `CNAME` record for the subdomain (`revu`) with the
   target `cname.vercel-dns.com`. Set the proxy status to **Proxied**.
3. In **SSL/TLS → Overview**, set the encryption mode to **Full (strict)**.
4. In **Caching → Cache Rules**, add a rule with the expression
   `http.host eq "revu.adityagaur.xyz"` and the action **Bypass cache**. The
   app returns per-user, per-role pages, so Cloudflare must not cache them.

If Vercel cannot issue a certificate for the domain while the record is
proxied, set the record to **DNS only**, wait until Vercel shows the domain as
valid, then set it back to **Proxied**.

## 5. Protect the domain with Cloudflare Access

1. In Cloudflare Zero Trust, open **Settings → Authentication** and add
   **One-time PIN** as a login method.
2. Open **Access → Applications**, add an application, and choose
   **Self-hosted**.
3. Set the application domain to `revu.adityagaur.xyz`.
4. Add a policy with the action **Allow**. For a public demo, use an include
   rule of **Everyone**, so any visitor who confirms an email address with a
   one-time code can enter. To limit access, include specific emails instead.
5. Select **One-time PIN** as the login method for the application and save.

A visitor now enters an email address, enters the code that Cloudflare sends,
and then sees the Ledgerline login page with **Enter as Admin** and **Enter as
Member**.

Cloudflare Access protects only the custom domain. The `*.vercel.app`
deployment URL does not pass through Cloudflare.

## Later steps

These parts are added in later steps and are not described here:

- A middleware check of the Cloudflare Access JWT, so that requests that did
  not pass through Access are refused.
- The nightly job that reseeds the database and clears the revenue cache.

## Notes

- **Sign-in**: the app uses a demo Credentials provider (`src/auth.ts`). The
  **Enter as Admin** and **Enter as Member** buttons sign in seeded users. No
  OAuth setup is necessary.
- **Reseeding by hand**: run `scripts/seed-mock.ts` against Neon with the
  command in step 2. Next.js keeps revenue reads in its Data Cache with no
  expiry, and on Vercel that cache stays across deployments. A script cannot
  clear it, so the app can show old figures after a reseed until the revenue
  cache is cleared. The nightly job in the later steps clears it.
- **Local runner**: `scripts/local.ts` is for local development only. Vercel
  runs `next build` and `next start` directly against Neon.
