// Assertions for the command-palette query grammar.
//
// The grammar decides which corpus a query is even about, so a regression here
// silently returns the wrong book rather than throwing. No test runner in this
// repo yet, so this follows the `npm run smoke` pattern: plain assertions, a
// non-zero exit on failure.
//
//   npx tsx scripts/check-cmd-query.ts

import { parseQuery, removeFilter, passesExcludes } from "../src/lib/cmd/query";
import { resolveMonth } from "../src/lib/cmd/terms";
import {
  ALL_CUES,
  cuePreview,
  cuesFor,
  monthOptions,
  staticSlotOptions,
} from "../src/lib/cmd/cues";

let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`);
  }
}

console.log("\nmode detection");
check("plain name is search", parseQuery("acme").mode, "search");
check("leading > is action", parseQuery("> refresh").mode, "action");
check("action strips the sigil", parseQuery("> refresh").text, "refresh");
check("trailing ? is ask", parseQuery("revenue for acme?").mode, "ask");
check("leading ? is ask", parseQuery("?acme").mode, "ask");
check("metric word is ask", parseQuery("revenue for acme").mode, "ask");
check("question word is ask", parseQuery("which accounts leak").mode, "ask");
check("bare entity stays search", parseQuery("northwind").mode, "search");
// The important one: operators mean "narrow a list", so they must not be
// hijacked into ask mode by a metric word that happens to be present.
check("operators beat metric words", parseQuery("status:pending revenue").mode, "search");
check("operators survive that", parseQuery("status:pending revenue").filters, { status: "pending" });

console.log("\nfield operators");
check("field:value", parseQuery("account:acme").filters, { account: "acme" });
check("alias client:", parseQuery("client:acme").filters, { account: "acme" });
check("alias is:", parseQuery("is:pending").filters, { status: "pending" });
check("alias in:", parseQuery("in:june").filters, { month: "june" });
check("two operators", parseQuery("account:acme api:KY1001").filters, {
  account: "acme",
  api: "KY1001",
});
check("quoted value keeps spaces", parseQuery('account:"northwind finance"').filters, {
  account: "northwind finance",
});
check("first writer wins", parseQuery("account:a account:b").filters, { account: "a" });
check("free text survives operators", parseQuery("account:acme masking").text, "masking");
check("unknown field is plain text", parseQuery("foo:bar").filters, {});
check("unknown field kept as text", parseQuery("foo:bar").text, "foo:bar");
check("bare colon is text", parseQuery(":").text, ":");

console.log("\nsigils");
check("@ is account", parseQuery("@acme").filters, { account: "acme" });
check("# is api", parseQuery("#KY1001").filters, { api: "KY1001" });
check("lone @ is text", parseQuery("@").text, "@");
check("email is not a sigil", parseQuery("maya@ledgerline.local").text, "maya@ledgerline.local");

console.log("\nexclusions");
check("-word excludes", parseQuery("acme -sandbox").excludes, ["sandbox"]);
check("-word leaves text", parseQuery("acme -sandbox").text, "acme");
check("negative number is not an exclusion", parseQuery("-42").excludes, []);
check("lone hyphen is text", parseQuery("-").text, "-");
check("passesExcludes filters", passesExcludes("Acme Sandbox", ["sandbox"]), false);
check("passesExcludes keeps", passesExcludes("Acme Ltd", ["sandbox"]), true);
check("passesExcludes empty is pass-through", passesExcludes("anything", []), true);

console.log("\nhasOperators");
check("plain text has none", parseQuery("acme").hasOperators, false);
check("filter counts", parseQuery("status:pending").hasOperators, true);
check("exclusion counts", parseQuery("acme -sandbox").hasOperators, true);

console.log("\nremoveFilter (chip dismiss)");
check("removes the named field", removeFilter("account:acme api:KY1001", "account"), "api:KY1001");
check("removes the sigil form", removeFilter("@acme masking", "account"), "masking");
check("leaves other fields alone", removeFilter("account:acme masking", "api"), "account:acme masking");

console.log("\nmonth resolution");
const year = new Date().getFullYear();
check("iso month", resolveMonth("2026-06"), { month: "2026-06", label: "June 2026" });
check("unpadded iso month", resolveMonth("2026-6"), { month: "2026-06", label: "June 2026" });
check("named + year", resolveMonth("june 2026"), { month: "2026-06", label: "June 2026" });
check("bare name takes this year", resolveMonth("june"), {
  month: `${year}-06`,
  label: `June ${year}`,
});
check("abbreviation", resolveMonth("sept"), { month: `${year}-09`, label: `September ${year}` });
check("month 13 rejected", resolveMonth("2026-13"), null);
check("nonsense rejected", resolveMonth("marqeta"), null);
// Guards the bug the ask layer already hit once: a word that merely starts with
// a month abbreviation must not resolve to that month.
check("two letters is not a month", resolveMonth("ma"), null);

console.log("\nask-me cues");
// Every cue must render a readable sentence before anything is filled in — that
// string is the row label.
check(
  "cue ids are unique",
  ALL_CUES.length,
  new Set(ALL_CUES.map((c) => c.id)).size
);
check("cue count", cuesFor("admin").length, 9);
check(
  "preview names the holes",
  cuePreview(cuesFor("admin").find((c) => c.id === "cue-revenue-account")!, []),
  "Revenue for an account… in a month…"
);
check(
  "preview substitutes filled values",
  cuePreview(cuesFor("admin").find((c) => c.id === "cue-revenue-account")!, [
    { value: "Acme", label: "Acme" },
    null,
  ]),
  "Revenue for Acme in a month…"
);
check(
  "revenue cue builds a spec",
  cuesFor("admin")
    .find((c) => c.id === "cue-revenue-account")!
    .build([{ value: "Acme Lending", label: "Acme Lending" }, { value: "2026-06", label: "June 2026" }]),
  {
    kind: "ask-spec",
    spec: { metric: "revenue", entityType: "account", entityName: "Acme Lending", period: "2026-06" },
    echo: "Revenue for Acme Lending in June 2026",
  }
);
check(
  "relation cue sends the API code, not its name",
  cuesFor("admin")
    .find((c) => c.id === "cue-accounts-using")!
    .build([{ value: "KY1001", label: "Aadhaar Masking", sub: "KY1001" }]),
  { kind: "ask-text", text: "accounts using KY1001" }
);

console.log("\nslot options");
const jan = monthOptions(3, new Date(Date.UTC(2026, 0, 15)));
check("months walk backwards across a year", jan.map((m) => m.value), ["2026-01", "2025-12", "2025-11"]);
check("newest month is tagged", jan[0].sub, "this month");
check("second month is tagged", jan[1].sub, "last month");
check("static slots resolve", staticSlotOptions("month") !== null, true);
check("fetched slots do not", staticSlotOptions("account"), null);

console.log(failed === 0 ? "\nAll grammar checks passed.\n" : `\n${failed} check(s) FAILED.\n`);
process.exit(failed === 0 ? 0 : 1);
