"use client";

/**
 * Sharing a product with someone else.
 *
 * The job is a customer getting a second opinion -- sending a chair to a
 * partner, a colleague or whoever signs off the spend -- not us pushing links
 * out. That framing decides the whole design: the message has to make sense
 * to a person who has never heard of us, and the link has to survive being
 * pasted into WhatsApp.
 *
 * ## Why the native sheet first
 *
 * `navigator.share` opens the operating system's own share sheet, which is
 * where the recipient's actual contacts already are -- WhatsApp threads,
 * Instagram DMs, a specific person. Any list of buttons we invent is a worse
 * version of a list the phone already has, and would miss whichever app this
 * particular customer uses.
 *
 * It is detected after mount rather than during render. The page is a static
 * export, so the HTML is built once on a machine with no `navigator` at all;
 * deciding during the first render would make the client disagree with the
 * markup it is hydrating. The fallback is therefore what ships in the HTML,
 * and the sheet replaces it a frame later on phones that have it.
 *
 * ## Why the fallback is WhatsApp and copy, and nothing else
 *
 * `wa.me` with no number opens WhatsApp's own contact picker, which is the
 * desktop equivalent of the share sheet for this market. Copy covers
 * everything else. Facebook and X buttons would be decoration -- nobody
 * sends furniture to a partner via a public post.
 */

import { useCallback, useEffect, useState } from "react";
import { COLOUR_PARAM, useVariant } from "./variant-picker";
import { formatPaise } from "@/lib/money";
import { SITE } from "@/lib/site";
import { useBrowserValue } from "@/lib/use-browser-value";

export type ShareProductProps = {
  productName: string;
  /** Absolute URL of this product page, without a query string. */
  pageUrl: string;
  /** Singular noun for the label -- "chair", "desk". The catalogue's groups
   * are plural, and "Share this chairs" is not a sentence. */
  noun: string;
};

export function ShareProduct({
  productName,
  pageUrl,
  noun,
}: ShareProductProps) {
  const { selected, hasChoice } = useVariant();
  const [copied, setCopied] = useState(false);

  /*
    Checked for callability, not presence. Some in-app webviews expose the
    property but leave it undefined, and outside a secure context calling it
    throws -- either way an `in` test would offer a button that cannot work,
    with no fallback behind it.
  */
  const canUseSheet = useBrowserValue(
    () => typeof navigator.share === "function",
    false,
  );

  // The colour travels with the link, so the recipient opens what was sent.
  const url = hasChoice
    ? `${pageUrl}?${COLOUR_PARAM}=${encodeURIComponent(selected.colourSlug)}`
    : pageUrl;

  /*
    Written to be read by someone with no context. The price is the question
    they are being asked to weigh in on, so it goes in the message rather than
    being left for them to go and find.
  */
  const message = `${productName}${
    hasChoice ? ` in ${selected.colour}` : ""
  } — ${formatPaise(selected.pricePaise)} at ${SITE.name}`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /*
        Clipboard access can be refused outright -- an insecure context, or a
        browser that prompts and is declined. Saying nothing would look like
        the button is broken, so fall back to selecting the URL in a prompt
        the visitor can copy by hand.
      */
      window.prompt("Copy this link", url);
    }
  }, [url]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const share = useCallback(async () => {
    try {
      await navigator.share({ title: productName, text: message, url });
    } catch (error) {
      /*
        Dismissing the sheet rejects with AbortError -- that is a choice, not
        a failure, and must stay silent. Anything else means the sheet did not
        work, and since the sheet replaced the fallback there would otherwise
        be no way left to share at all.
      */
      if ((error as DOMException)?.name !== "AbortError") await copy();
    }
  }, [productName, message, url, copy]);

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-xs text-cream-faint">Ask someone else first?</span>

      {canUseSheet ? (
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cream-muted transition-colors hover:text-gold"
        >
          <ShareIcon />
          Share this {noun}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cream-muted transition-colors hover:text-gold"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cream-muted transition-colors hover:text-gold"
          >
            <LinkIcon />
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}

      {/*
        Announced rather than only shown, because the label change is the only
        confirmation that the copy worked and a screen reader would otherwise
        get nothing back from pressing the button.
      */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function ShareIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.17-1.36a9.9 9.9 0 0 0 4.87 1.25h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.9 9.9 0 0 0 12.04 2Zm0 18.18h-.01a8.3 8.3 0 0 1-4.22-1.16l-.3-.18-3.07.8.82-2.99-.2-.31a8.24 8.24 0 0 1-1.27-4.39c0-4.57 3.72-8.29 8.3-8.29 2.21 0 4.29.86 5.86 2.43a8.24 8.24 0 0 1 2.43 5.87c0 4.57-3.72 8.22-8.34 8.22Zm4.55-6.16c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.56.12-.17.25-.64.81-.79.98-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.59 4.11 3.63.58.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.42-.58 1.62-1.15.2-.56.2-1.05.14-1.15-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}
