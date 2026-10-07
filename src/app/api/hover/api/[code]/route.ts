import { NextResponse } from "next/server";
import { getSessionUser, canViewCost } from "@/lib/access";
import { getApiHoverCard } from "@/lib/repos/hover";

// Powers the rich API hover card. Margin is cost-gated — canViewCost gates it
// at the read (getApiHoverCard threads includeCost) so it never reaches a
// member's payload, matching the /apis page policy.
export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const code = decodeURIComponent(params.code);
  const card = await getApiHoverCard(code, canViewCost(user.role));
  if (!card) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(card);
}
