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

import { useState } from "react";
import { ButtonLink } from "./ui";
import { useCart } from "./cart-provider";
import { useVariant } from "./variant-picker";
import { enquiryMailto, variantIdForSku, type VariantId } from "@/lib/commerce";
import { features } from "@/lib/features";

export type BuyBoxProps = {
  productName: string;
  /** Absolute URL of this product page, for the enquiry email. */
  pageUrl: string;
  email: string;
};

export function BuyBox(props: BuyBoxProps) {
  const { previewEnabled } = useCart();
  const { selected } = useVariant();

  const variantId = features.commerce ? variantIdForSku(selected.sku) : undefined;

  if (previewEnabled && variantId) {
    return <AddToBasket {...props} variantId={variantId} />;
  }

  return <Enquiry {...props} />;
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

  return (
    <div className="mt-8">
      <ButtonLink href={href} className="w-full sm:w-auto">
        Get a price by email
      </ButtonLink>
      <p className="mt-3 text-xs leading-relaxed text-cream-faint">
        Opens your email app with this model
        {hasChoice ? `, in ${selected.colour},` : ""} and its details already
        filled in. We reply with stock, delivery time and the final price —
        usually the same working day.
      </p>
      {/*
        A mailto: link does nothing at all on a desktop with no mail client
        configured, and the visitor has no way to tell the click failed. Print
        the address so it can always be copied.
      */}
      <p className="mt-2 text-xs leading-relaxed text-cream-faint">
        No email app? Write to{" "}
        <span className="select-all text-cream-muted">{email}</span>.
      </p>
    </div>
  );
}
