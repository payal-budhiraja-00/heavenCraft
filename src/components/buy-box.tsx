"use client";

/**
 * The buy box: add-to-basket when the preview gate is open and the selected
 * colourway has a Shopify variant, an email enquiry otherwise.
 *
 * Both paths live here rather than being chosen on the server, because the
 * server has no idea which they get -- this is a static export, so the HTML
 * is built once and cached for everyone. The enquiry flow is what renders on
 * first paint, which is both the correct default and the one that matches the
 * pre-rendered markup.
 *
 * Which colourway is selected comes from `VariantProvider`, not from props:
 * a client component's props are serialised into the page, and the variant
 * list is already paid for once by the provider.
 */

import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "./ui";
import { useCart } from "./cart-provider";
import { useVariant } from "./variant-picker";
import { Price } from "./price";
import { enquiryMailto, variantIdForSku, type VariantId } from "@/lib/commerce";
import { features } from "@/lib/features";
import { SITE, whatsappUrl } from "@/lib/site";

export type BuyBoxProps = {
  productName: string;
  /** Absolute URL of this product page, for the enquiry email. */
  pageUrl: string;
  email: string;
};

export function BuyBox(props: BuyBoxProps) {
  const { previewEnabled, open } = useCart();
  const { selected } = useVariant();

  const variantId = features.commerce ? variantIdForSku(selected.sku) : undefined;
  const sellable = previewEnabled && variantId ? variantId : null;

  const region = useRef<HTMLDivElement>(null);
  const scrolledPast = useScrolledPast(region);

  return (
    <>
      <div ref={region}>
        {sellable ? (
          <AddToBasket {...props} variantId={sellable} />
        ) : (
          <Enquiry {...props} />
        )}
      </div>

      {/*
        The bar is rendered from here, and takes the same branch as the box
        above it, so the two can never offer different things. Suppressed
        while the basket drawer is open, where it would sit under the overlay
        competing with the drawer's own checkout button.
      */}
      <StickyBuyBar
        productName={props.productName}
        pageUrl={props.pageUrl}
        show={scrolledPast && !open}
        variantId={sellable}
      />
    </>
  );
}

/**
 * Whether an element has been scrolled up out of the viewport.
 *
 * Deliberately not "is off screen": an element still below the fold has also
 * never been seen, and showing the bar then would put a second, identical
 * call to action directly under the real one.
 */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return past;
}

/**
 * Price and one action, pinned to the bottom of a phone screen.
 *
 * A product page here is about seven screens tall and opens on a large
 * photograph, so the name, the price and the way to buy all start below the
 * fold -- a visitor reading the specifications has to scroll back up to find
 * out what it costs or how to ask. Phone only: from `lg` the buy box sits
 * beside the gallery and is never out of sight.
 */
