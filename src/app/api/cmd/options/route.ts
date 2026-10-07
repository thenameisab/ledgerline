// Slot options for the palette's "Ask Me" cues.
//
// Three slot kinds need real data — accounts, groups, and the API catalog. The
// rest (months, top-N) are known client-side and cost no
// round-trip; see staticSlotOptions in lib/cmd/cues.ts.
//
// Read-only, name-and-code only. Deliberately carries no revenue, cost, or
// margin: this feeds a picker, and the answer the user then asks for goes
// through the normal guarded read.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/access";
import { rateLimit } from "@/lib/http";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { listAccounts, listGroups } from "@/lib/repos/accounts";
import { listApis } from "@/lib/repos/apis";
import type { SlotOption } from "@/lib/cmd/cues";

const SLOTS = ["account", "group", "api"] as const;
type ServerSlot = (typeof SLOTS)[number];

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ options: [] }, { status: 401 });

  const limited = rateLimit(`cmd-options:${user.id}`, { limit: 30, windowMs: 10_000 });
  if (limited) return limited;

  const slot = new URL(req.url).searchParams.get("slot") ?? "";
  if (!SLOTS.includes(slot as ServerSlot)) {
    return NextResponse.json({ options: [], error: "Unknown slot." }, { status: 400 });
  }

  let options: SlotOption[] = [];

  if (slot === "account") {
    const includeSandbox = await getIncludeSandbox();
    const rows = await listAccounts();
    options = rows
      .filter((r) => includeSandbox || Number(r.is_sandbox) === 0)
      .map((r) => ({
        value: r.display_name as string,
        label: r.display_name as string,
      }));
  } else if (slot === "group") {
    options = (await listGroups()).map((r) => ({ value: r.name as string, label: r.name as string }));
  } else {
    // The API slot sends the product code, not the name: it's the stable
    // identity (see the API-identity work) and no noise-stripper can mangle it.
    options = (await listApis())
      .filter((r) => Number(r.is_active) === 1)
      .map((r) => ({
        value: r.product_code as string,
        label: r.name as string,
        sub: r.product_code as string,
      }));
  }

  return NextResponse.json({ options });
}
