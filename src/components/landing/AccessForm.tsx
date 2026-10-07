"use client";

// The demo gate. Embeds the Tally form; when Tally reports a submission, asks
// the app to set the access cookie and moves on to the demo sign-in.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { TALLY_FORM_ID } from "@/lib/demo-access";

const TALLY_SCRIPT = "https://tally.so/widgets/embed.js";

type Phase = "form" | "opening" | "error";

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void };
  }
}

export function AccessForm({ hasAccess }: { hasAccess: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(!hasAccess);

  // Pass UTM and referrer parameters through to Tally as hidden fields.
  const src = useMemo(() => {
    const base = `https://tally.so/embed/${TALLY_FORM_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;
    if (typeof window === "undefined") return base;
    const params = new URLSearchParams(window.location.search);
    const extra = new URLSearchParams();
    params.forEach((v, k) => {
      if (k.startsWith("utm_") || k === "ref") extra.set(k, v);
    });
    const q = extra.toString();
    return q ? `${base}&${q}` : base;
  }, []);

  // Load Tally's embed script once; it sizes the iframe to its content.
  useEffect(() => {
    if (!showForm) return;
    const load = () => {
      if (window.Tally) window.Tally.loadEmbeds();
      else if (iframeRef.current && !iframeRef.current.src) iframeRef.current.src = src;
    };
    if (window.Tally) {
      load();
      return;
    }
    let s = document.querySelector<HTMLScriptElement>(`script[src="${TALLY_SCRIPT}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = TALLY_SCRIPT;
      s.async = true;
      document.body.appendChild(s);
    }
    s.addEventListener("load", load);
    s.addEventListener("error", load);
    return () => {
      s?.removeEventListener("load", load);
      s?.removeEventListener("error", load);
    };
  }, [showForm, src]);

  const openDemo = useCallback(async () => {
    setPhase("opening");
    try {
      const res = await fetch("/api/demo-access", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setTimeout(() => router.push("/login"), reduce ? 0 : 700);
    } catch {
      setPhase("error");
    }
  }, [router, reduce]);

  // Tally posts "Tally.FormSubmitted" to the parent page after a submit.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://tally.so") return;
      if (typeof e.data !== "string" || !e.data.includes("Tally.FormSubmitted")) return;
      void openDemo();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [openDemo]);

  if (!showForm) {
    return (
      <div className="rounded-md border border-border bg-bg p-5">
        <div className="flex items-center gap-2 text-[13px] text-ink">
          <Check size={15} className="text-success-ink" aria-hidden />
          You already have access on this browser.
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href="/login"
            className="ll-press inline-flex h-[38px] items-center gap-2 rounded bg-accent px-4 text-[13px] font-medium text-bg-raised shadow-bevel outline-none hover:bg-accent-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Open the demo <ArrowRight size={14} aria-hidden />
          </a>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="ll-press rounded text-[13px] text-ink-faint underline-offset-4 outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            Fill in the form again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[220px]">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "form" ? (
          <motion.div
            key="form"
            initial={false}
            exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)", transform: "scale(0.98)" }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            {!loaded && (
              <div className="space-y-3 py-1" aria-hidden>
                <div className="h-[14px] w-[120px] animate-pulse rounded-sm bg-bg-sunken" />
                <div className="h-[40px] w-full animate-pulse rounded bg-bg-sunken" />
                <div className="h-[40px] w-[140px] animate-pulse rounded bg-bg-sunken" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              data-tally-src={src}
              loading="lazy"
              width="100%"
              height={180}
              frameBorder={0}
              marginHeight={0}
              marginWidth={0}
              title="Demo access form"
              onLoad={() => setLoaded(true)}
              className={loaded ? "block" : "absolute h-px w-px opacity-0"}
            />
          </motion.div>
        ) : (
          <motion.div
            key={phase}
            initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)", transform: "scale(0.98)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transform: "scale(1)" }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="flex min-h-[180px] flex-col items-start justify-center gap-3"
            role="status"
            aria-live="polite"
          >
            {phase === "opening" ? (
              <>
                <div className="flex items-center gap-2 text-[15px] font-medium text-ink">
                  <Check size={16} className="text-success-ink" aria-hidden />
                  Thanks. Opening the demo.
                </div>
                <div className="flex items-center gap-2 text-[13px] text-ink-faint">
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Going to the sign-in page
                </div>
              </>
            ) : (
              <>
                <div className="text-[14px] font-medium text-ink">
                  Your answers were sent, but the demo did not open.
                </div>
                <button
                  type="button"
                  onClick={() => void openDemo()}
                  className="ll-press inline-flex h-[38px] items-center gap-2 rounded bg-accent px-4 text-[13px] font-medium text-bg-raised shadow-bevel outline-none hover:bg-accent-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Try opening it again <ArrowRight size={14} aria-hidden />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
