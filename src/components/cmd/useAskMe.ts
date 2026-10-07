"use client";

// "Ask Me" state: the guided question builder behind Tab in the palette input.
//
// Two states, and the palette renders one list or the other:
//   browsing  no cue picked — show the cue list, animate the placeholder
//   filling   a cue picked — show that slot's real values, one slot at a time
//
// Slot values come from lib/cmd/cues (months and top-N are static) or
// /api/cmd/options (accounts, groups, APIs). Fetched lists are cached per slot
// for the life of the palette, so stepping back and forth between slots doesn't
// re-hit the server.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cuesFor,
  staticSlotOptions,
  type CmdCue,
  type SlotKind,
  type SlotOption,
  type CueResolution,
} from "@/lib/cmd/cues";
import type { Role } from "@/components/cmd/actions";

export type AskMeState = {
  /** Ask Me is engaged. */
  on: boolean;
  /** The picked cue, or null while browsing. */
  cue: CmdCue | null;
  /** Values chosen so far, index-aligned to cue.slots. */
  values: (SlotOption | null)[];
  /** Which slot is being filled. */
  slotIndex: number;
  /** Options for the current slot — [] while loading or when browsing. */
  options: SlotOption[];
  loading: boolean;
  cues: CmdCue[];
};

export function useAskMe(opts: {
  role: Role;
  open: boolean;
  /** Called with the finished question when the last slot is filled. */
  onResolve: (r: CueResolution) => void;
}) {
  const { role, open, onResolve } = opts;

  const [on, setOn] = useState(false);
  const [cue, setCue] = useState<CmdCue | null>(null);
  const [values, setValues] = useState<(SlotOption | null)[]>([]);
  const [slotIndex, setSlotIndex] = useState(0);
  const [fetched, setFetched] = useState<SlotOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  // slot kind → options, for the life of the palette.
  const cache = useRef<Map<SlotKind, SlotOption[]>>(new Map());
  const abort = useRef<AbortController | null>(null);

  const cues = useMemo(() => cuesFor(role), [role]);

  const reset = useCallback(() => {
    setOn(false);
    setCue(null);
    setValues([]);
    setSlotIndex(0);
    setFetched(null);
    setLoading(false);
    abort.current?.abort();
  }, []);

  // Closing the palette ends the session.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const start = useCallback(() => {
    setOn(true);
    setCue(null);
    setValues([]);
    setSlotIndex(0);
  }, []);

  const currentSlot = cue?.slots[slotIndex] ?? null;

  // Load the current slot's options: static where we can, fetched otherwise.
  useEffect(() => {
    if (!on || !currentSlot) {
      setFetched(null);
      return;
    }
    const isStatic = staticSlotOptions(currentSlot.kind);
    if (isStatic) {
      setFetched(null);
      return;
    }
    const cached = cache.current.get(currentSlot.kind);
    if (cached) {
      setFetched(cached);
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    fetch(`/api/cmd/options?slot=${currentSlot.kind}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { options?: SlotOption[] }) => {
        const list = d.options ?? [];
        cache.current.set(currentSlot.kind, list);
        setFetched(list);
      })
      .catch(() => {
        /* aborted or offline — the list stays empty and the row says so */
      })
      .finally(() => setLoading(false));
  }, [on, currentSlot]);

  const options = useMemo(() => {
    if (!currentSlot) return [];
    return staticSlotOptions(currentSlot.kind) ?? fetched ?? [];
  }, [currentSlot, fetched]);

  /**
   * Hand the finished question over and close the builder. Resetting here — not
   * at the call site — is what keeps the palette's resolve handler free of a
   * circular reference back into this hook.
   */
  const finish = useCallback(
    (r: CueResolution) => {
      reset();
      onResolve(r);
    },
    [reset, onResolve]
  );

  /** Pick a cue and move to its first slot — or resolve immediately if it has none. */
  const pickCue = useCallback(
    (next: CmdCue) => {
      if (next.slots.length === 0) {
        finish(next.build([]));
        return;
      }
      setCue(next);
      setValues(new Array(next.slots.length).fill(null));
      setSlotIndex(0);
    },
    [finish]
  );

  /** Fill the current slot, then advance — or resolve if that was the last one. */
  const pickValue = useCallback(
    (option: SlotOption) => {
      if (!cue) return;
      const next = [...values];
      next[slotIndex] = option;
      if (slotIndex + 1 < cue.slots.length) {
        setValues(next);
        setSlotIndex(slotIndex + 1);
      } else {
        finish(cue.build(next));
      }
    },
    [cue, values, slotIndex, finish]
  );

  /**
   * Skip the current slot. Only legal when it's optional — the ask layer's own
   * default then applies (MTD for a period).
   */
  const skipSlot = useCallback(() => {
    if (!cue) return;
    if (!cue.slots[slotIndex]?.optional) return;
    if (slotIndex + 1 < cue.slots.length) setSlotIndex(slotIndex + 1);
    else finish(cue.build(values));
  }, [cue, slotIndex, values, finish]);

  /** Back one step: to the previous slot, or out to the cue list. */
  const back = useCallback(() => {
    if (!cue) {
      setOn(false);
      return;
    }
    if (slotIndex === 0) {
      setCue(null);
      setValues([]);
      return;
    }
    const next = [...values];
    next[slotIndex - 1] = null;
    setValues(next);
    setSlotIndex(slotIndex - 1);
  }, [cue, slotIndex, values]);

  const state: AskMeState = { on, cue, values, slotIndex, options, loading, cues };
  return { state, start, reset, pickCue, pickValue, skipSlot, back };
}
