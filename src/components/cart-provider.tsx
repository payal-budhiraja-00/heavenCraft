"use client";

/**
 * Cart state.
 *
 * Shopify holds the cart; this holds the ID of it and whatever the last call
 * returned. Nothing about pricing, availability or totals is decided here.
 *
 * ## Nothing happens until the preview gate opens
 *
 * While the gate is closed this provider makes no network calls, reads no
 * storage beyond the gate key itself, and renders its children untouched.
 * That is the point: until the store has a payment provider and its policies,
 * an ordinary visitor should not be able to tell the cart exists, and should
 * certainly not be generating traffic against it.
 *
 * ## Why mutations are serialised
 *
 * Two clicks on "Add to basket" before the first response lands would both
 * see `cart === null` and both call `cartCreate`. The result is two carts,
 * the second silently orphaning the first, and a basket that appears to lose
 * an item at random. Every mutation goes through one promise chain so the
 * second click always sees the cart the first one made.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Cart, VariantId } from "@/lib/commerce";
import { shopifyCommerce } from "@/lib/commerce";
import {
  getPreviewServerSnapshot,
  getPreviewSnapshot,
  persistPreviewFromUrl,
  subscribePreview,
} from "@/lib/commerce-preview";

const CART_ID_KEY = "hc.cart.id";

function readCartId(): string | null {
  try {
    return window.localStorage.getItem(CART_ID_KEY);
  } catch {
    return null;
  }
}

function writeCartId(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(CART_ID_KEY);
    else window.localStorage.setItem(CART_ID_KEY, id);
  } catch {
    /* The cart survives the session but not a reload. Acceptable. */
  }
}

export type CartContextValue = {
  /** Whether the cart UI may render at all in this browser. */
  previewEnabled: boolean;
  cart: Cart | null;
  /** A mutation is in flight. Buttons disable on this rather than optimistically
   *  updating: Shopify owns the totals, and guessing them then correcting is
   *  worse than waiting ~300ms for the real ones. */
  busy: boolean;
  error: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (variantId: VariantId, quantity?: number) => Promise<void>;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  dismissError: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  /*
   * Subscribed rather than held in state. The static HTML was built with the
   * gate shut, so `getPreviewServerSnapshot` returns false and hydration
   * matches by construction; the browser's real answer is adopted straight
   * after, without the extra render an effect-plus-setState would cost.
   */
  const previewEnabled = useSyncExternalStore(
    subscribePreview,
    getPreviewSnapshot,
    getPreviewServerSnapshot,
  );

  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const alive = useRef(true);
  const cartRef = useRef<Cart | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const commit = useCallback((next: Cart | null) => {
    cartRef.current = next;
    if (alive.current) setCart(next);
    writeCartId(next?.id ?? null);
  }, []);

  useEffect(() => {
    // Remember an explicit ?cart=on/off so the gate survives the next click.
    persistPreviewFromUrl();
  }, []);

  useEffect(() => {
    if (!previewEnabled) return;

    const stored = readCartId();
    if (!stored) return;

    let cancelled = false;

    shopifyCommerce
      .getCart(stored)
      .then((found) => {
        if (cancelled) return;
        // A null cart is an expired one, which is routine after ten days
        // idle. Drop the stale ID rather than retrying it on every page.
        if (!found) writeCartId(null);
        else commit(found);
      })
      .catch(() => {
        /*
         * Deliberately silent. This runs on page load with no user intent
         * behind it, and an error toast about a cart nobody has opened yet is
         * noise. The next real action surfaces its own failure.
         */
      });

    return () => {
      cancelled = true;
    };
  }, [previewEnabled, commit]);

  const run = useCallback(
    async (task: () => Promise<Cart | null>) => {
      const attempt = queue.current.then(task, task);
      // Keep the chain alive after a rejection, otherwise one failed call
      // poisons every mutation that follows it.
      queue.current = attempt.catch(() => undefined);

      if (alive.current) {
        setBusy(true);
        setError(null);
      }

      try {
        commit(await attempt);
      } catch (cause) {
        if (alive.current) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Something went wrong. Please try again.",
          );
        }
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [commit],
  );

  const add = useCallback(
    async (variantId: VariantId, quantity = 1) => {
      await run(async () => {
        const current = cartRef.current;
        return current
          ? shopifyCommerce.addLines(current.id, [{ variantId, quantity }])
          : shopifyCommerce.createCart([{ variantId, quantity }]);
      });
      if (alive.current) setOpen(true);
    },
    [run],
  );

  const setQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      await run(async () => {
        const current = cartRef.current;
        if (!current) return null;

        // Shopify treats a zero-quantity update as a removal, but going
        // through removeLine keeps the intent explicit at the call site.
        return quantity <= 0
          ? shopifyCommerce.removeLine(current.id, lineId)
          : shopifyCommerce.setLineQuantity(current.id, lineId, quantity);
      });
    },
    [run],
  );

  const remove = useCallback(
    async (lineId: string) => {
      await run(async () => {
        const current = cartRef.current;
        return current ? shopifyCommerce.removeLine(current.id, lineId) : null;
      });
    },
    [run],
  );

  const dismissError = useCallback(() => setError(null), []);

  const value = useMemo<CartContextValue>(
    () => ({
      previewEnabled,
      cart,
      busy,
      error,
      open,
      setOpen,
      add,
      setQuantity,
      remove,
      dismissError,
    }),
    [previewEnabled, cart, busy, error, open, add, setQuantity, remove, dismissError],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
