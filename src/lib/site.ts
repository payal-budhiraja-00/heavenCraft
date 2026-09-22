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
  /*
   * City only. Street address, pincode and phone are still outstanding, and
   * they are what blocks LocalBusiness schema and a Google Business Profile
   * -- both need a full address Google can verify. Until then this stays at
   * locality level rather than guessing the rest, because a wrong address is
   * far more damaging than a partial one.
   */
  city: "Delhi",
  region: "DL",
  country: "IN",
  description:
    "Ergonomic chairs, height-adjustable desks and workspace accessories, built for long working days. Based in Delhi, delivered across India.",
} as const;

/** Absolute URL for canonicals, Open Graph and structured data. */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.origin}${suffix}`;
}
