import Link from "next/link";
import { Breadcrumbs, Container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";
import { REVIEW_LINK, SITE, whatsappUrl } from "@/lib/site";

const description =
  "Bought a chair, desk or accessory from HeavenCraft — online or at the Hari Nagar showroom? Tell us how it is working out.";

export const metadata = pageMetadata({
  title: "Write a review",
  description,
  path: "/write-a-review/",
});

/*
 * This page exists to be the target of a printed QR code and a link sent over
 * WhatsApp, which is why it lives on our own domain and not on Judge.me's.
 *
 * A QR code on a card in a carton cannot be edited once it is printed. Sending
 * it here means the review provider can be changed, or the link reissued,
 * without every card already in the field pointing at a dead URL.
 */
export default function WriteAReviewPage() {
  return (
    <Container className="py-14 lg:py-20">
      <Breadcrumbs
        trail={[{ label: "Home", href: "/" }, { label: "Write a review" }]}
      />

      <div className="mt-8 max-w-2xl">
        <h1 className="type-wide text-display-2 font-bold text-cream">
          How is it working out?
        </h1>
        <span className="rule-gold mt-5" />

        <div className="mt-8 space-y-5 text-reading leading-relaxed text-cream-muted">
          <p>
            If you bought something from us — through this site, over WhatsApp,
            or by walking into the showroom in Hari Nagar — we would like to
            hear how it has held up.
          </p>
          <p>
            A chair tells you most of what it is worth in the third month, not
            the first week. That is the part no product page can write for
            itself, and it is the part the next person is trying to find out.
          </p>
        </div>

        {REVIEW_LINK ? (
          <div className="mt-10">
            <a
              href={REVIEW_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-plate bg-gold px-6 py-3 text-sm font-semibold text-base transition-colors hover:bg-gold-bright"
            >
              Write a review
            </a>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream-faint">
              The form is hosted by Judge.me, who handle our reviews. It asks
              which product you bought and for your email address, so that a
              review can be traced to a real person.
            </p>
          </div>
        ) : (
          /*
           * Shown until the Judge.me link is pasted into REVIEW_LINK. It is a
           * working route rather than a placeholder: the shop can already take
           * a review over WhatsApp today, and a page that sends someone to a
           * real conversation is better than a button that goes nowhere.
           */
          <div className="mt-10">
            <a
              href={whatsappUrl(
                "Hello, I bought from HeavenCraft and would like to leave a review.",
              )}
              className="inline-flex min-h-11 items-center rounded-plate bg-gold px-6 py-3 text-sm font-semibold text-base transition-colors hover:bg-gold-bright"
            >
              Send us a message
            </a>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream-faint">
              Message us on WhatsApp and we will send you the review form.
            </p>
          </div>
        )}
      </div>

      <div className="mt-20 max-w-2xl border-t border-edge pt-14">
        <h2 className="type-wide text-xl font-bold text-cream">
          What happens to it
        </h2>
        <div className="mt-6 space-y-5 text-reading leading-relaxed text-cream-muted">
          <p>
            It goes onto the product page you are reviewing, next to the price
            and the specifications, where it is read by people deciding whether
            to buy the thing you just bought.
          </p>
          <p>
            We publish them as written. We do not edit a review to soften it
            and we do not drop one for being unflattering — a page where every
            chair has five stars tells a reader nothing, and they know it. The
            only things removed are spam, abuse, and anything that exposes
            someone&rsquo;s personal details.
          </p>
          <p>
            Judge.me may email you a confirmation link after you submit.
            Opening it confirms the review is genuinely yours, which helps us
            keep this page trustworthy. Not everyone is sent one, and your
            review is published either way.
          </p>
          <p>
            The site is rebuilt when reviews come in rather than loading them
            live, so there is a short wait before yours appears.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/chairs/"
            className="inline-flex min-h-11 items-center rounded-plate border border-edge-strong bg-raised px-6 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold"
          >
            Browse the range
          </Link>
          <a
            href={`mailto:${SITE.email}`}
            className="inline-flex min-h-11 items-center rounded-plate border border-edge-strong bg-raised px-6 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold"
          >
            Email us instead
          </a>
        </div>
      </div>
    </Container>
  );
}
