import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { ButtonLink, Container, Label, SectionHeading } from "@/components/ui";
import { allProducts, getGroup, groups } from "@/lib/catalog";
import { priceRange } from "@/lib/catalog-types";
import {
  encodeImagePath,
  featureImage,
  gridAspect,
  imageAlt,
  imageFocus,
} from "@/lib/images";
import { formatPaise } from "@/lib/money";

/*
 * The hero is a portrait frame, so the page is built around a split rather
 * than a letterbox band: type holds the left column, the photograph runs
 * full-height on the right and bleeds off the edge. A wide crop of a portrait
 * image would have cut the chair in half.
 *
 * Chosen by eye from the September 2026 set. Most frames in that set stage
 * slogan posters, printed mugs or -- in the Neuro meeting-room frame -- a
 * whiteboard of unreadable pseudo-equations, none of which survive being
 * rendered a metre wide. This one carries no text at all.
 */
const HERO_SRC = "/images/products/chairs/mesh-chair/neuro-mesh-chair/grey/3.jpeg";

/**
 * Flagship first: the sit-stand desks are the reason to visit. Then a spread
 * across both chair ranges and down to an accessory, so the grid shows the
 * whole price ladder rather than eight variations on a desk.
 *
 * Quantum is deliberately absent -- see `NOT_FOR_FEATURE` in lib/images.ts.
 */
const FEATURED_IDS = [
  "table-height-adjustable-006",
  "chair-mesh-006",
  "table-executive-003",
  "chair-mesh-004",
  "table-height-adjustable-005",
  "chair-fabric-003",
  "table-study-003",
  "accessories-footrest-001",
];

