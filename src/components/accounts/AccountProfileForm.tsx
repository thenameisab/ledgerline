"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Loader2, Upload, Trash2, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { RollingText, SUCCESS_ROLL } from "@/components/ui/RollingText";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { CS_TEAM, SALES_TEAM } from "@/lib/team";
import { saveAccountProfile } from "@/app/accounts/[slug]/profile/actions";

type Initial = {
  client_code: string | null;
  billing_entity: string | null;
  website: string | null;
  cs_owner: string | null;
  sales_owner: string | null;
  logo_data_url: string | null;
  msa_url: string | null;
  msa_start_date: string | null;
  msa_end_date: string | null;
};

type Owner = { name: string };
const toOptions = (names: readonly string[]): Owner[] => names.map((name) => ({ name }));

const MAX_DIM = 256; // downscale longest edge to this before encoding

/** Reduce a website value to a bare hostname logo.dev can resolve (drops
 *  scheme, "www.", path/query). Empty string when there's nothing usable. */
function toDomain(website: string): string {
  return website
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
}

export function AccountProfileForm({
  slug,
  displayName,
  initial,
}: {
  slug: string;
  displayName: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [accountCode, setAccountCode] = useState(initial.client_code ?? "");
  const [legalName, setLegalName] = useState(initial.billing_entity ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [csOwner, setCsOwner] = useState(initial.cs_owner ?? "");
  const [salesOwner, setSalesOwner] = useState(initial.sales_owner ?? "");
  const [logo, setLogo] = useState<string | null>(initial.logo_data_url ?? null);
  const [msaUrl, setMsaUrl] = useState(initial.msa_url ?? "");
  const [msaStart, setMsaStart] = useState(initial.msa_start_date ?? "");
  const [msaEnd, setMsaEnd] = useState(initial.msa_end_date ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const domain = toDomain(website);

  function clearError(key: string) {
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  async function downscaleToDataUrl(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL("image/png");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image.");
      return;
    }
    try {
      const dataUrl = await downscaleToDataUrl(file);
      setLogo(dataUrl);
      clearError("logo_data_url");
    } catch {
      toast.error("Couldn't read that image.");
    }
  }

  // logo.dev resolves logos by domain, so a website is required. Fetch directly
  // from the website's domain — no brand-name search step.
  async function fetchLogo() {
    if (!domain) {
      setErrors((e) => ({ ...e, website: "Add the website first to fetch its logo." }));
      toast.error("Add the website first.");
      return;
    }
    setFetchingLogo(true);
    try {
      const res = await fetch(`/api/accounts/logo/fetch?domain=${encodeURIComponent(domain)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't fetch that logo.");
        return;
      }
      setLogo(data.data_url);
      clearError("logo_data_url");
      toast.success("Logo fetched", { description: domain });
    } catch {
      toast.error("Network error fetching logo.");
    } finally {
      setFetchingLogo(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    try {
      const result = await saveAccountProfile(slug, {
        display_name: name,
        client_code: accountCode,
        billing_entity: legalName,
        website,
        cs_owner: csOwner,
        sales_owner: salesOwner,
        logo_data_url: logo,
        msa_url: msaUrl,
        msa_start_date: msaStart,
        msa_end_date: msaEnd,
      });
      if (result.ok) {
        toast.success("Profile saved");
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
        // A rename changes the slug, so this page's URL is now stale — move to
        // the canonical one (the old URL still redirects here for anyone else).
        if (result.slug !== slug) {
          router.replace(`/accounts/${result.slug}/profile`);
        } else {
          router.refresh();
        }
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        toast.error("Please fix the highlighted fields.");
      } else {
        toast.error(result.error ?? "Couldn't save.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const previewName = name.trim() || displayName;
  // Empty when legal name and code are both empty. The preview then omits the
  // line, as the real page header omits an empty subtitle.
  const previewSubtitle = [legalName.trim(), accountCode.trim()].filter(Boolean).join(" · ");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] items-start">
      {/* ── Editor ─────────────────────────────────────────────── */}
      <section
        className="rounded-lg border border-border bg-bg-raised p-6 dash-enter"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <h2 className="text-sm font-semibold text-ink mb-4">Identity</h2>
        <div className="space-y-4">
          <Field
            id="cp-name"
            label="Account name"
            hint="Shown on the accounts list and across the account's pages."
            error={errors.display_name}
          >
            <input
              id="cp-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("display_name");
              }}
              placeholder="Acme Financial"
              autoComplete="off"
              className={inputClass(!!errors.display_name)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="cp-account-code"
              label="Account ID"
              hint="Letters, numbers, dot and dash. Must be unique."
              error={errors.client_code}
            >
              <input
                id="cp-account-code"
                type="text"
                value={accountCode}
                onChange={(e) => {
                  setAccountCode(e.target.value);
                  clearError("client_code");
                }}
                placeholder="acme-fin.01"
                autoComplete="off"
                className={inputClass(!!errors.client_code)}
              />
            </Field>

            <Field
              id="cp-website"
              label="Website"
              hint="Used to fetch the logo from logo.dev."
              error={errors.website}
            >
              <input
                id="cp-website"
                type="text"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  clearError("website");
                }}
                placeholder="acme.com"
                autoComplete="off"
                className={inputClass(!!errors.website)}
              />
            </Field>
          </div>

          <Field id="cp-legal-name" label="Legal name" error={errors.billing_entity}>
            <input
              id="cp-legal-name"
              type="text"
              value={legalName}
              onChange={(e) => {
                setLegalName(e.target.value);
                clearError("billing_entity");
              }}
              placeholder="Acme Financial Services Pvt. Ltd."
              autoComplete="off"
              className={inputClass(!!errors.billing_entity)}
            />
          </Field>
        </div>

        <h2 className="text-sm font-semibold text-ink mb-4 mt-7 pt-5 border-t border-border">
          Ownership
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="cp-cs-owner" label="Customer Success owner" error={errors.cs_owner}>
            <Combobox
              options={toOptions(CS_TEAM)}
              value={csOwner}
              onChange={(v) => {
                setCsOwner(v);
                clearError("cs_owner");
              }}
              getValue={(o) => o.name}
              getLabel={(o) => o.name}
              keys={["name"]}
              emptyLabel="Unassigned"
              noneLabel="Unassigned"
              searchPlaceholder="Search CS team…"
              className="py-2"
            />
          </Field>

          <Field id="cp-sales-owner" label="Sales owner" error={errors.sales_owner}>
            <Combobox
              options={toOptions(SALES_TEAM)}
              value={salesOwner}
              onChange={(v) => {
                setSalesOwner(v);
                clearError("sales_owner");
              }}
              getValue={(o) => o.name}
              getLabel={(o) => o.name}
              keys={["name"]}
              emptyLabel="Unassigned"
              noneLabel="Unassigned"
              searchPlaceholder="Search Sales team…"
              className="py-2"
            />
          </Field>
        </div>

        <div className="pt-5 mt-7 border-t border-border">
          <h3 className="text-sm font-semibold text-ink mb-1">MSA</h3>
          <p className="text-xs text-ink-faint mb-4">
            Master Service Agreement on file. An account with over a week of logged
            usage and no MSA here is flagged across the app.
          </p>
          <div className="space-y-4">
            <Field
              id="cp-msa-url"
              label="MSA document link"
              hint="Link to the signed MSA (Drive, DocuSign, etc.)."
              error={errors.msa_url}
            >
              <input
                id="cp-msa-url"
                type="url"
                value={msaUrl}
                onChange={(e) => {
                  setMsaUrl(e.target.value);
                  clearError("msa_url");
                }}
                placeholder="https://drive.google.com/…"
                autoComplete="off"
                className={inputClass(!!errors.msa_url)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="cp-msa-start" label="MSA start date" error={errors.msa_start_date}>
                <input
                  id="cp-msa-start"
                  type="date"
                  value={msaStart}
                  onChange={(e) => {
                    setMsaStart(e.target.value);
                    clearError("msa_start_date");
                  }}
                  className={inputClass(!!errors.msa_start_date)}
                />
              </Field>

              <Field
                id="cp-msa-end"
                label="MSA end date"
                hint="Leave blank for open-ended terms."
                error={errors.msa_end_date}
              >
                <input
                  id="cp-msa-end"
                  type="date"
                  value={msaEnd}
                  onChange={(e) => {
                    setMsaEnd(e.target.value);
                    clearError("msa_end_date");
                  }}
                  className={inputClass(!!errors.msa_end_date)}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-5 mt-7 border-t border-border">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={saving}
            leadingIcon={saving ? <Loader2 className="animate-spin" /> : undefined}
          >
            <RollingText
              text={saving ? "Saving…" : saved ? "Saved" : "Save profile"}
              options={{ direction: "up", color: saved ? SUCCESS_ROLL : undefined }}
            />
          </Button>
        </div>
      </section>

      {/* ── Live preview ───────────────────────────────────────────
          Renders the identity as it appears elsewhere in the app — the
          page header and an accounts-list row — updating as the user types,
          so the whitespace beside the form earns its keep. */}
      <aside className="lg:sticky lg:top-6 space-y-6 dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
        <section className="rounded-lg border border-border bg-bg-raised p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink-muted mb-4">
            <Eye size={12} strokeWidth={1.5} />
            <span>Live preview</span>
          </div>

          <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-2">
            Page header
          </div>
          <div className="rounded-md border border-border bg-bg px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <AccountLogo name={previewName} logoUrl={logo} size={32} />
              </div>
              <div className="min-w-0">
                <div
                  className="font-sans text-2xl text-ink leading-tight truncate"
                  style={{ fontWeight: 600 }}
                >
                  {previewName}
                </div>
                {previewSubtitle && (
                  <TruncateTooltip as="div" text={previewSubtitle} className="text-sm text-ink-muted mt-1" />
                )}
              </div>
            </div>
          </div>

          <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-2 mt-4">
            Accounts list
          </div>
          <div className="rounded-md border border-border bg-bg px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <AccountLogo name={previewName} logoUrl={logo} size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink truncate" style={{ fontWeight: 500 }}>
                  {previewName}
                </div>
                {(csOwner || salesOwner) && (
                  <div className="text-xs text-ink-faint truncate">
                    {[csOwner ? `CS · ${csOwner}` : null, salesOwner ? `Sales · ${salesOwner}` : null]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </div>
                )}
              </div>
              {domain && (
                <span className="shrink-0 text-[10px] font-mono text-ink-faint bg-bg-sunken px-1.5 py-0.5 rounded">
                  {domain}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-ink-faint leading-normal mt-4">
            Updates as you type. Save to apply everywhere — list, header, invoices and hover
            cards.
          </p>
        </section>

        {/* Logo — lives under the preview so a fetched/uploaded logo is seen
            in context immediately (the standard layout across products). */}
        <section className="rounded-lg border border-border bg-bg-raised p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Logo</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={[
              "flex flex-wrap items-center gap-4 rounded-md border border-dashed p-4",
              "transition-colors duration-fast ease-expo",
              dragOver ? "border-accent bg-accent-bg" : "border-border bg-bg",
            ].join(" ")}
          >
            <AccountLogo name={previewName} logoUrl={logo} size={56} />
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs text-ink-faint leading-normal mb-2">
                {dragOver
                  ? "Drop to set the logo."
                  : "Drop an image here, upload, or fetch from logo.dev."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Upload />}
                  onClick={() => fileRef.current?.click()}
                >
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leadingIcon={fetchingLogo ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  onClick={fetchLogo}
                  disabled={!domain || fetchingLogo}
                  title={domain ? `Fetch ${domain}'s logo` : "Add a website to enable logo.dev"}
                >
                  Fetch from logo.dev
                </Button>
                {logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Trash2 />}
                    onClick={() => setLogo(null)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              {!domain && (
                <p className="text-xs text-ink-faint mt-2">Add a website to enable logo.dev fetch.</p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          {errors.logo_data_url && (
            <p className="mt-2 flex items-center gap-1 text-xs text-bad">
              <AlertCircle size={12} className="shrink-0" />
              {errors.logo_data_url}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-bad">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return [
    "w-full rounded border bg-bg px-3 py-2 text-sm text-ink",
    "placeholder:text-ink-faint",
    "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-raised",
    "transition-colors",
    hasError ? "border-bad" : "border-border",
  ].join(" ");
}
