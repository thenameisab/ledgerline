"use client";

// Landing snippet: the accounts table as each role sees it. Admins and editors
// see vendor cost and margin; members do not. Editors' price edits go to an
// admin for approval.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Clock, Lock, Pencil, X } from "lucide-react";
import { Label, Segmented, Snippet, usdCompact, useInView } from "@/components/landing/ui";

type Role = "admin" | "editor" | "member";

const ROLES: Role[] = ["admin", "editor", "member"];

const PEOPLE: Record<Role, { name: string; initials: string; role: string }> = {
  admin: { name: "Maya Sharma", initials: "MS", role: "Admin" },
  editor: { name: "Dev Kapoor", initials: "DK", role: "Editor" },
  member: { name: "Rohan Mehta", initials: "RM", role: "Member" },
};

const ROWS = [
  { name: "Quillmark Studio", revenue: 209743, cost: 131070 },
  { name: "Copperleaf CRM", revenue: 180102, cost: 103010 },
  { name: "Harbor Freight", revenue: 96370, cost: 67940 },
  { name: "Brightline Clinics", revenue: 71920, cost: 33500 },
];

const CAN_DO: { label: Record<Role, string>; allowed: Record<Role, boolean> }[] = [
  {
    label: { admin: "Edit prices", editor: "Edit prices (admin approves)", member: "Edit prices" },
    allowed: { admin: true, editor: true, member: false },
  },
  {
    label: {
      admin: "Approve manual entries above $500",
      editor: "Approve manual entries above $500",
      member: "Approve manual entries above $500",
    },
    allowed: { admin: true, editor: false, member: false },
  },
  {
    label: {
      admin: "Merge or delete accounts",
      editor: "Merge or delete accounts (admin approves)",
      member: "Merge or delete accounts",
    },
    allowed: { admin: true, editor: true, member: false },
  },
  {
    label: { admin: "Invite users", editor: "Invite users", member: "Invite users" },
    allowed: { admin: true, editor: false, member: false },
  },
  {
    label: {
      admin: "See vendor cost and margin",
      editor: "See vendor cost and margin",
      member: "See vendor cost and margin",
    },
    allowed: { admin: true, editor: true, member: false },
  },
];

