import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The small set of primitives every page is built from. Kept deliberately
 * short: a button, a label, a section header, a breadcrumb. Anything that
 * appears once lives in the page that uses it.
 */

export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`label text-gold ${className}`}>
      {children}
    </span>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-plate px-6 py-3 text-sm font-semibold " +
  "transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-gold text-base hover:bg-gold-bright",
  secondary:
    "border border-edge-strong bg-raised text-cream hover:border-gold hover:text-gold",
  ghost: "text-cream-muted hover:text-gold",
} as const;

type ButtonVariant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`${buttonBase} ${variants[variant]} ${className}`}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      {...props}
      className={`${buttonBase} ${variants[variant]} ${className}`}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <Label>{eyebrow}</Label> : null}
      <h2 className="type-wide mt-3 text-display-3 font-bold text-cream">
        {title}
      </h2>
      <span className={`rule-gold mt-5 ${centered ? "mx-auto" : ""}`} />
      {lead ? (
        <p className="mt-5 text-reading text-cream-muted">{lead}</p>
      ) : null}
    </div>
  );
}

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cream-faint">
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-gold"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-cream-muted">{crumb.label}</span>
            )}
            {i < trail.length - 1 ? (
              <span aria-hidden="true" className="text-edge-strong">
                /
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Page-width container. One value, used everywhere, so nothing drifts. */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function StockPill({ inStock }: { inStock: boolean }) {
  return (
    <span
      className={`label inline-flex items-center gap-1.5 ${
        inStock ? "text-good" : "text-poor"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          inStock ? "bg-good" : "bg-poor"
        }`}
      />
      {inStock ? "In stock" : "Made to order"}
    </span>
  );
}