function StickyBuyBar({
  productName,
  pageUrl,
  show,
  variantId,
}: Omit<BuyBoxProps, "email"> & {
  show: boolean;
  variantId: VariantId | null;
}) {
  const { add, busy } = useCart();
  const { selected, hasChoice } = useVariant();

  const enquiry = `Hi ${SITE.name}, I'd like a price for the ${productName}${
    hasChoice ? ` in ${selected.colour}` : ""
  } (${selected.sku}). ${pageUrl}`;

  return (
    <div
      /*
        Kept mounted and moved out of the way rather than unmounted, so it
        slides instead of appearing abruptly. `inert` because a translated
        element is still focusable, and tabbing into an invisible button is
        worse than not having one.
      */
      inert={!show}
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-base/95 backdrop-blur-sm transition-transform duration-300 lg:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-cream-faint">
            {productName}
            {hasChoice ? ` · ${selected.colour}` : ""}
          </p>
          <p className="tnum text-base font-semibold text-cream">
            <Price
              sku={selected.sku}
              pricePaise={selected.pricePaise}
              size="bar"
            />
          </p>
        </div>

        {variantId ? (
          <button
            type="button"
            onClick={() => add(variantId, 1)}
            disabled={busy}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-plate bg-gold px-5 text-sm font-semibold text-base transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add to basket"}
          </button>
        ) : (
          <a
            href={whatsappUrl(enquiry)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-plate bg-gold px-5 text-sm font-semibold text-base transition-colors hover:bg-gold-bright"
          >
            Enquire
          </a>
        )}
      </div>
    </div>
  );
}

function AddToBasket({
  variantId,
  productName,
}: BuyBoxProps & { variantId: VariantId }) {
  const { add, busy, setOpen, cart } = useCart();
  const { selected, hasChoice } = useVariant();
  const [quantity, setQuantity] = useState(1);

  const inBasket = cart?.lines
    .filter((line) => line.variantId === variantId)
    .reduce((total, line) => total + line.quantity, 0);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-plate border border-edge-strong">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={busy || quantity <= 1}
            aria-label="Reduce quantity"
            className="px-3.5 py-3 text-cream-muted transition-colors hover:text-gold disabled:opacity-40"
          >
            −
          </button>
          <span
            className="tnum min-w-9 text-center text-sm font-semibold text-cream"
            aria-live="polite"
            aria-label={`Quantity: ${quantity}`}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            disabled={busy || quantity >= 20}
            aria-label="Increase quantity"
            className="px-3.5 py-3 text-cream-muted transition-colors hover:text-gold disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => add(variantId, quantity)}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-plate bg-gold px-6 py-3.5 text-sm font-semibold text-base transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {busy ? "Adding…" : "Add to basket"}
        </button>
      </div>

      {inBasket ? (
        <p className="mt-3 text-xs text-cream-muted">
          {inBasket} {hasChoice ? `in ${selected.colour} ` : ""}in your basket.{" "}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-gold underline-offset-2 hover:underline"
          >
            View basket
          </button>
        </p>
      ) : null}

      {/*
        Inventory is untracked in Shopify, so the store will happily sell
        something the warehouse does not have. The catalog's own stock flag is
        the more honest signal, and saying "made to order" is better than
        letting a customer find out after paying.
      */}
      {!selected.inStock ? (
        <p className="mt-3 text-xs leading-relaxed text-warn">
          {productName}
          {hasChoice ? ` in ${selected.colour}` : ""} is made to order. We will
          confirm the dispatch date by email after your order.
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-cream-faint">
        Secure checkout by Shopify. Delivery calculated at checkout.
      </p>
    </div>
  );
}

function Enquiry({ productName, pageUrl, email }: BuyBoxProps) {
  const { selected, hasChoice } = useVariant();

  const href = enquiryMailto({
    name: productName,
    reference: selected.sku,
    pageUrl,
    colour: hasChoice ? selected.colour : null,
    email,
  });

  const enquiry = `Hi ${SITE.name}, I'd like a price for the ${productName}${
    hasChoice ? ` in ${selected.colour}` : ""
  } (${selected.sku}). ${pageUrl}`;

  return (
    <div className="mt-8">
      {/*
        WhatsApp first, mailto: second.

        `mailto:` frequently resolves to nothing on Android and on a desktop
        with no mail client, and the visitor gets no signal that the tap
        failed -- so the only route to buying was one that silently dies for a
        large share of this audience. WhatsApp is installed on effectively
        every phone in this market, keeps the thread after the browser is
        closed, and arrives with the product and finish already written out.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ButtonLink
          href={whatsappUrl(enquiry)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto"
        >
          Enquire on WhatsApp
        </ButtonLink>
        <a
          href={`tel:${SITE.phone}`}
          className="flex min-h-11 w-full items-center justify-center rounded-plate border border-edge-strong px-5 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold sm:w-auto"
        >
          Call {SITE.phoneDisplay}
        </a>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-cream-faint">
        We reply with stock, delivery time and the final price — usually the
        same working day. {SITE.hoursSummary}.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-cream-faint">
        Prefer email?{" "}
        <a href={href} className="text-cream-muted underline">
          Send the details
        </a>{" "}
        or write to <span className="select-all text-cream-muted">{email}</span>
        .
      </p>
    </div>
  );
}
