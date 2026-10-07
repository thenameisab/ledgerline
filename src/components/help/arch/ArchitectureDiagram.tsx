"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "framer-motion";
import { Pin } from "lucide-react";
import {
  ARCH_H,
  ARCH_W,
  EDGES,
  FLOWS,
  LANES,
  LANE_W,
  NODES,
  type ArchEdge,
  type ArchNode,
  type LaneId,
  type Side,
} from "./arch-data";
import "./arch.css";

/* ── Geometry: exact anchor points + cubic bezier paths ─────────────────── */

const NORMAL: Record<Side, readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

const NODE_BY_ID = new Map<string, ArchNode>(NODES.map((n) => [n.id, n]));
const EDGE_BY_ID = new Map<string, ArchEdge>(EDGES.map((e) => [e.id, e]));

/** Lane → OKLCH hue, matching the CSS lane tints. */
// Lane hues, taken from the categorical chart families in priority order so the
// map belongs to the same palette as every chart: azure, purple, green, sky,
// pink. Kept in sync with the `--lane-*` fallbacks in arch.css.
const LANE_HUE: Record<LaneId, number> = {
  browser: 264,
  edge: 290,
  server: 160,
  db: 240,
  ext: 350,
};

/** For each node: its neighbours with direction (out = this → other). */
const NEIGHBORS = new Map<string, { id: string; dir: "out" | "in" }[]>();
for (const n of NODES) NEIGHBORS.set(n.id, []);
for (const e of EDGES) {
  NEIGHBORS.get(e.from)?.push({ id: e.to, dir: "out" });
  NEIGHBORS.get(e.to)?.push({ id: e.from, dir: "in" });
}

function anchor(n: ArchNode, side: Side, dy = 0, dx = 0): [number, number] {
  const cx = n.x + n.w / 2 + dx;
  const cy = n.y + n.h / 2 + dy;
  switch (side) {
    case "left":
      return [n.x, cy];
    case "right":
      return [n.x + n.w, cy];
    case "top":
      return [cx, n.y];
    case "bottom":
      return [cx, n.y + n.h];
  }
}

function pathFor(e: ArchEdge): string {
  const from = NODE_BY_ID.get(e.from);
  const to = NODE_BY_ID.get(e.to);
  if (!from || !to) return "";
  const a = anchor(from, e.fromSide, e.fromDy, e.fromDx);
  const b = anchor(to, e.toSide, e.toDy, e.toDx);
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const k = e.k ?? Math.max(24, Math.min(90, dist * 0.45));
  const n1 = NORMAL[e.fromSide];
  const n2 = NORMAL[e.toSide];
  const c1 = [a[0] + n1[0] * k, a[1] + n1[1] * k];
  const c2 = [b[0] + n2[0] * k, b[1] + n2[1] * k];
  return `M ${a[0]} ${a[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${b[0]} ${b[1]}`;
}

const PATHS: Record<string, string> = Object.fromEntries(
  EDGES.map((e) => [e.id, pathFor(e)])
);

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

const STEP_MS = 3000;
const CARD_W = 300;

/* ── Component ───────────────────────────────────────────────────────────── */

