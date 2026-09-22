"use client";

import { optimizedSrc } from "./image-opt";

/**
 * Custom loader for `next/image` under `output: "export"`.
 *
 * The default loader resizes on request and needs a server, which this host
 * does not have. Setting `unoptimized: true` was the previous answer, but it
 * makes next/image emit a bare <img> with no srcset at all -- so a product
 * card displayed at 400px was downloading the full 1288px source. Every
 * product image on the site is rendered with `fill` and a real `sizes`
 * attribute, so a loader is all that was missing to get correct responsive
 * behaviour back.
 *
 * Derivatives are generated ahead of the build by scripts/generate-images.ts.
 * Anything outside /images/ -- the generated icon set, the OG card -- is
 * returned untouched, because those are already sized for their one use.
 *
 * WebP only, with no JPEG fallback. Support has been universal across
 * browsers capable of running this app since Safari 14 in 2020, and offering
 * a fallback would mean abandoning next/image for hand-written <picture>
 * elements on every surface.
 */
export default function heavencraftImageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return optimizedSrc(src, width) ?? src;
}
