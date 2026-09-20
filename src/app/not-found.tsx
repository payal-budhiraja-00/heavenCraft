import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { groups } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Page not found",
  alternates: { canonical: null },
  robots: { index: false, follow: true },
};

/**
 * Exported as `out/404.html` and wired up by `ErrorDocument 404` in .htaccess.
 *
 * It matters more here than on most sites: the old site addressed products as
 * /product/<id> and categories as client-side routes, so anything Google has
 * indexed but the redirect map missed lands on this page. It therefore offers
 * the whole catalog rather than an apology.
 */
export default function NotFound() {
  return (
    <Container className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <span className="label text-gold">404</span>
        <h1 className="type-wide mt-4 text-display-2 font-bold text-cream">
          That page has moved
        </h1>
        <span className="rule-gold mt-5" />
        <p className="mt-5 text-reading text-cream-muted">
          We rebuilt this site and some addresses changed. Everything is still
          here — start from a category below, or go back to the homepage.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-plate bg-gold px-6 py-3 text-sm font-semibold text-base transition-colors hover:bg-gold-bright"
          >
            Back to homepage
          </Link>
          <Link
            href="/contact/"
            className="inline-flex items-center rounded-plate border border-edge-strong bg-raised px-6 py-3 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold"
          >
            Ask us where it went
          </Link>
        </div>
      </div>

      <div className="mt-20 grid gap-10 border-t border-edge pt-14 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.slug}>
            <h2 className="type-wide text-lg font-bold text-cream">
              <Link href={group.href} className="transition-colors hover:text-gold">
                {group.name}
              </Link>
            </h2>
            <ul className="mt-4 space-y-1">
              {group.subCategories.map((sub) => (
                <li key={sub.slug}>
                  <Link
                    href={sub.href}
                    className="block border-b border-edge py-2.5 text-sm text-cream-muted transition-colors hover:text-gold"
                  >
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Container>
  );
}
