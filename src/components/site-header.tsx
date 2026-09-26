"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CartButton } from "./cart-drawer";
import { Wordmark } from "./wordmark";
import { Container } from "./ui";
import { SITE, whatsappUrl } from "@/lib/site";

/**
 * Nav data is passed in from the server rather than imported here, so the
 * full catalog -- descriptions, features, reviews and all -- never ends up in
 * the client bundle just to draw a menu.
 */
export type NavGroup = {
  slug: string;
  name: string;
  href: string;
  subCategories: { slug: string; name: string; href: string; count: number }[];
};

/**
 * Colour alone was carrying the "you are here" signal, which says nothing to a
 * screen reader. Exact matches are the current page; an ancestor section that
 * merely contains it is "true", not "page".
 */
function ariaCurrent(
  pathname: string | null,
  href: string,
): "page" | "true" | undefined {
  if (pathname === href) return "page";
  return pathname?.startsWith(href) ? "true" : undefined;
}

export function SiteHeader({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /**
   * Which desktop group panel is showing, if any.
   *
   * This used to be pure CSS -- `group-hover` plus `group-focus-within` --
   * which cannot survive a client-side navigation. Clicking an item leaves the
   * pointer over the panel and focus on the link inside it, so both selectors
   * still matched and the menu hung over the page it had just opened. Moving
   * the pointer away did not help, because focus alone kept it open until the
   * visitor happened to click somewhere else.
   *
   * Driving it from state is what lets a route change close it, which is the
   * one thing the CSS had no way to express.
   */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  /*
   * A route change must not leave the mobile sheet or a desktop panel hanging
   * open over the new page. Adjusted during render rather than in an effect:
   * an effect would paint the new route with the old menu still over it, then
   * re-render to remove it.
   */
  const [routeWhenOpened, setRouteWhenOpened] = useState(pathname);
  if (routeWhenOpened !== pathname) {
    setRouteWhenOpened(pathname);
    setOpen(false);
    setOpenGroup(null);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open
          ? "border-edge bg-base/92 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <Container>
        <div className="flex h-18 items-center justify-between gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center transition-opacity hover:opacity-80"
            aria-label="HeavenCraft — home"
          >
            <Wordmark size="lg" priority />
          </Link>

          <nav
            aria-label="Main"
            className="hidden items-center gap-1 lg:flex"
          >
            {groups.map((group) => {
              const active = pathname?.startsWith(group.href);
              return (
                /*
                 * Pointer and focus are handled on the wrapper, not the links:
                 * React maps onFocus/onBlur to focusin/focusout, so tabbing
                 * into the panel keeps it open and tabbing past it closes it,
                 * which is what `group-focus-within` used to do.
                 */
                <div
                  key={group.slug}
                  className="relative"
                  onPointerEnter={() => setOpenGroup(group.slug)}
                  onPointerLeave={() =>
                    setOpenGroup((current) =>
                      current === group.slug ? null : current,
                    )
                  }
                  /*
                   * Closing on the click itself, not on the route change.
                   * The route-change reset below cannot be the only mechanism:
                   * it runs inside the router's transition, and it does not
                   * run at all when the link points at the page already open,
                   * which would leave the panel stranded over its own page.
                   */
                  onClick={() => setOpenGroup(null)}
                  onFocus={() => setOpenGroup(group.slug)}
                  onBlur={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget)) return;
                    setOpenGroup((current) =>
                      current === group.slug ? null : current,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setOpenGroup(null);
                  }}
                >
                  <Link
                    href={group.href}
                    aria-current={ariaCurrent(pathname, group.href)}
                    className={`flex items-center gap-1.5 rounded-plate px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "text-gold"
                        : "text-cream-muted hover:text-cream"
                    }`}
                  >
                    {group.name}
                    <Chevron open={openGroup === group.slug} />
                  </Link>

                  {/*
                    Hover-intent is handled with a bridging pad rather than a
                    timer: the panel starts flush under the trigger so the
                    pointer never crosses dead space on the way down.
                  */}
                  <div
                    className={`absolute left-1/2 top-full z-10 w-72 -translate-x-1/2 pt-2 transition-[opacity,visibility] duration-150 ${
                      openGroup === group.slug
                        ? "visible opacity-100"
                        : "invisible opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden rounded-panel border border-edge bg-surface shadow-panel">
                      <ul className="p-2">
                        {group.subCategories.map((sub) => (
                          <li key={sub.slug}>
                            <Link
                              href={sub.href}
                              aria-current={ariaCurrent(pathname, sub.href)}
                              className="flex items-baseline justify-between gap-3 rounded-plate px-3 py-2.5 text-sm text-cream-muted transition-colors hover:bg-gold-wash hover:text-gold"
                            >
                              <span>{sub.name}</span>
                              <span className="tnum text-xs text-cream-faint">
                                {sub.count}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={group.href}
                        className="label block border-t border-edge px-5 py-3 text-gold transition-colors hover:bg-gold-wash"
                      >
                        All {group.name} →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            <Link
              href="/about/"
              aria-current={ariaCurrent(pathname, "/about/")}
              className={`rounded-plate px-4 py-2 text-sm font-medium transition-colors ${
                pathname?.startsWith("/about")
                  ? "text-gold"
                  : "text-cream-muted hover:text-cream"
              }`}
            >
              About
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${SITE.phone}`}
              className="hidden items-center gap-2 text-sm font-semibold text-cream transition-colors hover:text-gold md:inline-flex"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {SITE.phoneDisplay}
            </a>

            <Link
              href="/contact/"
              className="hidden rounded-plate border border-edge-strong px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold sm:inline-flex"
            >
              Get a quote
            </Link>

            {/* Renders nothing unless the commerce preview gate is open. */}
            <CartButton />

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="rounded-plate p-2.5 text-cream transition-colors hover:text-gold lg:hidden"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </Container>

      {open ? (
        <div
          id="mobile-nav"
          className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-edge bg-base lg:hidden"
        >
          <Container className="py-6">
            <ul className="space-y-7">
              {groups.map((group) => (
                <li key={group.slug}>
                  <Link
                    href={group.href}
                    aria-current={ariaCurrent(pathname, group.href)}
                    className="type-wide text-lg font-bold text-cream"
                  >
                    {group.name}
                  </Link>
                  <ul className="mt-3 space-y-0.5 border-l border-edge pl-4">
                    {group.subCategories.map((sub) => (
                      <li key={sub.slug}>
                        <Link
                          href={sub.href}
                          aria-current={ariaCurrent(pathname, sub.href)}
                          className="flex items-baseline justify-between gap-3 py-2 text-sm text-cream-muted"
                        >
                          <span>{sub.name}</span>
                          <span className="tnum text-xs text-cream-faint">
                            {sub.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            {/*
              The quote button in the bar is hidden below 640px, so on a phone
              this sheet is the only route to it. A plain text link buried
              under About made the one conversion action the least visible
              thing in the menu.
            */}
            <div className="mt-8 border-t border-edge pt-6">
              <Link
                href="/contact/"
                className="flex w-full items-center justify-center rounded-plate bg-gold px-6 py-3 text-sm font-semibold text-base transition-colors hover:bg-gold-bright"
              >
                Get a quote
              </Link>

              {/*
                Two taps that do not require typing anything. On a phone these
                outperform a form for a considered purchase, and WhatsApp in
                particular lets the conversation survive the customer closing
                the browser.
              */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <a
                  href={`tel:${SITE.phone}`}
                  className="flex min-h-11 items-center justify-center rounded-plate border border-edge-strong px-4 py-3 text-sm font-semibold text-cream"
                >
                  Call
                </a>
                <a
                  href={whatsappUrl(
                    `Hi ${SITE.name}, I have a question about your furniture.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center rounded-plate border border-edge-strong px-4 py-3 text-sm font-semibold text-cream"
                >
                  WhatsApp
                </a>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/about/"
                  aria-current={ariaCurrent(pathname, "/about/")}
                  className="py-2 text-sm text-cream-muted"
                >
                  About
                </Link>
                <Link
                  href="/contact/"
                  aria-current={ariaCurrent(pathname, "/contact/")}
                  className="py-2 text-sm text-cream-muted"
                >
                  Contact
                </Link>
              </div>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
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
      <path d="M3 6h18M3 12h18M3 18h18" />
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
