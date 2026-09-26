import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/components/buy-box";
import {
  ColourPicker,
  VariantFeatures,
  VariantGallery,
  VariantMaterialsRow,
  VariantSpecRows,
  VariantPrice,
  VariantProvider,
} from "@/components/variant-picker";
import { ProductGrid } from "@/components/product-card";
import { ShareProduct } from "@/components/share-product";
import {
  Breadcrumbs,
  Container,
  FeatureList,
  Label,
  SectionHeading,
  SpecRow,
  type Crumb,
} from "@/components/ui";
import { getGroup, getProduct, getSubCategory, groups } from "@/lib/catalog";
import type { Group, Product, SubCategory } from "@/lib/catalog-types";
import { priceRange } from "@/lib/catalog-types";
import { features } from "@/lib/features";
import { encodeImagePath, imageAlt } from "@/lib/images";
import { composeDescription, pageMetadata } from "@/lib/seo";
import { formatPaise, paiseToPriceString } from "@/lib/money";
import { SITE, TERMS, absoluteUrl } from "@/lib/site";

type Params = { group: string; slug: string };

/**
 * Whether a spec row states a physical measurement, as opposed to a grade, a
 * count or a mechanism. Tested on the value rather than the label because the
 * labels lie in both directions: "Height adjustment" is a gas lift, "Recline
 * range" is degrees, while "Fits different table thickness" is genuinely
 * "1.5 – 5 cm". A number followed by a length unit is the reliable signal.
 */
