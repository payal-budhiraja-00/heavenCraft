/**
 * The commerce preview gate.
 *
 * ## Why this is client-side, and why that is not a compromise
 *
 * This site is a static export sitting behind Cloudflare. Every visitor is
 * served byte-identical HTML from cache, so there is no request-time hook to
 * branch on -- no middleware, no server component re-render, no cookie the
 * origin can read. A server-side flag is not merely harder here; it does not
 * exist as a concept.
 *
 * So the gate runs in the browser: `?cart=on` switches the cart UI on for
 * that browser and remembers it, `?cart=off` switches it back off. Everyone
 * else gets the enquiry flow exactly as before.
 *
 * ## What this gate is and is not
 *
 * It is a visibility switch, so the cart can be exercised against the real
 * store on the real domain while the storefront still has no payment
 * provider, no refund policy and a live international shipping zone.
 *
 * It is **not** a security boundary. The cart code is in the bundle for
 * everyone and anyone reading it can set the same key. That is fine, and
 * worth being explicit about: the thing being protected is not a secret, it
 * is the ordinary visitor's experience. Nobody stumbles into a half-finished
 * checkout, and a curious developer who deliberately turns it on reaches a
 * Shopify checkout that is itself still incomplete -- which is the same place
 * the owner reaches, on purpose.
 *
 * ## Why localStorage rather than the URL alone
 *
 * Preview is useless if it evaporates on the first click. Product -> cart ->
 * back to catalog has to stay in preview without threading a query parameter
 * through every internal link, and `next/link` navigations would drop it.
 *
 * The parameter is also left in the URL rather than stripped. Stripping it
 * with `replaceState` reads as tidier and then quietly breaks the one thing
 * the owner will actually do, which is copy the link out of the address bar
 * and open it on a phone.
 *
 * ## Why this is shaped as an external store
 *
 * The obvious implementation -- read localStorage in an effect, call
 * setState -- is wrong twice over. It renders once with the gate shut and
 * again with it open, and it is precisely the cascading-render pattern React
 * now lints against. `useSyncExternalStore` exists for this exact problem:
 * `getServerSnapshot` returns the value the static HTML was built with, so
 * hydration matches by construction, and the real value is adopted
 * immediately afterwards without a second state update.
 */

export const PREVIEW_PARAM = "cart";
export const PREVIEW_KEY = "hc.commerce.preview";

/**
 * `localStorage` is not merely absent during a static build -- it also
 * *throws* on access in Safari private browsing and wherever site data is
 * blocked. Preview turning itself off is an acceptable outcome; an exception
 * escaping into a render is not.
 */
function safeRead(): string | null {
  try {
    return window.localStorage.getItem(PREVIEW_KEY);
  } catch {
    return null;
  }
}

function safeWrite(value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(PREVIEW_KEY);
    else window.localStorage.setItem(PREVIEW_KEY, value);
  } catch {
    /* Preview simply will not persist. Not worth failing a render over. */
  }
}

/** `?cart=on` / `?cart=off`, or null when the parameter is absent. */
export function previewFromSearch(search: string): boolean | null {
  const value = new URLSearchParams(search).get(PREVIEW_PARAM);
  if (value === null) return null;

  // Anything other than an explicit off is treated as on, so `?cart`,
  // `?cart=1` and `?cart=true` all do the obvious thing.
  return value !== "off" && value !== "0" && value !== "false";
}

/**
 * The gate for this browser, right now.
 *
 * Reads only -- no writes, no other side effects -- because React calls this
 * during render and may call it more than once. Returns a boolean rather than
 * an object so referential stability is free and cannot cause a render loop.
 */
export function getPreviewSnapshot(): boolean {
  const fromUrl = previewFromSearch(window.location.search);
  if (fromUrl !== null) return fromUrl;

  return safeRead() === "on";
}

/**
 * What the pre-rendered HTML was built with. Always closed: the export is
 * built once, long before any browser with an opinion about this exists.
 */
export function getPreviewServerSnapshot(): boolean {
  return false;
}

/**
 * Cross-tab changes only, which is all that can happen without a navigation.
 * Turning preview on or off within a tab is done by loading a URL, and that
 * re-reads the snapshot on its own.
 */
export function subscribePreview(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREVIEW_KEY) onChange();
  };

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

/**
 * Remember what the URL asked for, so the gate survives the next click.
 *
 * Side-effecting, so it belongs in an effect rather than in a snapshot. Does
 * nothing unless the URL carried an explicit instruction -- an absent
 * parameter means "leave it as it was", not "turn it off".
 */
export function persistPreviewFromUrl(): void {
  const fromUrl = previewFromSearch(window.location.search);
  if (fromUrl === null) return;

  safeWrite(fromUrl ? "on" : null);
}
