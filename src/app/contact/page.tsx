import { ContactForm } from "@/components/contact-form";
import { Breadcrumbs, Container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";
import { SITE, TERMS, whatsappUrl } from "@/lib/site";

const description = `Call or WhatsApp ${SITE.phoneDisplay}, or visit our Hari Nagar showroom in New Delhi. Ergonomic chairs, desks and accessories, delivered across India.`;

export const metadata = pageMetadata({
  title: "Contact & Showroom, New Delhi",
  description,
  path: "/contact/",
});

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
              <dt className="label text-cream-faint">Phone &amp; WhatsApp</dt>
              {/*
                The two fastest routes made into real controls rather than
                links inside a sentence. This is the page someone opens with
                the explicit intent of making contact, and on a phone the
                inline links were a ~20px-tall target -- small enough to miss,
                on the one page where missing costs the enquiry.
              */}
              <dd className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={`tel:${SITE.phone}`}
                  className="flex min-h-11 items-center justify-center rounded-plate bg-gold px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold-bright"
                >
                  Call {SITE.phoneDisplay}
                </a>
                <a
                  href={whatsappUrl(
                    `Hi ${SITE.name}, I have a question about your furniture.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center rounded-plate border border-edge-strong px-5 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold"
                >
                  Message on WhatsApp
                </a>
              </dd>
              <p className="mt-2.5 text-sm text-cream-muted">
                {SITE.hoursSummary}.
              </p>
            </div>
            <div>
              <dt className="label text-cream-faint">Email</dt>
              <dd className="mt-0.5">
                <a
                  href={`mailto:${SITE.email}`}
                  className="inline-block py-2 text-gold transition-colors hover:text-gold-bright"
                >
                  {SITE.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="label text-cream-faint">Showroom</dt>
              <dd className="mt-1.5 text-sm text-cream-muted">
                <address className="not-italic leading-relaxed">
                  {SITE.street}
                  <br />
                  {SITE.city} {SITE.postalCode}
                </address>
                <span className="mt-1.5 block">
                  {SITE.hoursSummary}. Come and sit in the chairs before you buy
                  one.
                </span>
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
                Across India, typically {TERMS.deliveryDaysMin}–
                {TERMS.deliveryDaysMax} working days. Cash on delivery is
                available, and assembly at your address is included on tables.
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
