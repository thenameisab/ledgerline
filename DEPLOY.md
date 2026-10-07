# Deploy Ledgerline (Vercel Hobby + Neon)

Ledgerline runs on Vercel with a Neon Postgres database. The landing page is at
`/`. Visitors submit the Tally form on it, and then open the demo sign-in.

Keep deployment values in `.env.deploy.local` at the repository root. The file
is gitignored (`.env*.local`) and stays on your machine.

## 1. Choose one region for both

Vercel functions and the Neon database must be in the same region. Every page
makes several database queries, so a cross-region round trip slows each page.

| Audience | Vercel function region | Neon region |
|---|---|---|
| India and Asia | Singapore | AWS Asia Pacific (Singapore) |
| United States | Washington, D.C., USA (`iad1`) | AWS US East (N. Virginia) |
| Europe | Frankfurt, Germany (`fra1`) | AWS Europe (Frankfurt) |

## 2. Create the Neon database

1. Sign in at <https://console.neon.tech> and create a project in the region you
   chose. Postgres 17 matches local development.
2. On the project dashboard, click **Connect**.
3. With **Connection pooling** on, copy the string. Its host contains
   `-pooler`. Put it in `.env.deploy.local` as `DATABASE_URL`.
4. Turn **Connection pooling** off and copy the string again. Put it in
   `.env.deploy.local` as `DATABASE_URL_DIRECT`.

Both strings end with `?sslmode=require`. `src/lib/db.ts` turns on SSL for them
and turns off prepared statements, which the pooler does not support.

## 3. Create the schema and the demo data (once, from your machine)

Run this from the repository root:

```bash
npm run deploy:seed
```

`scripts/deploy-seed.ts` reads `.env.deploy.local` with Node's env-file parser,
which handles the `&` in Neon strings. It runs `scripts/db-setup.ts` and then
`scripts/seed-mock.ts` with `DATABASE_URL` set to `DATABASE_URL_DIRECT`. Do not
use `npm run db:setup` or `npm run seed` for this: those go through
`scripts/local.ts`, which starts the embedded Postgres and replaces
`DATABASE_URL` with a local address. The seed inserts rows one at a time, so
against a distant region it can take 15 minutes or more.

Both scripts are safe to run again. The seed replaces all demo data.

## 4. Create the Vercel project

1. At <https://vercel.com/new>, import the GitHub repository. If Vercel cannot
   see it, click **Adjust GitHub App Permissions** and give the Vercel app access
   to the repository.
2. Leave the framework (Next.js) and root directory as detected. `vercel.json`
   sets the build command to `npm run next:build`.
3. Open **Environment Variables** and add these for **Production** (and
   **Preview**, if you want preview deployments to work):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `DATABASE_URL` from `.env.deploy.local` (the pooled string) |
   | `AUTH_SECRET` | `AUTH_SECRET` from `.env.deploy.local` |
   | `CRON_SECRET` | `CRON_SECRET` from `.env.deploy.local` |
   | `MOCK_INTEGRATIONS` | `true` |

4. Click **Deploy**.
5. After the first deploy, open **Settings → Functions → Function Region** and
   select the region from step 1. Then open **Deployments**, open the latest
   deployment's menu, and click **Redeploy** so the setting takes effect.

Do not set:

- `AUTH_BYPASS`. The app refuses to start with it in production.
- Mail credentials. Without them the app skips every email send. Email previews
  still work with `?dry=1` on the cron routes.
- Usage-source credentials. With `MOCK_INTEGRATIONS=true` the usage sync and the
  vendor-side pull generate data locally.

## 5. Check the deployment

1. Open the deployment URL. The landing page appears.
2. Submit the Tally form. The page moves to the sign-in page.
3. Click **Enter as Admin**. The dashboard shows month-to-date revenue.
4. Open a signed-out private window and go to `/dashboard`. It returns you to the
   form on the landing page.

## 6. Tally form settings

- Turn off **Redirect on completion**. The landing page reacts to the submit
  itself.
- Optional: set the button color to `#1364F1` and the font to Inter so the form
  matches the page.

## 7. Custom domain (optional)

In Vercel, open **Settings → Domains** and add the domain. Vercel shows the DNS
record to create at your DNS provider. If the DNS provider is Cloudflare, set
the record to **DNS only**, or set SSL to **Full (strict)** and add a cache
bypass rule for the host, because the app returns per-user pages.

## Reseeding and the revenue cache

Next.js keeps revenue reads in its Data Cache with no expiry, and on Vercel the
cache stays across deployments. To reseed and then clear the cache:

```bash
npm run deploy:seed -- --revalidate=https://YOUR-DOMAIN
```

The nightly reset job (reseed, then clear the cache) is a later step.
