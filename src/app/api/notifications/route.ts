import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { listNotifications, unreadCount, markRead, markAllRead } from "@/lib/repos/notifications";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const [items, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
  return NextResponse.json({ ok: true, items, unread });
}

const PatchSchema = z.union([
  z.object({ action: z.literal("mark_read"), ids: z.array(z.number().int().positive()).min(1) }),
  z.object({ action: z.literal("mark_all_read") }),
]);

export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 422 });

  if (parsed.data.action === "mark_all_read") await markAllRead(user.id);
  else await markRead(user.id, parsed.data.ids);

  return NextResponse.json({ ok: true, unread: await unreadCount(user.id) });
}
