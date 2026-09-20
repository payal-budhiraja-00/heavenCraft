import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-card";
import { Breadcrumbs, Container, Label } from "@/components/ui";
import { getGroup, groups } from "@/lib/catalog";
import { priceRange } from "@/lib/catalog-types";
import { encodeImagePath, featureImage, imageAlt } from "@/lib/images";
import { formatPaise } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";

type Params = { group: string };

export function generateStaticParams(): Params[] {
  return groups.map((group) => ({ group: group.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { group: slug } = await params;
  const group = getGroup(slug);
  if (!group) return {};

  const range = priceRange(group.products);
  const title = `Ergonomic ${group.name} Online`;
  const description = `${group.description} ${group.products.length} products from ${formatPaise(range.minPaise)}.`;

  return {
    title,
    description,
    alternates: { canonical: group.href },
    openGraph: {
      title: `${title} | HeavenCraft`,
      description,
      url: absoluteUrl(group.href),
      type: "website",
    },
  };
}

export default async function GroupPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { group: slug } = await params;
  const group = getGroup(slug);
  if (!group) notFound();

  const range = priceRange(group.products);
  const lead = group.products.find((p) => featureImage(p));
  const heroSrc = lead ? featureImage(lead) : undefined;

  const breadcrumbSchema = {
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
    ],
  };

  return (
    <>
      <section className="relative isolate border-b border-edge">
        {heroSrc && lead ? (
          <>
            <Image
              src={encodeImagePath(heroSrc)}
              alt={imageAlt(lead)}
              fill
              priority
              sizes="100vw"
              className="-z-10 object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="scrim-bottom absolute inset-0 -z-10"
            />
          </>
        ) : null}

        <Container className="py-20 lg:py-28">
          <Breadcrumbs
            trail={[{ label: "Home", href: "/" }, { label: group.name }]}
          />

          <h1 className="type-wide mt-6 max-w-3xl text-display-2 font-bold text-cream">
            {group.name}
          </h1>
          <span className="rule-gold mt-5" />
          <p className="mt-5 max-w-xl text-reading text-cream-muted">
            {group.description}
          </p>
          <p className="label mt-7 text-gold">
            {group.products.length} products · {formatPaise(range.minPaise)} –{" "}
            {formatPaise(range.maxPaise)}
          </p>
        </Container>
      </section>

      <Container className="py-14">
        <Label>Narrow it down</Label>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {group.subCategories.map((sub) => (
            <li key={sub.slug}>
              <Link
                href={sub.href}
                className="inline-flex items-baseline gap-2 rounded-plate border border-edge bg-surface px-4 py-2.5 text-sm text-cream-muted transition-colors hover:border-gold hover:text-gold"
              >
                {sub.name}
                <span className="tnum text-xs text-cream-faint">
                  {sub.products.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-14">
          <ProductGrid products={group.products} priorityCount={4} />
        </div>
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