export default function HomePage() {
  /*
   * Throws rather than filtering. These IDs are written by hand and the
   * catalogue is replaced wholesale when the supplier sends a new range; the
   * previous version quietly dropped missing entries, so a range change left
   * the homepage showing four products instead of eight with nothing to say
   * it had happened.
   */
  const featured = FEATURED_IDS.map((id) => {
    const product = allProducts.find((p) => p.id === id);
    if (!product) {
      throw new Error(
        `FEATURED_IDS names "${id}", which is not in the catalogue. ` +
          `Pick a replacement in src/app/page.tsx.`,
      );
    }
    return product;
  });

  const range = priceRange(allProducts);
  const subCount = groups.reduce((n, g) => n + g.subCategories.length, 0);

  return (
    <>
      <section className="relative border-b border-edge">
        <div className="grid lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.05fr_1fr]">
          <div className="relative z-10 flex items-center">
            <Container className="max-w-none py-20 lg:py-28 lg:pr-16">
              <div className="rise mx-auto max-w-xl lg:mx-0 lg:ml-auto lg:max-w-lg">
                <Label>Ergonomic workspace furniture</Label>

                <h1 className="type-wide mt-5 text-display-1 font-bold text-cream">
                  Built for the{" "}
                  <br />
                  <span className="text-gold">eight-hour</span> day.
                </h1>

                <p className="mt-7 max-w-md text-reading text-cream-muted">
                  Task chairs, height-adjustable desks and the hardware that
                  goes around them — selected for people who sit at a desk all
                  day, not for a showroom floor.
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <ButtonLink href="/chairs/">Shop chairs</ButtonLink>
                  <ButtonLink href="/tables/height-adjustable-table/" variant="secondary">
                    Height-adjustable desks
                  </ButtonLink>
                </div>

                <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-edge pt-7">
                  <Stat label="Products" value={String(allProducts.length)} />
                  <Stat label="Categories" value={String(subCount)} />
                  <Stat label="From" value={formatPaise(range.minPaise)} />
                </dl>
              </div>
            </Container>
          </div>

          {/*
            Shaped to the photograph rather than given a fixed height. The
            supplier's chair frames are upright at about 0.67:1, and a short
            landscape band cropped 55% of the frame away -- on a phone the
            hero showed a strip of seat with the base and headrest gone.
          */}
          <div className="relative aspect-4/5 sm:aspect-square lg:aspect-auto lg:min-h-[44rem]">
            <Image
              src={encodeImagePath(HERO_SRC)}
              alt="Two dark grey mesh task chairs with adjustable headrests in a high-rise office overlooking a city skyline"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              style={{ objectPosition: imageFocus(HERO_SRC) }}
              className="object-cover"
            />
            {/* Angled on desktop so the type side stays dark while the chair
                keeps its own light; vertical on mobile where they stack. */}
            <div
              aria-hidden="true"
              className="scrim-bottom absolute inset-0 lg:hidden"
            />
            <div
              aria-hidden="true"
              className="scrim-left absolute inset-0 hidden lg:block"
            />
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <SectionHeading
            eyebrow="The range"
            title="Three things a desk needs"
            lead="Everything here falls into one of three groups. Start wherever the problem is."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {groups.map((group) => (
              <GroupCard key={group.slug} slug={group.slug} />
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-edge bg-surface py-20 lg:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
            <SectionHeading
              eyebrow="How we choose"
              title="Adjustment, not upholstery"
            />

            <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
              <Point title="It has to move">
                Seat height, back angle, lumbar depth, armrest position. A chair
                that cannot be adjusted to a body is a chair that fits one
                person by accident.
              </Point>
              <Point title="Mesh where it matters">
                A breathable back is the difference between hour two and hour
                seven in an Indian summer. It is the first thing we look at on a
                task chair.
              </Point>
              <Point title="Desks that change height">
                Sitting is not the problem; sitting still is. A desk that moves
                between seated and standing gets used differently from one that
                does not.
              </Point>
              <Point title="The small hardware counts">
                A monitor at the wrong height undoes a good chair. Risers,
                footrests and cable trays are stocked because the desk does not
                work without them.
              </Point>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Selected" title="Worth a closer look" />
            <Link
              href="/tables/"
              className="label text-gold transition-colors hover:text-gold-bright"
            >
              All tables →
            </Link>
          </div>

          <div className="mt-12">
            <ProductGrid products={featured} priorityCount={4} />
          </div>
        </Container>
      </section>

      <section className="border-t border-edge py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow="Browse"
            title="Every category"
            lead="Sixteen groups across chairs, tables and accessories."
          />

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {groups.map((group) => (
              <div key={group.slug}>
                <h3 className="type-wide text-lg font-bold text-cream">
                  <Link
                    href={group.href}
                    className="transition-colors hover:text-gold"
                  >
                    {group.name}
                  </Link>
                </h3>
                <ul className="mt-4 space-y-1">
                  {group.subCategories.map((sub) => (
                    <li key={sub.slug}>
                      <Link
                        href={sub.href}
                        className="flex items-baseline justify-between gap-3 border-b border-edge py-2.5 text-sm text-cream-muted transition-colors hover:text-gold"
                      >
                        <span>{sub.name}</span>
                        <span className="tnum text-xs text-cream-faint">
                          {sub.products.length}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-8">
        <Container>
          <div className="rounded-panel border border-edge bg-surface px-8 py-14 text-center sm:px-14">
            <SectionHeading
              align="center"
              eyebrow="Fitting out an office?"
              title="Tell us what the room has to do"
              lead="Send the headcount, the floor plan and the budget. We will come back with a list and a price."
            />
            <div className="mt-9">
              <ButtonLink href="/contact/">Request a quote</ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label text-cream-faint">{label}</dt>
      <dd className="tnum mt-1.5 text-xl font-bold text-cream">{value}</dd>
    </div>
  );
}

function Point({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gold">{title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-cream-muted">
        {children}
      </p>
    </div>
  );
}

function GroupCard({ slug }: { slug: string }) {
  const group = getGroup(slug);
  if (!group) return null;

  const lead = group.products.find((p) => featureImage(p));
  const src = lead ? featureImage(lead) : undefined;
  const range = priceRange(group.products);

  /*
   * The tile takes the same shape its own range takes on the category page
   * rather than a fixed square. The chairs are shot upright at about 0.6:1,
   * and a square tile threw away 40% of the chair -- the one thing the tile
   * exists to show.
   */
  const aspect = lead ? gridAspect([lead]) : "aspect-4/5";

  return (
    <Link
      href={group.href}
      className={`group relative flex ${aspect} flex-col justify-end overflow-hidden rounded-panel border border-edge`}
    >
      {src && lead ? (
        <ProductImage
          src={src}
          alt={imageAlt(lead)}
          sizes="(min-width: 768px) 33vw, 90vw"
          className="transition-transform duration-700 ease-out group-hover:scale-105"
        />
      ) : null}

      <div aria-hidden="true" className="scrim-bottom absolute inset-0" />

      <div className="relative p-7">
        <span className="label text-gold">
          {group.products.length} products · from {formatPaise(range.minPaise)}
        </span>
        <h3 className="type-wide mt-2.5 text-display-3 font-bold text-cream">
          {group.name}
        </h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-cream-muted">
          {group.description}
        </p>
      </div>
    </Link>
  );
}
