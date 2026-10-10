import { useCallback, useRef, useState } from "react";

const LIMIT = 100;

interface State<T> { present: T; past: T[]; future: T[] }

/**
 * Undoable state. `set` records a history step by default; pass `{ record: false }`
 * for live drag updates and call `checkpoint()` once when the gesture starts.
 */
export default function useHistory<T>(initial: T) {
  const [state, setState] = useState<State<T>>({ present: initial, past: [], future: [] });
  const ref = useRef(state);
  ref.current = state;

  const set = useCallback((next: T | ((prev: T) => T), opts: { record?: boolean } = {}) => {
    setState((s) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(s.present) : next;
      if (value === s.present) return s;
      if (opts.record === false) return { ...s, present: value };
      return { present: value, past: [...s.past, s.present].slice(-LIMIT), future: [] };
    });
  }, []);

  /** Snapshot the current value so a following series of unrecorded sets undoes as one step. */
  const checkpoint = useCallback(() => {
    const snap = ref.current.present;
    setState((s) => ({ ...s, past: [...s.past, s.present].slice(-LIMIT), future: [] }));
    return snap;
  }, []);

  /** Drops the last checkpoint if nothing changed since it was taken. */
  const settle = useCallback((snap: T) => {
    setState((s) => (s.present === snap && s.past[s.past.length - 1] === snap ? { ...s, past: s.past.slice(0, -1) } : s));
  }, []);

  const undo = useCallback(() => {
    setState((s) => (s.past.length ? { present: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1) } : s));
  }, []);

  /** Replace the value and clear history (e.g. after loading a saved project). */
  const reset = useCallback((value: T) => setState({ present: value, past: [], future: [] }), []);

  return { value: state.present, set, checkpoint, settle, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
