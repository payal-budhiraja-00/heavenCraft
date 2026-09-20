/**
 * Site-wide constants.
 *
 * The canonical origin matters more than it looks: Google treats
 * `theheavencraft.in` and `www.theheavencraft.in` as different sites, right
 * down to allowing them separate favicons. One host is canonical, everything
 * else redirects to it, and every absolute URL in the build is derived from
 * this value.
 */

export const SITE = {
  name: "HeavenCraft",
  legalName: "HeavenCraft, a unit of Jiwan",
  origin: "https://theheavencraft.in",
  email: "heavencraft09@gmail.com",
  description:
    "Ergonomic chairs, height-adjustable desks and workspace accessories, built for long working days.",
} as const;

/** Absolute URL for canonicals, Open Graph and structured data. */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.origin}${suffix}`;
}
