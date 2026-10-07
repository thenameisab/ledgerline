import postgres from "postgres";

const GLOBAL_KEY = Symbol.for("ledgerline.sql");
type G = typeof globalThis & { [GLOBAL_KEY]?: postgres.Sql };
const g = globalThis as G;

// Postgres OIDs for date/time types we want returned as text so the JS
// layer keeps working with the ISO strings it already expects.
// 1082 = date, 1083 = time, 1114 = timestamp, 1184 = timestamptz.
// Without this, postgres v3 hands back JS Date objects after the schema
// migration to TIMESTAMPTZ/DATE — silently breaking the many call sites that
// pass these values straight through to JSON / string compares (e.g.
// draftStatementNumber splitting period.start_date).
const DATE_TIME_OIDS = [1082, 1083, 1114, 1184];

// Local embedded Postgres has no TLS; Neon (deployed) requires it. Drive SSL
// off the connection string so the same code path works in both: a managed
// URL carries `sslmode=require` (or a neon.tech host), the local URL does not.
function sslMode(): "require" | false {
  const url = process.env.DATABASE_URL ?? "";
  return /sslmode=require|neon\.tech/.test(url) ? "require" : false;
}

function createSql() {
  return postgres(process.env.DATABASE_URL!, {
    ssl: sslMode(),
    // Postgres emits NOTICE lines for IF-NOT-EXISTS skips / truncate cascades;
    // they're not actionable here and clutter the console — silence them.
    onnotice: () => {},
    // DATABASE_URL points at Neon's pooled (-pooler) endpoint, which is
    // PgBouncer in transaction mode. postgres.js defaults to server-side
    // prepared statements, which transaction-mode pooling doesn't support
    // (throws "prepared statement already exists" under reuse). Disable them.
    // Our sql.begin() transactions are unaffected — each stays on one backend
    // connection for the life of the transaction.
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    types: {
      // Read as text; writes still accept Date or string via implicit cast.
      date_as_text: {
        to: 25, // unused on write
        from: DATE_TIME_OIDS,
        serialize: (v: unknown) => String(v),
        parse: (v: string) => v,
      },
    },
  });
}

export function getSql(): postgres.Sql {
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = createSql();
  return g[GLOBAL_KEY]!;
}

export default getSql;
