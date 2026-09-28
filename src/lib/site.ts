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
   * E.164 for `tel:` and schema, and a pretty form for display. WhatsApp wants
   * the digits with a country code and no punctuation at all.
   *
   * One number covers sales and support. It is the same line on WhatsApp,
   * which for this market is the channel that actually gets used -- a missed
   * call is a lost order, a WhatsApp message is a conversation tomorrow.
   */
  phone: "+919773733571",
  phoneDisplay: "+91 97737 33571",
  whatsapp: "919773733571",

  street: "WZ-300A, GL-11, Hari Nagar",
  city: "New Delhi",
  region: "DL",
  postalCode: "110058",
  country: "IN",

  /*
   * A showroom customers can walk into, which is what makes LocalBusiness
   * honest here and what makes a Google Business Profile eligible for the map
   * pack rather than a service-area listing.
   */
  hasShowroom: true,

  /*
   * Open every day, with a Wednesday half-day.
   *
   * Modelled as separate blocks rather than one range plus a footnote,
   * because `openingHoursSpecification` is what drives Google's "Open now"
   * and the closing time has to be right per day or it tells someone the shop
   * is open at 18:00 on a Wednesday when it shut four hours earlier. The same
   * array renders the human-readable line, so the two cannot disagree.
   */
  openingHours: [
    {
      days: ["Monday", "Tuesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "10:00",
      closes: "19:00",
    },
    { days: ["Wednesday"], opens: "10:00", closes: "14:00" },
  ],
  /** Human-readable, for body copy where a schema array would not do. */
  hoursSummary: "Seven days a week, 10:00–19:00 · Wednesday until 14:00",

  /*
   * Profiles that represent the same business. `sameAs` is how Google is told
   * these are one entity rather than several, which consolidates whatever
   * authority each has earned. Only accounts that exist go here.
   */
  sameAs: [
    "https://www.instagram.com/heavencraft_furniture",
    "https://www.facebook.com/share/1Dcgv4wSFm/",
  ],

  description:
    "Ergonomic chairs, height-adjustable desks and workspace accessories, built for long working days. A New Delhi store, delivering across India.",
} as const;

/**
 * The public link a customer follows to write a review.
 *
 * Judge.me issues one per shop, under Collect reviews -> Review link, and it
 * carries an unguessable token: it cannot be derived from the shop domain, so
 * it has to be pasted here once.
 *
 * It is public on purpose. Anyone holding it can leave a review without an
 * order behind them, which is exactly what makes it work for someone who
 * bought in the showroom -- there is no Shopify order for Judge.me to email,
 * so the automatic request that online buyers get never fires for them.
 *
 * A review left this way still earns the verified mark: Judge.me mails the
 * reviewer a confirmation, and clicking it is what counts. What it verifies
 * is a real person rather than a specific order, which is why the badge on
 * the product page reads "Verified" and not "Verified purchase". That is
 * handled where the badge is rendered, off `review.verified`, not here.
 *
 * Not a secret and not an environment variable: it gets printed on a card and
 * encoded into a QR code, so the repo is the honest place for it.
 *
 * Typed as `string` rather than inferred, so that an empty default is not
 * narrowed to the literal `""` and every check against it compiled away.
 */
export const REVIEW_LINK: string =
  "https://judge.me/product_reviews/5920f7e2-b4f4-4bb7-8273-882db53ba8b6/new?source=shareable-link";

/**
 * Commercial terms, in one place because they are asserted in three: policy
 * pages a customer reads, Offer schema a search engine reads, and the buy box.
 * When they drift apart the policy page is the one that is legally binding, so
 * they are not allowed to drift.
 */
export const TERMS = {
  /** Same cover across chairs, tables and accessories. */
  warrantyMonths: 24,

  /*
   * Returns cover what arrived wrong -- damaged, faulty, or not the item
   * ordered -- and not a change of mind.
   *
   * Return freight on furniture is a large fraction of the item's value, so a
   * change-of-mind window is a promise this business would have to break or
   * lose money honouring. An unadvertised return handled generously case by
   * case is better than a published one that gets argued about.
   *
   * This does not touch the statutory position: nothing here limits a buyer's
   * rights under Indian consumer law for goods that are faulty or misdescribed.
   */
  acceptsChangeOfMindReturns: false,
  /** Hours from delivery to report damage, a fault, or a wrong item. */
  faultReportHours: 48,
  /** On a return that is our fault, the freight is ours too. */
  returnShippingPaidBy: "merchant",

  deliveryDaysMin: 3,
  deliveryDaysMax: 5,

  /*
   * Assembly at the customer's address, included on tables only.
   *
   * A desk is the item where assembly is genuinely awkward and where a bad
   * job shows up as a wobbling work surface months later. Chairs and
   * accessories ship flat-packed with the tools in the carton.
   *
   * Scoped as a list rather than a boolean because the claim is made in five
   * places, and five independently-edited strings is how a storefront ends up
   * promising something on one page and denying it on another.
   */
  installationIncludedFor: ["tables"],

  bulkMinimumUnits: 10,
} as const;

/** Whether assembly at the customer's address is included for a category. */
export function includesAssembly(groupSlug: string): boolean {
  return (TERMS.installationIncludedFor as readonly string[]).includes(
    groupSlug,
  );
}

/** The digits-only WhatsApp link, with an optional opening message. */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${SITE.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Absolute URL for canonicals, Open Graph and structured data. */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.origin}${suffix}`;
}