const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function RolesSnippet() {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [role, setRole] = useState<Role>("admin");
  const [edited, setEdited] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const stoppedRef = useRef(false);

  const stop = () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    setStopped(true);
  };

  const pick = (r: Role) => {
    setRole(r);
    setEdited(null);
  };

  // Self-demo: cycle the roles while in view and untouched.
  useEffect(() => {
    if (!inView || stopped || reduce) return;
    const id = window.setInterval(() => {
      if (document.hidden || stoppedRef.current) return;
      setRole((r) => ROLES[(ROLES.indexOf(r) + 1) % ROLES.length]);
      setEdited(null);
    }, 2800);
    return () => window.clearInterval(id);
  }, [inView, stopped, reduce]);

  const showCost = role !== "member";
  const person = PEOPLE[role];
  const layoutT = reduce ? { duration: 0 } : SPRING;
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, filter: "blur(2px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
        exit: { opacity: 0, filter: "blur(2px)" },
      };
  const swapT = { duration: 0.18, ease: EASE_OUT };

  const message =
    edited === null
      ? ""
      : role === "admin"
        ? `${edited}: Saved. Applies from 1 Oct 2026.`
        : `${edited}: Change sent for approval. Maya Sharma approves it in Approvals.`;

  // Cell widths. Account takes the rest. Vendor cost hides under `sm:`.
  const W = {
    rev: "w-[72px] sm:w-[96px]",
    cost: "w-[96px]",
    margin: "w-[60px] sm:w-[72px]",
    action: "w-[36px] sm:w-[100px]",
  };

  return (
    <div ref={ref} onPointerDownCapture={stop} onKeyDownCapture={stop} onFocusCapture={stop}>
      <Snippet
        path="accounts"
        right={
          <Segmented
            size="sm"
            label="Signed-in role"
            value={role}
            onChange={pick}
            options={[
              { value: "admin", label: "Admin" },
              { value: "editor", label: "Editor" },
              { value: "member", label: "Member" },
            ]}
          />
        }
      >
        <div className="p-3 sm:p-4">
          {/* Who is signed in */}
          <div className="flex items-center justify-between gap-3">
            <Label className="min-w-0 truncate">
              <span title="Accounts · Oct 2026 month to date">Accounts · Oct MTD</span>
            </Label>
            <div className="inline-flex shrink-0 h-[28px] items-center gap-1.5 rounded-full border border-border bg-bg pl-0.5 pr-2.5">
              <span
                aria-hidden
                className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent-bg font-mono text-[10px] font-medium text-accent-ink"
              >
                {person.initials}
              </span>
              <span className="relative text-[12px]" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={role} {...swap} transition={swapT} className="inline-block whitespace-nowrap">
                    <span className="text-ink">{person.name}</span>
                    <span className="hidden text-ink-faint sm:inline"> · {person.role}</span>
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
          </div>

          {/* Table. Reserves room for one message line so the card height stays put. */}
          <div className="mt-3 min-h-[262px]">
            <div role="table" aria-label="Accounts" className="rounded border border-border">
              <div
                role="row"
                className="flex h-[32px] items-center gap-2 border-b border-border bg-bg px-2.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-faint"
              >
                <motion.span layout="position" transition={layoutT} role="columnheader" className="min-w-0 flex-1">
                  Account
                </motion.span>
                <motion.span layout="position" transition={layoutT} role="columnheader" className={`${W.rev} shrink-0 text-right`}>
                  Revenue
                </motion.span>
                <AnimatePresence mode="popLayout" initial={false}>
                  {showCost && (
                    <motion.span
                      key="cost-h"
                      layout="position"
                      {...swap}
                      transition={{ ...swapT, layout: layoutT }}
                      role="columnheader"
                      className={`${W.cost} hidden shrink-0 text-right sm:block`}
                    >
                      Vendor cost
                    </motion.span>
                  )}
                  {showCost && (
                    <motion.span
                      key="margin-h"
                      layout="position"
                      {...swap}
                      transition={{ ...swapT, layout: layoutT }}
                      role="columnheader"
                      className={`${W.margin} shrink-0 text-right`}
                    >
                      Margin
                    </motion.span>
                  )}
                </AnimatePresence>
                <motion.span layout="position" transition={layoutT} role="columnheader" className={`${W.action} shrink-0`}>
                  <span className="sr-only">Action</span>
                </motion.span>
              </div>

              {ROWS.map((r, i) => {
                const margin = ((r.revenue - r.cost) / r.revenue) * 100;
                const open = edited === r.name && role !== "member";
                return (
                  <div key={r.name} className={i < ROWS.length - 1 || open ? "border-b border-border" : ""}>
                    <div role="row" className="flex h-[44px] items-center gap-2 px-2.5 text-[13px]">
                      <motion.span
                        layout="position"
                        transition={layoutT}
                        role="cell"
                        className="min-w-0 flex-1 truncate text-ink"
                        title={r.name}
                      >
                        {r.name}
                      </motion.span>
                      <motion.span
                        layout="position"
                        transition={layoutT}
                        role="cell"
                        className={`${W.rev} shrink-0 text-right tabular-nums text-ink`}
                      >
                        {usdCompact(r.revenue)}
                      </motion.span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {showCost && (
                          <motion.span
                            key="cost"
                            layout="position"
                            {...swap}
                            transition={{ ...swapT, layout: layoutT }}
                            role="cell"
                            className={`${W.cost} hidden shrink-0 text-right tabular-nums text-ink-muted sm:block`}
                          >
                            {usdCompact(r.cost)}
                          </motion.span>
                        )}
                        {showCost && (
                          <motion.span
                            key="margin"
                            layout="position"
                            {...swap}
                            transition={{ ...swapT, layout: layoutT }}
                            role="cell"
                            className={`${W.margin} shrink-0 text-right tabular-nums text-ink`}
                          >
                            {margin.toFixed(1)}%
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <motion.span
                        layout="position"
                        transition={layoutT}
                        role="cell"
                        className={`${W.action} flex shrink-0 justify-end`}
                      >
                        {role !== "member" && (
                          <button
                            type="button"
                            onClick={() => setEdited(r.name)}
                            aria-label={`Edit price for ${r.name}`}
                            className="ll-press inline-flex h-[28px] items-center gap-1.5 rounded border border-border bg-bg-raised px-2 text-[12px] font-medium text-ink outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                          >
                            <Pencil size={12} aria-hidden />
                            <span className="hidden sm:inline">Edit price</span>
                          </button>
                        )}
                      </motion.span>
                    </div>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          key={`${role}-${r.name}`}
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: EASE_OUT }}
                          aria-hidden
                          className={`flex items-start gap-1.5 px-2.5 pb-2.5 text-[12px] ${
                            role === "admin" ? "text-ok-ink" : "text-warn-ink"
                          }`}
                        >
                          {role === "admin" ? (
                            <Check size={13} className="mt-[2px] shrink-0" />
                          ) : (
                            <Clock size={13} className="mt-[2px] shrink-0" />
                          )}
                          <span>
                            {role === "admin"
                              ? "Saved. Applies from 1 Oct 2026."
                              : "Change sent for approval. Maya Sharma approves it in Approvals."}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <span className="sr-only" aria-live="polite">
              {message}
            </span>

            <AnimatePresence initial={false}>
              {!showCost && (
                <motion.div
                  key="locked"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="mt-2.5 flex items-start gap-1.5 text-[12px] text-ink-muted"
                >
                  <Lock size={13} className="mt-[2px] shrink-0 text-ink-faint" aria-hidden />
                  <span>Members see revenue and usage. Cost and margin are hidden.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* What this role can do */}
          <div className="mt-3 border-t border-border pt-3">
            <Label>Can do · {person.role}</Label>
            <ul className="mt-2 grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
              {CAN_DO.map((item, i) => {
                const ok = item.allowed[role];
                const label = item.label[role];
                return (
                  <li key={i} className="flex h-[22px] min-w-0 items-center gap-2 text-[12px]">
                    <span
                      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                        ok ? "bg-ok-bg text-ok-ink" : "bg-bg-sunken text-ink-faint"
                      }`}
                      style={{ transition: "background-color 200ms ease, color 200ms ease" }}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span key={ok ? "y" : "n"} {...swap} transition={swapT} className="inline-flex">
                          {ok ? <Check size={11} aria-hidden /> : <X size={11} aria-hidden />}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <span className="sr-only">{ok ? "Allowed:" : "Not allowed:"}</span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={label}
                        {...swap}
                        transition={swapT}
                        className={`min-w-0 truncate ${ok ? "text-ink" : "text-ink-faint line-through"}`}
                        title={label}
                      >
                        {label}
                      </motion.span>
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Snippet>
    </div>
  );
}
