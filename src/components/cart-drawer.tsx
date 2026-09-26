"use client";

/**
 * The cart: a trigger for the header and the slide-over panel it opens.
 *
 * Both render `null` when `features.commerce` is off, so a build without
 * commerce gets exactly the header and page it had before Phase 4 existed.
 *
 * Thumbnails are plain `<img>` rather than `next/image`. This site runs a
 * custom image loader pointed at its own pre-built WebP derivatives, and
 * these URLs are Shopify's CDN -- routing them through that loader would
 * rewrite them into paths that do not exist. Shopify's CDN does its own
 * resizing from the `width` parameter, which is what `thumb()` asks for.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useCart } from "./cart-provider";
import { formatPaise } from "@/lib/money";
import { features } from "@/lib/features";

/** Ask Shopify's CDN for a thumbnail instead of the full-size original. */
function thumb(url: string, width: number): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}width=${width}`;
}

export function CartButton() {
  const { cart, setOpen } = useCart();
  if (!features.commerce) return null;

  const count = cart?.totalQuantity ?? 0;

  return (
    <button
      type="button"
      data-cart-trigger=""
      onClick={() => setOpen(true)}
      className="relative rounded-plate border border-edge-strong p-2.5 text-cream transition-colors hover:border-gold hover:text-gold"
      aria-label={count === 1 ? "Cart, 1 item" : `Cart, ${count} items`}
    >
      <BagIcon />
      {count > 0 ? (
        <span className="tnum absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-gold text-[0.65rem] font-bold text-base">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}

export function CartDrawer() {
  const {
    cart,
    busy,
    error,
    open,
    setOpen,
    setQuantity,
    remove,
    dismissError,
  } = useCart();

  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;
    const surface = panel.current;
    if (!surface) return;

    /*
      Where focus came from, so it can be handed back. Without this, closing
      the cart drops focus onto <body> and the next Tab starts again from
      the top of the document -- a keyboard user loses their place entirely.
    */
    const opener = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;

      /*
        `aria-modal` tells a screen reader the rest of the page is out of
        bounds; it does nothing whatsoever to the Tab key. Without this the
        sixth Tab walked out of the cart and carried on through the page
        behind it, still visibly scrolled away under the overlay.

        Queried on each press rather than cached: lines can be removed while
        the drawer is open, and a stale list would trap focus on a button
        that no longer exists.
      */
      const focusable = Array.from(
        surface.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        surface.focus();
        return;
      }

      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === surface)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Move focus into the panel so a keyboard user is not left tabbing
    // through the page behind it.
    surface.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      /*
        `opener` is frequently not a real control by now. "Add to cart"
        disables itself while the Shopify call is in flight, and disabling a
        focused button drops focus to <body> -- so by the time the drawer
        opens, the thing we captured is the body element, which is connected
        and focusable-looking but focusing it does nothing. Measured, not
        assumed. The cart trigger is the honest landing place anyway: it is
        where the drawer came from and it is still on screen.
      */
      const reusable =
        opener && opener !== document.body && opener.isConnected;
      const target = reusable
        ? opener
        : document.querySelector<HTMLElement>("[data-cart-trigger]");
      target?.focus?.();
    };
  }, [open, close]);

  if (!features.commerce || !open) return null;

  const lines = cart?.lines ?? [];

  /*
    Summed from the per-line difference rather than by subtracting the
    subtotal from a reconstructed total MRP. A cart-level discount would make
    the second version overstate the saving against MRP; this version can
    only ever understate it, which is the safe direction to be wrong in.
  */
  const savingPaise = lines.reduce(
    (total, line) =>
      line.compareUnitPaise
        ? total + (line.compareUnitPaise - line.unitPaise) * line.quantity
        : total,
    0,
  );

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Cart">
      <button
        type="button"
        onClick={close}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full cursor-default bg-base/70 backdrop-blur-sm"
      />

      <div
        ref={panel}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-dvh w-full max-w-md flex-col border-l border-edge bg-surface shadow-panel outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-edge px-6 py-5">
          <h2 className="type-wide text-lg font-bold text-cream">Cart</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="-mr-2 flex size-11 items-center justify-center rounded-plate text-cream-muted transition-colors hover:text-gold"
          >
            <CloseIcon />
          </button>
        </div>

        {error ? (
          <div className="border-b border-poor/40 bg-poor/10 px-6 py-3">
            <p className="text-sm text-cream">{error}</p>
            <button
              type="button"
              onClick={dismissError}
              className="label mt-1 text-gold hover:text-gold-bright"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-cream-muted">Your cart is empty.</p>
            <button
              type="button"
              onClick={close}
              className="label text-gold hover:text-gold-bright"
            >
              Keep browsing
            </button>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-edge overflow-y-auto">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-4 px-6 py-5">
                <div className="size-20 shrink-0 overflow-hidden rounded-plate border border-edge bg-raised">
                  {line.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumb(line.imageUrl, 160)}
                      alt={line.imageAlt}
                      width={80}
                      height={80}
                      loading="lazy"
                      /*
                        These URLs are Shopify's, not ours, and carry a
                        `width` transform. If one fails the tile should stay
                        a neutral square rather than show a broken-image
                        glyph next to a product someone is about to pay for.
                      */
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      className="size-full object-contain p-1"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  {line.href ? (
                    <Link
                      href={line.href}
                      onClick={close}
                      /*
                        py-1.5 lifts this from 15px to ~27px tall, clearing
                        WCAG 2.5.8's 24px minimum. Not taken to 44px: that
                        would stretch every cart row, and the actions that
                        matter here -- quantity, remove, checkout -- are all
                        44px already.
                      */
                      className="inline-block py-1.5 text-sm font-semibold leading-snug text-cream transition-colors hover:text-gold"
                    >
                      {line.title}
                    </Link>
                  ) : (
                    <p className="py-1.5 text-sm font-semibold leading-snug text-cream">
                      {line.title}
                    </p>
                  )}

                  <p className="tnum text-xs text-cream-faint">
                    {formatPaise(line.unitPaise)} each
                    {line.compareUnitPaise ? (
                      <>
                        {" "}
                        <span className="sr-only">
                          , reduced from a maximum retail price of
                        </span>
                        <s className="text-cream-faint/70">
                          {formatPaise(line.compareUnitPaise)}
                        </s>
                      </>
                    ) : null}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-plate border border-edge">
                      <Step
                        label={`Reduce quantity of ${line.title}`}
                        disabled={busy}
                        onClick={() => setQuantity(line.id, line.quantity - 1)}
                      >
                        −
                      </Step>
                      <span className="tnum min-w-8 text-center text-sm text-cream">
                        {line.quantity}
                      </span>
                      <Step
                        label={`Increase quantity of ${line.title}`}
                        disabled={busy}
                        onClick={() => setQuantity(line.id, line.quantity + 1)}
                      >
                        +
                      </Step>
                    </div>

                    <span className="tnum text-sm font-semibold text-cream">
                      {formatPaise(line.linePaise)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.id)}
                    disabled={busy}
                    className="mt-1 inline-flex min-h-11 items-center text-xs text-cream-faint underline-offset-2 transition-colors hover:text-poor hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {cart && lines.length > 0 ? (
          <div className="border-t border-edge px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="label text-cream-muted">Subtotal</span>
              <span className="tnum text-xl font-bold text-cream">
                {formatPaise(cart.subtotalPaise)}
              </span>
            </div>
            {savingPaise > 0 ? (
              <p className="tnum mt-2 text-sm font-semibold text-gold">
                You save {formatPaise(savingPaise)}
              </p>
            ) : null}

            <p className="mt-1.5 text-xs leading-relaxed text-cream-faint">
              Inclusive of all taxes. Delivery calculated at checkout.
            </p>

            {/*
              A plain anchor, not next/link: this leaves the site entirely for
              Shopify's hosted checkout. rel="noopener" because the cart ID
              inside that URL is effectively a bearer token for this cart.
            */}
            <a
              href={cart.checkoutUrl}
              rel="noopener"
              className={`mt-4 flex w-full items-center justify-center rounded-plate bg-gold px-6 py-3.5 text-sm font-semibold text-base transition-colors hover:bg-gold-bright ${
                busy ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Checkout
            </a>
            <p className="mt-2.5 text-xs leading-relaxed text-cream-faint">
              Payment is handled by Shopify. Card details never reach this
              site.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Step({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-11 items-center justify-center text-sm text-cream-muted transition-colors hover:text-gold disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
