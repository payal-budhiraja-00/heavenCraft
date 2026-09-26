/**
 * Price, printed MRP and the saving, in one place.
 *
 * Three surfaces render a price -- the product card, the buy box and the
 * sticky mobile bar -- and before this they each formatted their own. Adding
 * a struck-through MRP to three independent bits of markup is how a card ends
 * up claiming a different saving from the page it links to, so they now share
 * this.
 *
 * ## Why the percentage is computed rather than passed in
 *
 * `offerForSku` derives it from the same two figures rendered beside it. A
 * badge that disagrees with the arithmetic next to it is the single most
 * damaging thing this component could do, and the only certain way to prevent
 * it is to leave the caller no way to supply one.
 *
 * ## Why there is no fallback
 *
 * A variant with no compare-at price in Shopify renders a plain price and no
 * badge. That is the correct state for anything not on offer -- ending a sale
 * is deleting a value in the Shopify admin, with no code change and no dead
 * "0% off" badge left behind.
 */

import { offerForSku } from "@/lib/commerce";
import { formatPaise } from "@/lib/money";

type Size = "card" | "page" | "bar";

const PRICE_CLASS: Record<Size, string> = {
  card: "text-lg font-bold",
  page: "text-3xl font-bold",
  bar: "text-base font-semibold",
};

const COMPARE_CLASS: Record<Size, string> = {
  card: "text-sm",
  page: "text-lg",
  bar: "text-xs",
};

const BADGE_CLASS: Record<Size, string> = {
  card: "text-xs",
  page: "text-sm",
  bar: "text-xs",
};

export function Price({
  sku,
  pricePaise,
  size = "card",
}: {
  sku: string;
  pricePaise: number;
  size?: Size;
}) {
  const offer = offerForSku(sku, pricePaise);

  if (!offer) {
    return (
      <span className={`tnum ${PRICE_CLASS[size]} text-cream`}>
        {formatPaise(pricePaise)}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`tnum ${PRICE_CLASS[size]} text-cream`}>
        {formatPaise(pricePaise)}
      </span>

      {/*
        `line-through` alone leaves a screen reader announcing two prices with
        nothing to distinguish them, so the struck figure is labelled. The
        visible text stays bare because the strike already says it to anyone
        who can see it.
      */}
      <span className={`tnum ${COMPARE_CLASS[size]} text-cream-faint`}>
        <span className="sr-only">Maximum retail price </span>
        <s>{formatPaise(offer.comparePaise)}</s>
      </span>

      {/*
        Gold rather than the green marketplaces use for this. `--color-good`
        is already spoken for by the in-stock pill, which sits inches away in
        the buy box -- two greens side by side meaning two different things is
        worse than no colour at all. Gold is also the only chroma this palette
        allows, and it is the emphasis colour everywhere else on the site.
      */}
      <span className={`${BADGE_CLASS[size]} font-semibold text-gold`}>
        {offer.percentOff}% off
      </span>
    </span>
  );
}