export function ArchitectureDiagram() {
  const [flowId, setFlowId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();

  const flow = useMemo(() => FLOWS.find((f) => f.id === flowId) ?? null, [flowId]);
  const current = flow ? flow.steps[Math.min(step, flow.steps.length - 1)] : null;
  const activeId = hoverId ?? pinId;
  const active = activeId ? NODE_BY_ID.get(activeId) ?? null : null;

  /* Every edge / node id the selected flow touches. */
  const involved = useMemo(() => {
    const s = new Set<string>();
    flow?.steps.forEach((st) => st.edges.forEach((e) => s.add(e.id)));
    return s;
  }, [flow]);
  const flowNodes = useMemo(() => {
    const s = new Set<string>();
    involved.forEach((id) => {
      const e = EDGE_BY_ID.get(id);
      if (e) { s.add(e.from); s.add(e.to); }
    });
    return s;
  }, [involved]);

  /* Edges pulsing in the current step → reverse flag. */
  const stepEdges = useMemo(() => {
    const m = new Map<string, boolean>();
    current?.edges.forEach((e) => m.set(e.id, !!e.rev));
    return m;
  }, [current]);
  const hot = useMemo(() => {
    const s = new Set<string>();
    stepEdges.forEach((_r, id) => {
      const e = EDGE_BY_ID.get(id);
      if (e) { s.add(e.from); s.add(e.to); }
    });
    return s;
  }, [stepEdges]);

  /* Explore mode: neighbours of the active (hovered/pinned) node. */
  const neighborIds = useMemo(() => {
    if (flow || !activeId) return null;
    return new Set((NEIGHBORS.get(activeId) ?? []).map((x) => x.id));
  }, [flow, activeId]);

  /* Auto-advance narration while a flow plays. */
  useEffect(() => {
    if (!flow || reduced) return;
    const t = window.setInterval(
      () => setStep((s) => (s + 1) % flow.steps.length),
      STEP_MS
    );
    return () => window.clearInterval(t);
  }, [flow, reduced]);

  /* Esc clears focus. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPinId(null); setFlowId(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Fit the fixed grid to the container width. */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 2) / ARCH_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function edgeState(id: string): "" | "dim" | "lit" | "active" | "near" {
    if (flow) {
      if (stepEdges.has(id)) return "active";
      if (involved.has(id)) return "lit";
      return "dim";
    }
    if (activeId) {
      const e = EDGE_BY_ID.get(id);
      return e && (e.from === activeId || e.to === activeId) ? "near" : "dim";
    }
    return "";
  }

  function nodeState(id: string): "" | "dim" | "lit" | "hot" {
    if (flow) {
      if (hot.has(id)) return "hot";
      if (flowNodes.has(id)) return "lit";
      return "dim";
    }
    if (activeId) {
      if (id === activeId) return "hot";
      if (neighborIds?.has(id)) return "lit";
      return "dim";
    }
    return "";
  }

  /* Card placement (scaled coords, unscaled card). */
  const fitW = ARCH_W * scale;
  const fitH = ARCH_H * scale;
  let card: { left: number; top: number } | null = null;
  if (active) {
    const nx = active.x * scale;
    const ny = active.y * scale;
    const nw = active.w * scale;
    const rightRoom = fitW - (nx + nw);
    let left = rightRoom >= CARD_W + 16 ? nx + nw + 14 : nx - CARD_W - 14;
    left = Math.max(6, Math.min(left, fitW - CARD_W - 6));
    // Anchor near the node's top, but keep tall cards from running off the
    // bottom of the stage (the card itself caps height + scrolls if needed).
    const top = Math.max(4, Math.min(ny - 6, Math.max(4, fitH - 300)));
    card = { left, top };
  }

  const rootStyle = { "--flow": flow?.color ?? "var(--color-accent)" } as CSSProperties;

  return (
    <section
      className="arch-root"
      style={rootStyle}
      aria-label="Interactive Ledgerline architecture diagram"
    >
      <header className="arch-head">
        <span className="arch-flows-label">Trace</span>
        {FLOWS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={cx("arch-flowchip", flowId === f.id && "is-on")}
            style={{ "--chip": f.color } as CSSProperties}
            aria-pressed={flowId === f.id}
            onClick={() => {
              setPinId(null);
              setHoverId(null);
              setFlowId((id) => (id === f.id ? null : f.id));
              setStep(0);
            }}
          >
            <span className="arch-flowdot" aria-hidden />
            {f.label}
          </button>
        ))}
        {(flow || pinId) && (
          <button type="button" className="arch-reset" onClick={() => { setFlowId(null); setPinId(null); }}>
            Reset
          </button>
        )}
      </header>

      <div className="arch-stagewrap" ref={wrapRef}>
        <div className="arch-fit" style={{ width: fitW, height: fitH }}>
          <div
            className="arch-canvas"
            style={{ width: ARCH_W, height: ARCH_H, transform: `scale(${scale})` }}
            onClick={(e) => { if (e.target === e.currentTarget) setPinId(null); }}
          >
            {LANES.map((lane) => (
              <div
                key={lane.id}
                className="arch-lane"
                style={{ left: lane.x, width: LANE_W, "--lh": LANE_HUE[lane.id] } as CSSProperties}
                aria-hidden
              >
                <span className="arch-lane-head">
                  <span className="arch-lane-label">{lane.label}</span>
                  <span className="arch-lane-sub">{lane.sub}</span>
                </span>
              </div>
            ))}

            <svg
              className="arch-svg"
              width={ARCH_W}
              height={ARCH_H}
              viewBox={`0 0 ${ARCH_W} ${ARCH_H}`}
              aria-hidden
            >
              {EDGES.map((e) => {
                const st = edgeState(e.id);
                return (
                  <path
                    key={e.id}
                    d={PATHS[e.id]}
                    pathLength={1}
                    className={cx("arch-edge", st && `arch-edge--${st}`)}
                  />
                );
              })}
              {!reduced &&
                flow &&
                [...stepEdges].map(([id, rev]) => (
                  <path
                    key={`pulse-${id}`}
                    d={PATHS[id]}
                    pathLength={1}
                    className={cx("arch-pulse", rev && "is-rev")}
                  />
                ))}
            </svg>

            {NODES.map((n) => {
              const s = nodeState(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  className={cx("arch-node", s && `is-${s}`)}
                  style={{
                    left: n.x,
                    top: n.y,
                    width: n.w,
                    height: n.h,
                    "--lh": LANE_HUE[n.lane],
                  } as CSSProperties}
                  onMouseEnter={() => setHoverId(n.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(n.id)}
                  onBlur={() => setHoverId(null)}
                  onClick={() => setPinId((id) => (id === n.id ? null : n.id))}
                  aria-label={`${n.title} — ${n.sub ?? ""}. Show details.`}
                >
                  <span className="arch-node-title">{n.title}</span>
                  {n.sub && (
                    <span className={cx("arch-node-sub", n.subMono && "is-mono")}>{n.sub}</span>
                  )}
                  {n.chips && (
                    <span className="arch-node-chips">
                      {n.chips.map((c) => (
                        <span key={c} className="arch-node-chip">{c}</span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {active && card && (
            <NodeCard
              node={active}
              left={card.left}
              top={card.top}
              pinned={pinId === active.id}
              onPick={(id) => setPinId(id)}
            />
          )}
        </div>
      </div>

      <div className="arch-caption" aria-live="polite">
        {flow ? (
          <ol className="arch-steps">
            {flow.steps.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={cx("arch-stepbtn", i === step && "is-now")}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                >
                  <span className="arch-stepnum" aria-hidden>{i + 1}</span>
                  <span>{s.text}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="arch-hint">
            Hover any node to light its connections and read what it does; click to
            pin the card. Pick a flow above to watch a request travel the stack.
            <kbd>Esc</kbd> clears the view.
          </p>
        )}
      </div>
    </section>
  );
}

/* ── Anchored detail card ────────────────────────────────────────────────── */

function NodeCard({
  node,
  left,
  top,
  pinned,
  onPick,
}: {
  node: ArchNode;
  left: number;
  top: number;
  pinned: boolean;
  onPick: (id: string) => void;
}) {
  const lane = LANES.find((l) => l.id === node.lane);
  const conns = NEIGHBORS.get(node.id) ?? [];
  return (
    <aside
      className="arch-card"
      style={{ left, top, "--lh": LANE_HUE[node.lane] } as CSSProperties}
      role="dialog"
      aria-label={node.title}
    >
      {pinned && (
        <span className="arch-card-pin"><Pin size={9} aria-hidden /> Pinned</span>
      )}
      <span className="arch-card-lane">{lane?.label}</span>
      <h3 className="arch-card-title">{node.title}</h3>
      {node.sub && (
        <div className={cx("arch-card-sub", node.subMono && "is-mono")}>{node.sub}</div>
      )}
      <p className="arch-card-desc">{node.desc}</p>

      {conns.length > 0 && (
        <>
          <div className="arch-card-sectlabel">Talks to</div>
          <div className="arch-card-conns">
            {conns.map((c) => {
              const other = NODE_BY_ID.get(c.id);
              if (!other) return null;
              return (
                <button
                  key={`${c.id}-${c.dir}`}
                  type="button"
                  className="arch-conn"
                  onClick={() => onPick(c.id)}
                >
                  <span className="arch-conn-dir" aria-hidden>{c.dir === "out" ? "→" : "←"}</span>
                  {other.title}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="arch-card-sectlabel">Key files</div>
      <ul className="arch-card-files">
        {node.files.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </aside>
  );
}
