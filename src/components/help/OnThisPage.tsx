"use client";
import { useEffect, useState } from "react";

type Heading = { id: string; text: string; level: number };

/**
 * Right-rail scrollspy. Reads h2/h3[id] out of the rendered article after
 * mount — no per-page wiring needed. Highlights the heading nearest the
 * top of the viewport.
 */
export function OnThisPage() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("article h2[id], article h3[id]")
    );
    setHeadings(
      nodes.map((n) => ({
        id: n.id,
        text: n.textContent?.replace(/\s+/g, " ").trim() ?? "",
        level: n.tagName === "H2" ? 2 : 3,
      }))
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-[12px] leading-snug">
      <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint pb-2.5">
        On this page
      </p>
      <ul className="space-y-0.5">
        {headings.map((h) => {
          const on = activeId === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={[
                  "flex items-center gap-2 rounded-md py-1 pr-2 truncate transition-colors duration-fast ease-expo",
                  h.level === 3 ? "pl-5" : "pl-2.5",
                  on
                    ? "text-accent-ink font-medium bg-accent-bg/50"
                    : "text-ink-faint hover:text-ink hover:bg-bg-sunken",
                ].join(" ")}
                title={h.text}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-fast",
                    on ? "bg-accent" : "bg-transparent",
                  ].join(" ")}
                  aria-hidden
                />
                <span className="truncate">{h.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
