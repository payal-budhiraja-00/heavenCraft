"use client";

/**
 * The promotional strip above the header.
 *
 * ## Accessibility decisions, and why
 *
 * **The rotation is hidden from assistive tech.** A region whose text changes
 * every few seconds is, to a screen reader, a stream of interruptions. The
 * animated view is therefore `aria-hidden`, and the same messages are also
 * rendered once as a static visually-hidden list. Sighted users get the
 * rotation, everyone else gets the full set read once, in order, and nothing
 * is lost either way.
 *
 * **Dismissal is what satisfies WCAG 2.2.2.** Content that moves
 * automatically, runs longer than five seconds and sits beside other content
 * has to offer a way to pause, stop or hide it. The close button is that
 * mechanism.
 *
 * **Reduced motion stops the rotation entirely rather than removing the
 * fade.** Swapping the text abruptly every four seconds is still movement in
 * the corner of someone's eye; the honest reading of the preference is to
 * hold still, so under `reduce` the first message stays put.
 *
 * **Dismissal is remembered in CSS, not in React.** A pre-paint script in the
 * document head sets `data-promo="off"` on `<html>` when this session already
 * dismissed the strip, and a rule in `globals.css` hides it from there. That
 * is why this component starts every page view undismissed and never reads
 * storage on mount: by the time React could hide it, the strip would already
 * have painted and shoved the page down.
 *
 * ## Why the strip does not scroll with the page
 *
 * It sits above a `sticky top-0` header and is not sticky itself, so it
 * scrolls away on the first gesture and the header then behaves exactly as it
 * did before. A permanent strip would eat 44px of every viewport forever to
 * repeat something the price tags already say.
 */

import { useEffect, useState } from "react";

const ROTATE_MS = 4000;
const STORAGE_KEY = "hc-promo";

export function PromoBanner({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (messages.length < 2) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [messages.length]);

  if (dismissed || messages.length === 0) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "off");
      /* Also set the attribute the pre-paint rule keys on, so the strip stays
       * hidden across client-side navigations without waiting for a reload. */
      document.documentElement.dataset.promo = "off";
    } catch {
      /* Nothing to do -- the strip is gone for this page view regardless. */
    }
  }

  return (
    <div
      data-promo-strip
      className="relative flex min-h-11 items-center justify-center overflow-hidden bg-gold px-12 text-base"
    >
      {/* Read once, in full, instead of the rotation being announced. */}
      <p className="sr-only">{messages.join(". ")}.</p>

      <p aria-hidden="true" className="text-center">
        {/*
          Keyed on the index so React replaces the node on every change, which
          is what restarts the CSS animation. A class toggle would not: the
          animation has already finished and would need to be removed for a
          frame before it could run again.
        */}
        <span
          key={index}
          className="promo-message block text-xs font-semibold tracking-wide sm:text-sm"
        >
          {messages[index]}
        </span>
      </p>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide offers"
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-base/70 transition-colors hover:text-base"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
