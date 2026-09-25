import type { MetadataRoute } from "next";
import { allProducts, groups } from "@/lib/catalog";
import { POLICIES } from "@/lib/policies";
import { absoluteUrl } from "@/lib/site";

/**
 * Generated from the catalog, so a product added to products.json is in the
 * sitemap the moment it is in the build. Priorities are relative rather than
 * absolute -- Google treats them as a hint about this site's own hierarchy.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/about/"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: absoluteUrl("/contact/"), lastModified: now, changeFrequency: "yearly", priority: 0.6 },
  ];

  const groupPages: MetadataRoute.Sitemap = groups.map((group) => ({
    url: absoluteUrl(group.href),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  // Collapsed ranges share their URL with their only product, which the
  // product entry below already lists. Emitting both would put a duplicate
  // <loc> in the sitemap.
  const subPages: MetadataRoute.Sitemap = groups.flatMap((group) =>
    group.subCategories
      .filter((sub) => !sub.collapsed)
      .map((sub) => ({
        url: absoluteUrl(sub.href),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  );

  const productPages: MetadataRoute.Sitemap = allProducts.map((product) => ({
    url: absoluteUrl(product.href),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const policyPages: MetadataRoute.Sitemap = POLICIES.map((policy) => ({
    url: absoluteUrl(`/policies/${policy.slug}/`),
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.3,
  }));

  return [
    ...staticPages,
    ...groupPages,
    ...subPages,
    ...productPages,
    ...policyPages,
  ];
}
