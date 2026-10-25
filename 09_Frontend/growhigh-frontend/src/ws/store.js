import { useSyncExternalStore } from "react";

// Session-only store used by the screens until the matching backend module exists.
let s = { last: null, questions: [], tests: [] };
const subs = new Set();
export const useStore = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => s);
export const update = (fn) => { s = { ...s, ...fn(s) }; subs.forEach((f) => f()); };
