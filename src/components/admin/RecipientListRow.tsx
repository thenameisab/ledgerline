"use client";

// One recipient-list editor row, shared by the roundup and product update
// settings: recipients input (comma/space separated, @ledgerline.local only,
// empty = that email off) + Save, "Send me a test" (emails only the signed-in
// admin) and "Send now" (emails the saved list). The server actions are passed
// in so each caller binds its own kind/product. The alert lists pass neither
// test nor send-now: their tests are per email type, not per list.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { RoundupActionResult } from "@/app/admin/settings/actions";

export type RecipientListRowProps = {
  label: string;
  hint: string;
  initial: string[];
  onSave: (raw: string) => Promise<RoundupActionResult>;
  onTest?: () => Promise<RoundupActionResult>;
  onSendNow?: () => Promise<RoundupActionResult>;
};

export function RecipientListRow({ label, hint, initial, onSave, onTest, onSendNow }: RecipientListRowProps) {
  const [value, setValue] = useState(initial.join(", "));
  const [error, setError] = useState<string | undefined>();
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();
  const [sending, startSending] = useTransition();

  const save = () =>
    startSaving(async () => {
      setError(undefined);
      const res = await onSave(value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValue((res.recipients ?? []).join(", "));
      toast.success(`${label} recipients saved`, {
        description: res.recipients?.length
          ? `${res.recipients.length} recipient${res.recipients.length === 1 ? "" : "s"}.`
          : "List emptied — this email is now off.",
      });
    });

  const test = () =>
    startTesting(async () => {
      if (!onTest) return;
      const res = await onTest();
      if (!res.ok) {
        toast.error(`Couldn't send the test ${label.toLowerCase()}`, { description: res.error });
        return;
      }
      toast.success("Test sent to you", { description: res.subject });
    });

  const sendNow = () =>
    startSending(async () => {
      if (!onSendNow) return;
      const res = await onSendNow();
      if (!res.ok) {
        toast.error(`${label} not sent`, { description: res.error });
        return;
      }
      const n = res.recipients?.length ?? 0;
      toast.success(`${label} sent to ${n} recipient${n === 1 ? "" : "s"}`, { description: res.subject });
    });

  return (
    <div className="py-4 border-t border-border">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-sm text-ink" style={{ fontWeight: 500 }}>
            {label}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">{hint}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onTest && (
            <Button
              variant="secondary"
              size="sm"
              onClick={test}
              disabled={testing}
              leadingIcon={testing ? <Loader2 className="animate-spin" /> : <Mail />}
            >
              {testing ? "Sending…" : "Send me a test"}
            </Button>
          )}
          {onSendNow && (
            <Button
              variant="secondary"
              size="sm"
              onClick={sendNow}
              disabled={sending}
              leadingIcon={sending ? <Loader2 className="animate-spin" /> : <Send />}
            >
              {sending ? "Sending…" : "Send now"}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(undefined);
            }}
            placeholder="Empty = off. e.g. maya@ledgerline.local, rohan@ledgerline.local"
            autoComplete="off"
            aria-label={`${label} recipients`}
            className={[
              "w-full rounded border bg-bg px-3 py-2 text-sm text-ink",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-raised transition-colors",
              error ? "border-bad" : "border-border",
            ].join(" ")}
          />
          {error && <p className="mt-1.5 text-xs text-bad">{error}</p>}
        </div>
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
