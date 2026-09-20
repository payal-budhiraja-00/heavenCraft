import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Breadcrumbs, Container } from "@/components/ui";
import { SITE, absoluteUrl } from "@/lib/site";

const description =
  "Get in touch about a product, a bulk order, or fitting out an office. We reply within one working day.";

export const metadata: Metadata = {
  title: "Contact",
  description,
  alternates: { canonical: "/contact/" },
  openGraph: {
    title: `Contact | ${SITE.name}`,
    description,
    url: absoluteUrl("/contact/"),
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <Container className="py-14 lg:py-20">
      <Breadcrumbs
        trail={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      <div className="mt-8 grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <div>
          <h1 className="type-wide text-display-2 font-bold text-cream">
            Talk to us
          </h1>
          <span className="rule-gold mt-5" />
          <p className="mt-5 text-reading text-cream-muted">
            Questions about a product, a bulk order, or a whole floor to fit
            out — all go to the same inbox and all get answered.
          </p>

          <dl className="mt-10 space-y-6 border-t border-edge pt-8">
            <div>
              <dt className="label text-cream-faint">Email</dt>
              <dd className="mt-1.5">
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-gold transition-colors hover:text-gold-bright"
                >
                  {SITE.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="label text-cream-faint">Response time</dt>
              <dd className="mt-1.5 text-sm text-cream-muted">
                Usually the same working day.
              </dd>
            </div>
            <div>
              <dt className="label text-cream-faint">Delivery</dt>
              <dd className="mt-1.5 text-sm text-cream-muted">
                Across India. Send your pincode and we will confirm what it
                costs and how long it takes.
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-panel border border-edge bg-surface p-7 sm:p-9">
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}
