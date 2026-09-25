import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/components/buy-box";
import {
  ColourPicker,
  VariantGallery,
  VariantPrice,
  VariantProvider,
} from "@/components/variant-picker";
import { ProductGrid } from "@/components/product-card";
import {
  Breadcrumbs,
  Container,
  Label,
  SectionHeading,
  type Crumb,
} from "@/components/ui";
import { getGroup, getProduct, getSubCategory, groups } from "@/lib/catalog";
import type { Group, Product, SubCategory } from "@/lib/catalog-types";
import { priceRange } from "@/lib/catalog-types";
import { features } from "@/lib/features";
import { encodeImagePath, imageAlt } from "@/lib/images";
import { pageMetadata } from "@/lib/seo";
import { formatPaise, paiseToPriceString } from "@/lib/money";
import { SITE, absoluteUrl } from "@/lib/site";

type Params = { group: string; slug: string };

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
    const description = `${sub.description} ${sub.products.length} ${sub.name.toLowerCase()} from ${formatPaise(range.minPaise)}.`;
    const lead = sub.products.find((p) => p.images.length > 0);

    return pageMetadata({
      title: sub.name,
      description,
      path: sub.href,
      image: lead ? encodeImagePath(lead.images[0]!) : undefined,
      imageAlt: lead ? imageAlt(lead) : undefined,
    });
  }

  const { product } = found;
  const description =
    product.description.length > 155
      ? `${product.description.slice(0, 152).trimEnd()}…`
      : product.description;
  const image = product.images[0];

  return pageMetadata({
    title: product.name,
    description,
    path: product.href,
    image: image ? encodeImagePath(image) : undefined,
    imageAlt: image ? imageAlt(product) : undefined,
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
    seller: { "@type": "Organization", name: SITE.legalName },
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
                  className="label text-gold transition-colors hover:text-gold-bright"
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

              {product.features.length ? (
                <div className="mt-10 border-t border-edge pt-8">
                  <Label>Specifications</Label>
                  <ul className="mt-4 space-y-3">
                    {product.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-3 text-sm leading-relaxed text-cream-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2 size-1 shrink-0 rounded-full bg-gold"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-xs leading-relaxed text-cream-faint">
                    Specifications as declared by the manufacturer. Dimensions
                    may vary slightly between production batches.
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
            className="label mt-10 inline-flex items-center gap-2 text-gold transition-colors hover:text-gold-bright"
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