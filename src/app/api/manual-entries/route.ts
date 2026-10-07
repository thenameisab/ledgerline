import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { revalidateRevenue } from "@/lib/cache";
import {
  createManualEntry,
  submitManualEntry,
  approveManualEntry,
  voidManualEntry,
  previewLines,
  approvalThreshold,
  ManualEntryLockedError,
  type ManualEntryLineInput,
} from "@/lib/repos/manual-entries";

const LineSchema = z.object({
  api_code: z.string().min(1),
  hits_via: z.enum(["Bulk", "Integration", "Console"]).default("Bulk"),
  vendor: z.string().nullable().optional().transform((v) => v ?? null),
  successful: z.number().int().nonnegative().default(0),
  successful_no_data: z.number().int().nonnegative().default(0),
  failed: z.number().int().nonnegative().default(0),
  in_progress: z.number().int().nonnegative().default(0),
});

const CreateSchema = z.object({
  action: z.literal("create"),
  client_id: z.number().int().positive(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1).max(500),
  reference: z.string().max(200).nullable().optional().transform((v) => v ?? null),
  lines: z.array(LineSchema).min(1),
  submit: z.boolean().optional().default(false),
});

const TransitionSchema = z.object({
  action: z.enum(["submit", "approve", "void"]),
  id: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

const PreviewSchema = z.object({
  action: z.literal("preview"),
  client_id: z.number().int().positive(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(LineSchema).min(1),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const body = await req.json();
  const action = body?.action;

  if (action === "preview") {
    const guard = await guardAction("manual_entry.edit");
    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, error: guard.error },
        { status: guard.code === "unauthenticated" ? 401 : 403 }
      );
    }
    const parsed = PreviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
    }
    const lines = await previewLines(parsed.data.client_id, parsed.data.effective_date, parsed.data.lines as ManualEntryLineInput[]);
    const total = lines.reduce((s, l) => s + l.revenue, 0);
    return NextResponse.json({
      ok: true,
      lines,
      total,
      requires_approval: total > approvalThreshold(),
      threshold: approvalThreshold(),
    });
  }

  if (action === "create") {
    const guard = await guardAction("manual_entry.edit");
    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, error: guard.error },
        { status: guard.code === "unauthenticated" ? 401 : 403 }
      );
    }
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
    }
    const { id, preview_total } = await createManualEntry(
      {
        client_id: parsed.data.client_id,
        effective_date: parsed.data.effective_date,
        reason: parsed.data.reason,
        reference: parsed.data.reference,
        attachment_path: null,
        source: "manual",
        import_hash: null,
        lines: parsed.data.lines as ManualEntryLineInput[],
      },
      guard.user.id
    );

    const requiresApproval = preview_total > approvalThreshold();

    if (parsed.data.submit) {
      await submitManualEntry(id, guard.user.id);
      if (!requiresApproval && guard.user.role === "admin") {
        await approveManualEntry(id, guard.user.id);
        revalidateRevenue();
      }
    }

    return NextResponse.json({
      ok: true,
      id,
      total: preview_total,
      requires_approval: requiresApproval,
    });
  }

  if (action === "submit" || action === "approve" || action === "void") {
    const parsed = TransitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
    }

    if (action === "approve") {
      const guard = await guardAction("manual_entry.approve");
      if (!guard.ok) {
        return NextResponse.json(
          { ok: false, error: guard.error },
          { status: guard.code === "unauthenticated" ? 401 : 403 }
        );
      }
      await approveManualEntry(parsed.data.id, guard.user.id);
      revalidateRevenue();
      return NextResponse.json({ ok: true });
    }

    const guard = await guardAction("manual_entry.edit");
    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, error: guard.error },
        { status: guard.code === "unauthenticated" ? 401 : 403 }
      );
    }

    if (action === "submit") {
      await submitManualEntry(parsed.data.id, guard.user.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "void") {
      try {
        await voidManualEntry(parsed.data.id, guard.user.id, parsed.data.reason ?? "");
      } catch (err) {
        if (err instanceof ManualEntryLockedError) {
          return NextResponse.json(
            {
              ok: false,
              error: `this entry falls inside a finalized invoice (${err.statementNumber}); add an adjustment instead of voiding`,
            },
            { status: 409 }
          );
        }
        throw err;
      }
      revalidateRevenue();
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
