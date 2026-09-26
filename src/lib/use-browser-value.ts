import { useSyncExternalStore } from "react";

/**
 * Reads a value that only exists in the browser, without breaking hydration.
 *
 * This site is a static export: every page is rendered once, at build time,
 * on a machine with no `navigator`, no `window` and no query string. Anything
 * read from those has to produce a defined answer on the server, match it on
 * the first client render, and only then change -- otherwise React hydrates
 * markup that disagrees with what it just built.
 *
 * `useState` plus an effect does that too, but it is a second render triggered
 * from inside the first, which is what `react-hooks/set-state-in-effect` is
 * pointing at. `useSyncExternalStore` says the same thing declaratively and
 * gets the server value from a separate snapshot, which is exactly the shape
 * of this problem.
 *
 * Nothing here subscribes: these values are fixed for the lifetime of the
 * page. A capability does not appear halfway through a visit, and the query
 * string is only ever rewritten by us, alongside a state update that
 * re-renders anyway.
 */
const noSubscribe = () => () => {};

export function useBrowserValue<T>(read: () => T, duringBuild: T): T {
  return useSyncExternalStore(noSubscribe, read, () => duringBuild);
}