const MEASURED_VALUE = /\d\s*(?:mm|cm|m|in|inch|inches|ft|")(?![a-z])/i;

/**
 * Singular nouns for the share label. The catalogue's group names are plural
 * and "Share this Accessories" is not a sentence.
 */
const SHARE_NOUNS: Record<string, string> = {
  chairs: "chair",
  tables: "desk",
  accessories: "piece",
};

/**
 * Sub-categories and products share one URL shape, so both are emitted from
 * here. `catalog.ts` fails the build if a product slug ever collides with a
 * sub-category slug inside the same group, which is what makes this safe.
 */
export function generateStaticParams(): Params[] {
  const params: Params[] = [];

  for (const group of groups) {
    for (const sub of group.subCategories) {
      if (sub.collapsed) continue;
      params.push({ group: group.slug, slug: sub.slug });
    }
    for (const product of group.products) {
      params.push({ group: group.slug, slug: product.slug });
    }
  }

  return params;
}

function resolve(groupSlug: string, slug: string) {
  const group = getGroup(groupSlug);
  if (!group) return null;

  const sub = getSubCategory(groupSlug, slug);
  if (sub) return { kind: "sub" as const, group, sub };

  const product = getProduct(groupSlug, slug);
  if (product) return { kind: "product" as const, group, product };

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { group: groupSlug, slug } = await params;
  const found = resolve(groupSlug, slug);
  if (!found) return {};

  if (found.kind === "sub") {
    const { sub } = found;
    const range = priceRange(sub.products);
    /*
      Sub-category names are plural ("Cable Management Trays"), so counting
      into them produced "1 cable management trays". Singularise the name when
      there is one product rather than counting separately, because the phrase
      has to agree with whatever the catalogue happens to hold.
    */
    const noun =
      sub.products.length === 1
        ? sub.name.toLowerCase().replace(/e?s$/, "")
        : sub.name.toLowerCase();
    const description = `${sub.description} ${sub.products.length} ${noun} from ${formatPaise(range.minPaise)}.`;
    const lead = sub.products.find((p) => p.images.length > 0);

    return pageMetadata({
      title: sub.name,
      description,
      path: sub.href,
      cardProductId: lead?.id,
      imageAlt: lead ? imageAlt(lead) : undefined,
    });
  }

  const { product } = found;
  /*
    The product's own words first, and the trust clause in the room left over.
    A buyer reading the snippet learns more from what the thing is than from
    our terms, so the description is what gets trimmed to make them both fit.
  */
  const description = composeDescription(product.description);

  return pageMetadata({
    title: product.name,
    description,
    path: product.href,
    cardProductId: product.images.length ? product.id : undefined,
    imageAlt: product.images.length ? imageAlt(product) : undefined,
  });
}

export default async function GroupSlugPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { group: groupSlug, slug } = await params;
  const found = resolve(groupSlug, slug);
  if (!found) notFound();

  return found.kind === "sub" ? (
    <SubCategoryView group={found.group} sub={found.sub} />
  ) : (
    <ProductView group={found.group} product={found.product} />
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-category                                                               */
/* -------------------------------------------------------------------------- */

function SubCategoryView({ group, sub }: { group: Group; sub: SubCategory }) {
  const range = priceRange(sub.products);
  const siblings = group.subCategories.filter((s) => s.slug !== sub.slug);

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: group.name,
        item: absoluteUrl(group.href),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: sub.name,
        item: absoluteUrl(sub.href),
      },
    ],
  };

  return (
    <>
      <Container className="border-b border-edge py-14 lg:py-20">
        <Breadcrumbs
          trail={[
            { label: "Home", href: "/" },
            { label: group.name, href: group.href },
            { label: sub.name },
          ]}
        />

        <h1 className="type-wide mt-6 max-w-3xl text-display-2 font-bold text-cream">
          {sub.name}
        </h1>
        <span className="rule-gold mt-5" />
        {sub.description ? (
          <p className="mt-5 max-w-xl text-reading text-cream-muted">
            {sub.description}
          </p>
        ) : null}
        <p className="label mt-7 text-gold">
          {sub.products.length}{" "}
          {sub.products.length === 1 ? "product" : "products"} ·{" "}
          {range.minPaise === range.maxPaise
            ? formatPaise(range.minPaise)
            : `${formatPaise(range.minPaise)} – ${formatPaise(range.maxPaise)}`}
        </p>
      </Container>

      <Container className="py-14">
        <ProductGrid products={sub.products} priorityCount={4} />

        {siblings.length ? (
          <div className="mt-20 border-t border-edge pt-12">
            <Label>More in {group.name.toLowerCase()}</Label>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {siblings.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={other.href}
                    className="inline-flex items-baseline gap-2 rounded-plate border border-edge bg-surface px-4 py-2.5 text-sm text-cream-muted transition-colors hover:border-gold hover:text-gold"
                  >
                    {other.name}
                    <span className="tnum text-xs text-cream-faint">
                      {other.products.length}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Product                                                                    */
/* -------------------------------------------------------------------------- */

function ProductView({ group, product }: { group: Group; product: Product }) {
  const subHref = `/${group.slug}/${product.subSlug}/`;
  /*
   * When the range collapsed into this product, `subHref` is this page's own
   * URL. Linking to it -- in the breadcrumb or the eyebrow above the title --
   * would be a self-link that looks broken to a visitor and dilutes the
   * breadcrumb trail for a crawler. The name is still shown, just not linked.
   */
  const subIsThisPage =
    group.subCategories.find((s) => s.slug === product.subSlug)?.collapsed ===
    true;

  /*
   * Same sub-category first -- those are the real alternatives to compare. A
   * sub-category holding a single product returns nothing from that filter,
   * though, and the page would then end with no way onward but the browser
   * back button, so widen to the rest of the group rather than show nothing.
   */
  const sameSub = group.products.filter(
    (p) => p.subSlug === product.subSlug && p.id !== product.id,
  );
  const wider = group.products.filter(
    (p) => p.subSlug !== product.subSlug && p.id !== product.id,
  );
  const relatedAreSiblings = sameSub.length > 0;
  const related = (relatedAreSiblings ? sameSub : wider).slice(0, 4);

  const trail: Crumb[] = [
    { label: "Home", href: "/" },
    { label: group.name, href: group.href },
    ...(subIsThisPage
      ? []
      : [{ label: product.subName, href: subHref } satisfies Crumb]),
    { label: product.name },
  ];

  /*
   * Product + Offer only.
   *
   * No `aggregateRating`, and no `review`. Every rating in products.json is
   * seeded demo content -- not one product below four stars -- and feeding an
   * invented score into Google's index is a structured-data policy breach,
   * not an exaggeration. It gets rich results revoked for the whole domain.
   * The stars go in when there are real orders behind them.
   *
   * One Offer per colourway. A product whose finishes differ in price -- the
   * footrest runs 999 to 1,599 -- would otherwise advertise a single figure
   * that two of its three variants do not honour, which is exactly the
   * mismatch Google penalises and a customer notices at checkout.
   */
  /*
    Delivery and returns, restated for machines.

    Google renders both directly in Shopping and in the product snippet, and
    an absent return policy is treated as a worse one -- "vague" scores below
    "30 days, buyer pays". Ours is unusually good and was invisible: seven
    days, with return shipping on us. It is worth the markup on its own.

    `shippingRate` is omitted rather than guessed. The free-shipping threshold
    and the rate below it are the two answers still outstanding, and a wrong
    delivery charge in a rich result is a complaint at the door.
  */
  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "IN",
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 1,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: TERMS.deliveryDaysMin,
        maxValue: TERMS.deliveryDaysMax,
        unitCode: "DAY",
      },
    },
  };

  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "IN",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: TERMS.returnDays,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
  };

  const offers = product.variants.map((variant) => ({
    "@type": "Offer",
    url: absoluteUrl(product.href),
    sku: variant.id,
    ...(product.variants.length > 1 ? { name: variant.colour } : {}),
    priceCurrency: "INR",
    price: paiseToPriceString(variant.pricePaise),
    availability: variant.inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/PreOrder",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: SITE.legalName },
    shippingDetails,
    hasMerchantReturnPolicy: returnPolicy,
    warranty: {
      "@type": "WarrantyPromise",
      durationOfWarranty: {
        "@type": "QuantitativeValue",
        value: TERMS.warrantyMonths,
        unitCode: "MON",
      },
    },
  }));

  /*
    The specifications table, restated for machines. Until the chair sheets
    were transcribed this would have been empty on every chair, so it was not
    worth emitting; now that the mechanism, armrest travel, gas-lift class and
    base are recorded, they are exactly the attributes a shopping surface
    matches a query against.

    Variant rows are excluded: `additionalProperty` describes the product, and
    a footrest that measures 17in in black and 18in in teak would otherwise
    assert both widths at once.
  */
  const additionalProperty = product.specifications.map((spec) => ({
    "@type": "PropertyValue",
    name: spec.label,
    value: spec.value,
  }));

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.id,
    category: `${group.name} > ${product.subName}`,
    // Encoded, unlike the raw paths held in the catalog: several filenames
    // contain spaces, and Google fetches these URLs verbatim.
    image: product.images.map((src) => absoluteUrl(encodeImagePath(src))),
    brand: { "@type": "Brand", name: SITE.name },
    /*
      No `manufacturer` node.

      The questionnaire answered "Manufacturer", but the specifications for
      this range were transcribed from supplier infographics, which is not
      what an own-factory range looks like. Claiming manufacture in structured
      data is a claim Google will surface as fact, so the bar is what we can
      stand behind rather than what the form said. `countryOfOrigin` stays --
      the goods are Indian-made, which is a separate and answerable question.
    */
    countryOfOrigin: { "@type": "Country", name: "India" },
    ...(additionalProperty.length ? { additionalProperty } : {}),
    offers: offers.length === 1 ? offers[0] : offers,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      ...(crumb.href ? { item: absoluteUrl(crumb.href) } : {}),
    })),
  };

  /*
    True only where the supplier printed one feature sheet per finish and the
    sheets disagree about the product rather than its colour. It gates the
    reactive sections so the other products keep their features on the server
    instead of shipping a second copy into the client payload.
  */
  const perFinish = product.variants.some(
    (v) => v.features?.length || v.specifications?.length,
  );
  const perFinishSpecs = product.variants.some((v) => v.specifications?.length);

  /*
    The footnote used to promise that "dimensions may vary between batches" on
    every product, including the chairs, whose suppliers never printed a
    measured drawing at all. Telling a shopper their figures might vary when no
    figures are shown reads as evasion. So the sentence is earned: it appears
    only where the table actually carries a measurement.
  */
  const hasMeasurements = [
    ...product.specifications,
    ...product.variants.flatMap((v) => v.specifications ?? []),
  ].some((spec) => MEASURED_VALUE.test(spec.value));

  return (
    <>
      <Container className="py-10 lg:py-14">
        <Breadcrumbs trail={trail} />

        <VariantProvider
          variants={product.variants.map((variant) => ({
            sku: variant.id,
            colour: variant.colour,
            colourSlug: variant.colourSlug,
            pricePaise: variant.pricePaise,
            images: variant.images,
            alts: variant.images.map((_, i) =>
              imageAlt(product, i, product.variants.length > 1 ? variant.colour : undefined),
            ),
            inStock: variant.inStock,
            ...(perFinish
              ? {
                  features: variant.features ?? [],
                  materials: variant.materials ?? [],
                  specifications: variant.specifications ?? [],
                }
              : {}),
          }))}
        >
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
            <VariantGallery />

            <div className="lg:sticky lg:top-28 lg:self-start">
              {subIsThisPage ? (
                <p className="label text-gold">{product.subName}</p>
              ) : (
                <Link
                  href={subHref}
                  className="label -mt-1.5 inline-block py-1.5 text-gold transition-colors hover:text-gold-bright"
                >
                  {product.subName}
                </Link>
              )}

              <h1 className="type-wide mt-3 text-display-3 font-bold text-cream">
                {product.name}
              </h1>

              <VariantPrice />
              <p className="mt-2 text-xs text-cream-faint">
                Inclusive of all taxes. Delivery quoted at checkout.
              </p>

              <p className="mt-7 text-reading text-cream-muted">
                {product.description}
              </p>

              <ColourPicker />

              <BuyBox
                productName={product.name}
                pageUrl={absoluteUrl(product.href)}
                email={SITE.email}
              />

              {/*
                The terms that answer the objections, in the one place the
                decision is made. All four were true already and all four were
                buried in policy pages nobody opens: a two-year warranty, a
                return window where we pay the courier, assembly included, and
                cash on delivery. For a first purchase from an unknown brand
                these do more work than another paragraph of description.
              */}
              <ul className="mt-7 grid gap-x-6 gap-y-3 border-t border-edge pt-6 text-sm text-cream-muted sm:grid-cols-2">
                <li>
                  <span className="text-cream">
                    {TERMS.warrantyMonths / 12}-year warranty
                  </span>{" "}
                  on every unit
                </li>
                <li>
                  <span className="text-cream">
                    {TERMS.returnDays}-day returns
                  </span>{" "}
                  — we pay the return shipping
                </li>
                <li>
                  <span className="text-cream">Free assembly</span> at your
                  address
                </li>
                <li>
                  <span className="text-cream">Cash on delivery</span>{" "}
                  available, no extra fee
                </li>
                <li>
                  <span className="text-cream">
                    {TERMS.deliveryDaysMin}–{TERMS.deliveryDaysMax} working days
                  </span>{" "}
                  across India
                </li>
                <li>
                  <span className="text-cream">Delhi showroom</span> — come and
                  sit in it before you buy
                </li>
              </ul>

              <ShareProduct
                productName={product.name}
                pageUrl={absoluteUrl(product.href)}
                noun={SHARE_NOUNS[group.slug] ?? "piece"}
              />

              {perFinish ? (
                <VariantFeatures />
              ) : product.features.length ? (
                <div className="mt-10 border-t border-edge pt-8">
                  <Label>Features</Label>
                  <FeatureList features={product.features} />
                </div>
              ) : null}

              {product.inTheBox.length ? (
                <div className="mt-10 border-t border-edge pt-8">
                  <Label>In the box</Label>
                  <ul className="mt-4 space-y-3">
                    {product.inTheBox.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-sm leading-relaxed text-cream-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2 size-1 shrink-0 rounded-full bg-gold"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {product.specifications.length ||
              product.materials.length ||
              perFinish ? (
                <div className="mt-10 border-t border-edge pt-8">
                  <Label>Specifications</Label>
                  {perFinishSpecs ? (
                    <p className="mt-2 text-xs text-cream-faint">
                      Measured for the finish selected above.
                    </p>
                  ) : null}
                  <dl className="mt-4 divide-y divide-edge">
                    {product.specifications.map((spec) => (
                      <SpecRow
                        key={spec.label}
                        label={spec.label}
                        value={spec.value}
                      />
                    ))}
                    {perFinishSpecs ? <VariantSpecRows /> : null}
                    {perFinish ? (
                      <VariantMaterialsRow />
                    ) : product.materials.length ? (
                      <SpecRow
                        label="Materials & finish"
                        value={product.materials.join(" · ")}                      />
                    ) : null}
                  </dl>
                  <p className="mt-5 text-xs leading-relaxed text-cream-faint">
                    Specifications as declared by the manufacturer.
                    {hasMeasurements
                      ? " Dimensions may vary slightly between production batches."
                      : null}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </VariantProvider>
      </Container>

      {features.reviews && product.reviews.length ? (
        <Container className="border-t border-edge py-16">
          <SectionHeading
            eyebrow={features.reviewsAreReal ? "Customer reviews" : "Sample content"}
            title="What people say"
          />
          {!features.reviewsAreReal ? (
            <p className="mt-4 max-w-xl rounded-panel border border-edge bg-gold-wash p-4 text-sm text-cream-muted">
              Placeholder copy shown while the review system is being set up.
              Not from verified buyers.
            </p>
          ) : null}
          <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {product.reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-panel border border-edge bg-surface p-6"
              >
                <p className="text-sm font-semibold text-cream">
                  {review.title}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-cream-muted">
                  {review.comment}
                </p>
                <p className="mt-4 text-xs text-cream-faint">
                  {review.author}
                  {/* The "verified" flag in the source data is seeded, so the
                      badge only appears once the reviews are genuinely real. */}
                  {features.reviewsAreReal && review.claimedVerified
                    ? " · Verified purchase"
                    : null}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      ) : null}

      {related.length ? (
        <Container className="border-t border-edge py-16">
          <SectionHeading
            eyebrow="Compare"
            title={
              relatedAreSiblings
                ? `Other ${product.subName.toLowerCase()}`
                : `More from ${group.name.toLowerCase()}`
            }
          />
          <div className="mt-10">
            <ProductGrid products={related} />
          </div>
          {/*
            Four is a full row and rarely the whole range. Without this the
            only route to the rest of the category is the back button.
          */}
          <Link
            href={relatedAreSiblings ? subHref : group.href}
            className="label mt-8 inline-flex min-h-11 items-center gap-2 py-2 text-gold transition-colors hover:text-gold-bright"
          >
            {relatedAreSiblings
              ? `All ${product.subName.toLowerCase()}`
              : `All ${group.name.toLowerCase()}`}
            <span aria-hidden="true">→</span>
          </Link>
        </Container>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}