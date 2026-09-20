"use client";

import Image from "next/image";
import { useState } from "react";
import { encodeImagePath } from "@/lib/images";

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
        <Image
          key={current}
          src={encodeImagePath(current)}
          alt={alts[active] ?? ""}
          fill
          priority
          sizes="(min-width: 1024px) 40rem, 100vw"
          className="object-cover"
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
                className={`relative block aspect-square w-full overflow-hidden rounded-plate border transition-colors ${
                  i === active
                    ? "border-gold"
                    : "border-edge hover:border-edge-strong"
                }`}
              >
                <Image
                  src={encodeImagePath(src)}
                  alt=""
                  fill
                  sizes="6rem"
                  className={`object-cover transition-opacity ${
                    i === active ? "opacity-100" : "opacity-65 hover:opacity-90"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
