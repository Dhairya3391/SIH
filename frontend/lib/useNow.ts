"use client";

import { useEffect, useState } from "react";

/**
 * The current time, as state rather than as a call during render.
 *
 * Two reasons this is a hook and not a `Date.now()` inside the component:
 *
 *  — Reading the clock while rendering is impure, and React is now explicit
 *    about that. A component that reads the clock in render can produce a
 *    different tree on the server than on the client, which is a hydration
 *    mismatch waiting for the first page that server-renders a timestamp.
 *
 *  — Ages and countdowns want to move on their own. Passing a refresh
 *    interval keeps "4h in the queue" honest without the page being reloaded.
 *
 * Returns null on the very first render, meaning "not known yet". Callers must
 * render a dash rather than a zero for that frame — which is the same rule
 * every other unmeasured figure in this app follows.
 */
export function useNow(refreshMs?: number): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Deferred to a task so the first read happens after the commit, not
    // synchronously inside the effect.
    const first = setTimeout(tick, 0);
    if (!refreshMs) return () => clearTimeout(first);
    const repeat = setInterval(tick, refreshMs);
    return () => {
      clearTimeout(first);
      clearInterval(repeat);
    };
  }, [refreshMs]);

  return now;
}
