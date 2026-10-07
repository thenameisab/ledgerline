"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Click-to-zoom wrapper for doc screenshots. Renders its child (the <img>)
 * as a button; on activate, shows the full-size image over a dimmed overlay.
 * Esc or click anywhere closes.
 */
export function Lightbox({ src, alt, children }: { src: string; alt: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in focus-visible:outline-2"
        aria-label={`Enlarge screenshot: ${alt}`}
      >
        {children}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-6 cursor-zoom-out"
          style={{ animation: "row-enter var(--motion-duration-fast) var(--motion-ease-soft) both" }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink/60 text-bg hover:bg-ink transition-colors duration-fast"
          >
            <X size={18} aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg shadow-2xl outline outline-1 -outline-offset-1 outline-black/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
