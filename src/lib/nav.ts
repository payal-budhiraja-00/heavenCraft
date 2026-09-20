import { groups } from "./catalog";
import type { NavGroup } from "@/components/site-header";
import type { FooterGroup } from "@/components/site-footer";

/**
 * Trims the catalog down to just what the chrome needs to draw itself. The
 * header is a client component, so anything handed to it crosses into the
 * browser bundle -- this keeps that payload to names, hrefs and counts.
 */
export function navGroups(): NavGroup[] {
  return groups.map((group) => ({
    slug: group.slug,
    name: group.name,
    href: group.href,
    subCategories: group.subCategories.map((sub) => ({
      slug: sub.slug,
      name: sub.name,
      href: sub.href,
      count: sub.products.length,
    })),
  }));
}

export function footerGroups(): FooterGroup[] {
  return groups.map((group) => ({
    slug: group.slug,
    name: group.name,
    href: group.href,
    subCategories: group.subCategories.map((sub) => ({
      slug: sub.slug,
      name: sub.name,
      href: sub.href,
    })),
  }));
}
