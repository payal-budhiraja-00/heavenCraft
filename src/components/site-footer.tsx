import Link from "next/link";
import { SITE } from "@/lib/site";
import { Container } from "./ui";
import { Wordmark } from "./wordmark";

export type FooterGroup = {
  slug: string;
  name: string;
  href: string;
  subCategories: { slug: string; name: string; href: string }[];
};

const policies = [
  { label: "Shipping policy", href: "/policies/shipping/" },
  { label: "Returns & refunds", href: "/policies/returns/" },
  { label: "Privacy policy", href: "/policies/privacy/" },
  { label: "Terms of service", href: "/policies/terms/" },
  { label: "Warranty", href: "/policies/warranty/" },
];

export function SiteFooter({ groups }: { groups: FooterGroup[] }) {
  return (
    <footer className="mt-24 border-t border-edge bg-surface">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Wordmark size="lg" withTagline />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-cream-muted">
              Ergonomic seating, height-adjustable desks and the workspace
              hardware that goes with them — chosen for people who sit at a desk
              all day, not for a showroom floor.
            </p>
            <a
              href={`mailto:${SITE.email}`}
              className="mt-6 inline-block text-sm text-gold transition-colors hover:text-gold-bright"
            >
              {SITE.email}
            </a>
            <p className="mt-3 text-sm text-cream-muted">
              Based in {SITE.city} · Delivered across India
            </p>
          </div>

          {groups.map((group) => (
            <div key={group.slug}>
              <h2 className="label text-cream">{group.name}</h2>
              <ul className="mt-5 space-y-2.5">
                {group.subCategories.map((sub) => (
                  <li key={sub.slug}>
                    <Link
                      href={sub.href}
                      className="text-sm text-cream-muted transition-colors hover:text-gold"
                    >
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-edge pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-cream-faint">
            © {new Date().getFullYear()} {SITE.legalName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {policies.map((policy) => (
              <li key={policy.href}>
                <Link
                  href={policy.href}
                  className="text-xs text-cream-faint transition-colors hover:text-gold"
                >
                  {policy.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
