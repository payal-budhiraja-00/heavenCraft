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
    <div className="flex flex-col gap-3">
      <div className="relative aspect-4/5 overflow-hidden rounded-panel border border-edge bg-raised">
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
        <ul
          className="grid grid-cols-5 gap-2.5"
          aria-label="Product photographs"
        >
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={alts[i] ?? ""}
                aria-current={i === active}
                className={`relative block aspect-square w-full overflow-hidden rounded-plate border transition-all ${
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
