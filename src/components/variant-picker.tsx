"use client";

/**
 * Colour selection for a product page.
 *
 * ## Why a context rather than one big client component
 *
 * The reactive parts of a product page -- gallery, price, stock, buy box --
 * are scattered across a two-column grid with static prose between them. A
 * single client component wrapping the lot would drag the description, the
 * specification list and every review into the client payload a second time.
 *
 * So the variant list is handed to a provider once, and only the four small
 * pieces that actually change subscribe to it. Everything else stays server
 * rendered and costs nothing.
 *
 * ## Why the gallery remounts
 *
 * `ProductGallery` owns which photograph is showing. Switching colour swaps
 * the whole set, and keeping index 3 across that swap would land on an
 * unrelated shot -- or out of bounds, since colourways do not have equal
 * numbers of photographs. Remounting via `key` resets it to the first frame,
 * which is the one that shows the colour that was just chosen.
 */

import { createContext, useContext, useMemo, useState } from "react";
import { ProductGallery } from "./product-gallery";
import { FeatureList, Label, SpecRow, StockPill } from "./ui";
import type { Feature, Specification } from "@/lib/catalog-types";
import { formatPaise } from "@/lib/money";

/** A variant flattened to exactly what the page needs. */
export type VariantView = {
  /** products.json variant id, which is also the Shopify SKU. */
  sku: string;
  colour: string;
  colourSlug: string;
  pricePaise: number;
  /** Raw paths; the gallery encodes them. */
  images: string[];
  alts: string[];
  inStock: boolean;
  /**
   * Present only where the supplier printed a separate sheet per finish. The
   * page checks for it before mounting the reactive sections at all, so the
   * other twenty-five products keep their feature lists on the server and out
   * of the client payload entirely.
   */
  features?: Feature[];
  materials?: string[];
  /**
   * Per-finish dimensions, present under the same condition as `features` and
   * for the same reason: the finishes are measurably different objects.
   */
  specifications?: Specification[];
};

type VariantState = {
  variants: VariantView[];
  selected: VariantView;
  select: (colourSlug: string) => void;
  /** False when there is one colourway, so callers can skip the picker. */
  hasChoice: boolean;
};

const VariantContext = createContext<VariantState | null>(null);

export function useVariant(): VariantState {
  const state = useContext(VariantContext);
  if (!state) {
    throw new Error("useVariant must be used inside a VariantProvider");
  }
  return state;
}

export function VariantProvider({
  variants,
  children,
}: {
  variants: VariantView[];
  children: React.ReactNode;
}) {
  const [colourSlug, setColourSlug] = useState(variants[0]?.colourSlug ?? "");

  const value = useMemo<VariantState | null>(() => {
    const first = variants[0];
    if (!first) return null;

    return {
      variants,
      selected: variants.find((v) => v.colourSlug === colourSlug) ?? first,
      select: setColourSlug,
      hasChoice: variants.length > 1,
    };
  }, [variants, colourSlug]);

  if (!value) return children;

  return (
    <VariantContext.Provider value={value}>{children}</VariantContext.Provider>
  );
}

export function VariantGallery() {
  const { selected } = useVariant();

  return (
    <ProductGallery
      key={selected.colourSlug}
      images={selected.images}
      alts={selected.alts}
    />
  );
}

export function VariantPrice() {
  const { selected } = useVariant();

  return (
    <div className="mt-6 flex items-center gap-4">
      <span className="tnum text-3xl font-bold text-cream">
        {formatPaise(selected.pricePaise)}
      </span>
      <StockPill inStock={selected.inStock} />
    </div>
  );
}

/**
 * The features and materials for the selected finish.
 *
 * Only mounted for products whose variants carry their own printed sheets --
 * the Imperium executive table, where one finish stands on wooden legs and the
 * other on a metal frame. Everywhere else the page renders the same markup on
 * the server and ships none of this.
 */
export function VariantFeatures() {
  const { selected } = useVariant();
  const features = selected.features ?? [];
  if (!features.length) return null;

  return (
    <div className="mt-10 border-t border-edge pt-8">
      <Label>Features</Label>
      <p className="mt-2 text-xs text-cream-faint">
        For the {selected.colour} finish.
      </p>
      <FeatureList features={features} />
    </div>
  );
}

/**
 * Dimension rows inside the specifications table, for products whose finishes
 * measure differently. Sits above `VariantMaterialsRow` in the same `<dl>`.
 *
 * Renders its own caption because a reader who has scrolled past the colour
 * picker needs to know these numbers moved when they changed finish -- without
 * it the table silently rewrites itself.
 */
export function VariantSpecRows() {
  const { selected } = useVariant();
  const specs = selected.specifications ?? [];
  if (!specs.length) return null;

  return (
    <>
      {specs.map((spec) => (
        <SpecRow key={spec.label} label={spec.label} value={spec.value} />
      ))}
    </>
  );
}

/**
 * The materials row inside the specifications table. Separate from
 * `VariantFeatures` because it sits inside a `<dl>` the server owns, between
 * dimension rows that do not change with finish.
 */
export function VariantMaterialsRow() {
  const { selected } = useVariant();
  const materials = selected.materials ?? [];
  if (!materials.length) return null;

  return <SpecRow label="Materials & finish" value={materials.join(" · ")} />;
}

/**
 * Swatch row. Renders nothing for a single-colourway product rather than one
 * lonely selected button, which would imply a choice that does not exist.
 *
 * The swatches are text, not colour chips. The supplier's colour names are
 * things like "Beige-Wooden Teak" and "Dark Grey-Black Marble" -- two-tone
 * finishes on wood grain that no flat hex value represents honestly, and
 * guessing one would show a colour the furniture is not. The photograph above
 * is the real swatch; this row says which one it is.
 */
export function ColourPicker() {
  const { variants, selected, select, hasChoice } = useVariant();
  if (!hasChoice) return null;

  return (
    <fieldset className="mt-7">
      <legend className="label text-cream-faint">
        Finish
        <span className="ml-2 text-cream-muted">{selected.colour}</span>
      </legend>

      <div className="mt-3 flex flex-wrap gap-2.5">
        {variants.map((variant) => {
          const active = variant.colourSlug === selected.colourSlug;

          return (
            <button
              key={variant.colourSlug}
              type="button"
              onClick={() => select(variant.colourSlug)}
              aria-pressed={active}
              className={`rounded-plate border px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "border-gold bg-gold-wash font-semibold text-cream"
                  : "border-edge-strong text-cream-muted hover:border-gold hover:text-cream"
              }`}
            >
              {variant.colour}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
