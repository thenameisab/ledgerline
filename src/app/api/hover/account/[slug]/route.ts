import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/access";
import { getAccountHoverCard } from "@/lib/repos/hover";

// Powers the rich account hover card. Read-only; the payload mirrors the numbers
// the accounts list already shows (same cached read, default window).
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const card = await getAccountHoverCard(params.slug);
  if (!card) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(card);
}
