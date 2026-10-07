import { matchSorter } from "match-sorter";

/**
 * Shared fuzzy ranker for in-page pickers (the searchable <Combobox>).
 *
 * Wraps match-sorter so every dropdown ranks the same way: a typed query is
 * matched against the named keys (e.g. product_code + name + category) with
 * exact > prefix > word-prefix > contains > acronym precedence, and items are
 * returned best-first. An empty query returns the list unchanged so the
 * dropdown shows everything before the user types.
 *
 * This is substring/token matching, not edit-distance typo correction — it
 * handles partial words and out-of-order tokens ("mask aadhaar" → "Aadhaar
 * Masking"), which is what the pickers need.
 */
export function fuzzyFilter<T>(items: T[], query: string, keys: (keyof T & string)[]): T[] {
  const q = query.trim();
  if (!q) return items;
  // Split on whitespace and AND the tokens so order doesn't matter
  // ("mask aadhaar" still finds "Aadhaar Masking"). Folding right keeps the
  // final ordering ranked by the first token the user typed.
  const tokens = q.split(/\s+/);
  return tokens.reduceRight((acc, token) => matchSorter(acc, token, { keys }), items);
}
