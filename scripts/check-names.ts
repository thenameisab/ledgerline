// Name scan. Fails when a tracked or new (not ignored) text file contains a
// term from the denylist.
//
// The denylist is not part of the repo, because the list itself contains the
// names it blocks. Default path: ~/.config/ledgerline/denylist.txt. Override
// with LEDGERLINE_DENYLIST=/path/to/file.
//
// Denylist format: one term per line. Matching ignores case and requires a
// non-alphanumeric character (or the line edge) on both sides of the term.
// A line that starts with "re:" is a regular expression (case-insensitive).
// Lines that start with "#" and empty lines are ignored.
//
//   npm run check:names

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const listPath =
  process.env.LEDGERLINE_DENYLIST ?? path.join(os.homedir(), ".config", "ledgerline", "denylist.txt");

if (!fs.existsSync(listPath)) {
  console.error(`check:names: denylist not found at ${listPath}. Set LEDGERLINE_DENYLIST or create the file.`);
  process.exit(1);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const patterns: { label: string; re: RegExp }[] = [];
for (const raw of fs.readFileSync(listPath, "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  if (line.startsWith("re:")) {
    patterns.push({ label: line, re: new RegExp(line.slice(3), "i") });
  } else {
    patterns.push({ label: line, re: new RegExp(`(?<![A-Za-z0-9])${escape(line)}(?![A-Za-z0-9])`, "i") });
  }
}
if (patterns.length === 0) {
  console.error(`check:names: denylist at ${listPath} has no terms.`);
  process.exit(1);
}

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && fs.existsSync(f));

let hits = 0;
let scanned = 0;
for (const file of files) {
  const buf = fs.readFileSync(file);
  // Skip binary files (images, fonts): a NUL byte in the first 8 KB.
  if (buf.subarray(0, 8192).includes(0)) continue;
  scanned++;
  const lines = buf.toString("utf8").split("\n");
  lines.forEach((text, i) => {
    for (const p of patterns) {
      if (p.re.test(text)) {
        hits++;
        console.log(`${file}:${i + 1}: ${p.label}`);
      }
    }
  });
}

if (hits > 0) {
  console.error(`check:names: ${hits} hit(s) in ${scanned} text files.`);
  process.exit(1);
}
console.log(`check:names: ${scanned} text files, ${patterns.length} terms, no hits.`);
