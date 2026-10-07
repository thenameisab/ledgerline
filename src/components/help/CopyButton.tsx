"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { RollingText, SUCCESS_ROLL } from "@/components/ui/RollingText";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs hover:bg-bg-raised transition-colors duration-fast ease-expo ${
        copied ? "text-success" : "text-ink-faint hover:text-ink"
      }`}
    >
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      <RollingText
        text={copied ? "Copied" : "Copy"}
        options={{
          direction: copied ? "up" : "down",
          color: copied ? SUCCESS_ROLL : undefined,
        }}
      />
    </button>
  );
}
