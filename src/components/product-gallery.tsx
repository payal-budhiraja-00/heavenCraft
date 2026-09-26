"use client";

import { useState } from "react";
import { ProductImage } from "./product-image";

/**
 * Product gallery.
 *
 * The first frame is server-rendered as the LCP image and marked priority; the
 * thumbnails only swap which one is shown, so a product with nine photographs
 * still costs one image on first paint.
 */
export function ProductGallery({
  images,
  alts,
}: {
  images: string[];
  /**
   * Precomputed per-image alt text. Passed as strings rather than as a
   * generator function because this is a client component, and a function
   * prop cannot cross the server/client boundary.
   */
  alts: string[];
}) {
  const [active, setActive] = useState(0);
  const current = images[active];

  if (!current) {
    return (
      <div className="flex aspect-4/5 items-center justify-center rounded-panel border border-edge bg-surface">
        <span className="label text-cream-faint">No photograph yet</span>
      </div>
    );
  }

  return (
    /*
      `min-w-0` is load-bearing. A grid item defaults to `min-width: auto`,
      which refuses to shrink below its contents -- so the scrolling
      thumbnail strip below sized this column to its full 482px and pushed
      the entire page into horizontal overflow. Without this the strip can
      never scroll, because its container just grows instead.
    */
    <div className="flex min-w-0 flex-col gap-3">
      {/*
        Height-capped on phones. At 4:5 the frame took 603px of a 915px
        screen -- and a real phone shows ~840px once the browser's own
        toolbar is counted -- so the name and the price both started below
        the fold. Capping rather than re-cropping keeps the photograph
        untouched: `contain` simply renders it smaller inside the panel.
      */}
      <div className="relative aspect-4/5 max-h-[46vh] overflow-hidden rounded-panel border border-edge bg-raised lg:max-h-none">
        <ProductImage
          key={current}
          src={current}
          alt={alts[active] ?? ""}
          priority
          fit="contain"
          sizes="(min-width: 1024px) 40rem, 100vw"
          inset="p-4"
        />
      </div>

      {images.length > 1 ? (
        /*
          One scrolling row rather than a wrapping grid. At five columns a
          sixth photograph dropped onto a row of its own, which read as a
          layout fault and cost roughly ninety pixels of the first phone
          screen -- enough to push the product's name and price below the
          fold. Scrolling also keeps a partially visible thumbnail at the
          edge, which is what tells you there are more.
        */
        <ul
          className="flex w-full snap-x gap-2.5 overflow-x-auto pb-1"
          aria-label="Product photographs"
        >
          {images.map((src, i) => (
            <li key={src} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Photograph ${i + 1} of ${images.length}${
                  alts[i] ? `: ${alts[i]}` : ""
                }`}
                aria-current={i === active}
                className={`relative block aspect-square w-18 overflow-hidden rounded-plate border transition-all sm:w-22 ${
                  i === active
                    ? "border-gold opacity-100"
                    : "border-edge opacity-65 hover:border-edge-strong hover:opacity-90"
                }`}
              >
                <ProductImage
                  src={src}
                  alt=""
                  fit="contain"
                  sizes="6rem"
                  inset="p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
