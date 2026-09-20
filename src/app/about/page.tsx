import Link from "next/link";
import { Breadcrumbs, Container, SectionHeading } from "@/components/ui";
import { allProducts, groups } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";

const description =
  "HeavenCraft supplies ergonomic chairs, height-adjustable desks and workspace accessories across India.";

export const metadata = pageMetadata({
  title: "About",
  description,
  path: "/about/",
});

export default function AboutPage() {
  const subCount = groups.reduce((n, g) => n + g.subCategories.length, 0);

  return (
    <Container className="py-14 lg:py-20">
      <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "About" }]} />

      <div className="mt-8 max-w-2xl">
        <h1 className="type-wide text-display-2 font-bold text-cream">
          A desk should not cost you your back
        </h1>
        <span className="rule-gold mt-5" />

        <div className="mt-8 space-y-5 text-reading leading-relaxed text-cream-muted">
          <p>
            HeavenCraft is a unit of Jiwan. We supply ergonomic seating,
            height-adjustable desks and the workspace hardware that goes with
            them — to people working from home, to studios, and to offices
            fitting out a floor.
          </p>
          <p>
            Most furniture is sold on how it looks in a photograph. That is a
            reasonable way to buy a sofa and a poor way to buy something you
            will sit in for eight hours a day. A chair that cannot be adjusted
            to your body fits you by accident, and a desk at the wrong height
            costs you something every day you use it.
          </p>
          <p>
            So the range is chosen on what moves and what breathes: seat height,
            back angle, lumbar depth, armrest position, and a mesh back that
            survives an Indian summer. The accessories are stocked for the same
            reason — a monitor at the wrong height undoes a good chair, and a
            footrest fixes a hip angle that no amount of seat adjustment will.
          </p>
          <p>
            {allProducts.length} products across {subCount} categories, and we
            are happy to tell you which of them you do not need.
          </p>
        </div>
      </div>

      <div className="mt-20 border-t border-edge pt-14">
        <SectionHeading
          eyebrow="Fitting out a workspace?"
          title="Tell us what the room has to do"
          lead="Send the headcount, the floor plan and the budget. We will come back with a list and a price — and say so if something in the range is wrong for the job."
        />
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/contact/"
            className="inline-flex items-center rounded-plate bg-gold px-6 py-3 text-sm font-semibold text-base transition-colors hover:bg-gold-bright"
          >
            Get in touch
          </Link>
          <Link
            href="/chairs/"
            className="inline-flex items-center rounded-plate border border-edge-strong bg-raised px-6 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold"
          >
            Browse the range
          </Link>
        </div>
      </div>
    </Container>
  );
}
