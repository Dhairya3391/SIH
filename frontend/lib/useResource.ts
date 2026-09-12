"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

/**
 * One loader for every console.
 *
 * It distinguishes three states the UI must never blur together:
 *   loading  — we do not know yet, so show a skeleton, not a zero
 *   error    — the service said why, so show that sentence, not "no data"
 *   loaded   — including legitimately empty, which is its own message
 *
 * A console that renders 0 while it is still fetching is lying, and on this
 * platform the lie reads as "no one has reported anything".
 *
 * The shape of the hook is dictated by two React rules: a ref is never written
 * during render (it is assigned in its own effect, which commits before the
 * fetch effect below it), and state is never set synchronously inside an
 * effect body — every setState here happens inside the async run, after the
 * effect has returned.
 */

interface State<T> {
  data: T | null;
  error: string | null;
  code: string | null;
  status: number | null;
  settled: boolean;
  inFlight: boolean;
}

export interface Resource<T> {
  data: T | null;
  error: string | null;
  /** The API's own error code, when it sent one (e.g. "schema_not_ready"). */
  code: string | null;
  status: number | null;
  loading: boolean;
  /** True after the first settle, so a refresh does not flash a skeleton. */
  settled: boolean;
  reload: () => void;
}

export function useResource<T>(
  load: () => Promise<T>,
  deps: React.DependencyList = [],
  options: { enabled?: boolean } = {},
): Resource<T> {
  const enabled = options.enabled ?? true;

  const [state, setState] = useState<State<T>>(() => ({
    data: null,
    error: null,
    code: null,
    status: null,
    settled: false,
    inFlight: enabled,
  }));
  const [nonce, setNonce] = useState(0);

  // Callers pass an inline arrow, so the function identity changes every
  // render. Keeping it in a ref — assigned in an effect, never during render —
  // means the fetch below re-runs on the declared deps and nothing else.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    let live = true;

    const run = async () => {
      setState((s) => (s.inFlight ? s : { ...s, inFlight: true }));
      try {
        const result = await loadRef.current();
        if (!live) return;
        setState({
          data: result,
          error: null,
          code: null,
          status: null,
          settled: true,
          inFlight: false,
        });
      } catch (e) {
        if (!live) return;
        setState({
          data: null,
          error:
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Something went wrong.",
          code: e instanceof ApiError ? e.code : null,
          status: e instanceof ApiError ? e.status : null,
          settled: true,
          inFlight: false,
        });
      }
    };

    void run();

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return useMemo(
    () => ({
      data: state.data,
      error: state.error,
      code: state.code,
      status: state.status,
      loading: enabled && state.inFlight,
      settled: state.settled,
      reload,
    }),
    [state, enabled, reload],
  );
}

/**
 * For buttons that change something. Tracks the in-flight state and the
 * failure message so the caller does not re-invent try/catch in every handler.
 */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): {
  run: (...args: A) => Promise<R | null>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (...args: A) => {
    setBusy(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, clearError: useCallback(() => setError(null), []) };
}
