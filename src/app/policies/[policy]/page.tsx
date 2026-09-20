import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/ui";
import { POLICIES, getPolicy } from "@/lib/policies";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

type Params = { policy: string };

export function generateStaticParams(): Params[] {
  return POLICIES.map((policy) => ({ policy: policy.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { policy: slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) return {};

  return pageMetadata({
    title: policy.title,
    description: policy.summary,
    path: `/policies/${policy.slug}/`,
  });
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { policy: slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) notFound();

  return (
    <Container className="py-14 lg:py-20">
      <Breadcrumbs
        trail={[{ label: "Home", href: "/" }, { label: policy.title }]}
      />

      <div className="mt-8 max-w-2xl">
        <h1 className="type-wide text-display-2 font-bold text-cream">
          {policy.title}
        </h1>
        <span className="rule-gold mt-5" />
        <p className="mt-5 text-reading text-cream-muted">{policy.summary}</p>

        <div className="mt-14 space-y-12">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-gold">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-reading leading-relaxed text-cream-muted"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 border-t border-edge pt-8 text-sm text-cream-faint">
          Questions about this policy? Write to{" "}
          <a
            href={`mailto:${SITE.email}`}
            className="text-gold transition-colors hover:text-gold-bright"
          >
            {SITE.email}
          </a>
          .
        </p>
      </div>
    </Container>
  );
}
