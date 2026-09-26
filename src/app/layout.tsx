import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { CartDrawer } from "@/components/cart-drawer";
import { PromoBanner } from "@/components/promo-banner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { footerGroups, navGroups } from "@/lib/nav";
import { promoMessages } from "@/lib/promo";
import { SITE, absoluteUrl } from "@/lib/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import "./globals.css";

/*
 * Self-hosted at build time by next/font, so there is no request to Google on
 * page load and no font-swap flash. The variable width axis is what the
 * display type is stretched with, so the whole family is one download.
 */
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  axes: ["wdth"],
});

/*
 * The city is in the homepage title deliberately. HeavenCraft cannot outrank
 * Featherlite, Godrej or Amazon for "ergonomic furniture" nationally, but
 * local intent -- "ergonomic chair delhi" -- is winnable, and the title is
 * the strongest on-page signal available for it. Keyword leads, brand
 * follows, matching the `%s | HeavenCraft` template used everywhere else.
 *
 * Declared once because Next does not derive openGraph or twitter titles
 * from `title`; three separate copies would drift apart.
 */
const HOME_TITLE = `Ergonomic Chairs & Desks in Delhi | ${SITE.name}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: HOME_TITLE,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  /*
   * Declared explicitly rather than left to file-convention detection. Google
   * needs the favicon URL to stay stable between crawls, and a hashed asset
   * filename would change it on every deploy.
   */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_IN",
    url: SITE.origin,
    title: HOME_TITLE,
    description: SITE.description,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE.name} — ergonomic workspace furniture`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: SITE.description,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#070706",
  colorScheme: "dark" as const,
};

/**
 * FurnitureStore, which is a LocalBusiness, which is an Organization -- so
 * one node carries the brand entity and the storefront at once.
 *
 * This was deliberately held at bare `Organization` until there was a street
 * address and a phone number to put in it, because a storefront claim Google
 * cannot verify is worse than no claim. Both landed, along with a confirmed
 * walk-in showroom, so the narrower type is now the honest one: it is what
 * makes the business eligible for the map pack rather than a service-area
 * listing, and `openingHoursSpecification` is what produces "Open now".
 *
 * Still no `aggregateRating`. The ratings in the source data are seeded demo
 * content, and emitting them would be a search-policy breach rather than an
 * exaggeration. Real reviews replace them or nothing does.
 *
 * No `geo` either: coordinates have to be measured, not guessed from an
 * address, and a wrong pin sends a delivery van to the wrong street.
 */
const businessSchema = {
  "@context": "https://schema.org",
  "@type": "FurnitureStore",
  "@id": `${SITE.origin}/#business`,
  name: SITE.name,
  legalName: SITE.legalName,
  url: SITE.origin,
  logo: absoluteUrl("/icons/icon-512.png"),
  image: absoluteUrl("/og/default.jpg"),
  email: SITE.email,
  telephone: SITE.phone,
  description: SITE.description,
  address: {
    "@type": "PostalAddress",
    streetAddress: SITE.street,
    addressLocality: SITE.city,
    addressRegion: SITE.region,
    postalCode: SITE.postalCode,
    addressCountry: SITE.country,
  },
  openingHoursSpecification: SITE.openingHours.map((block) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [...block.days],
    opens: block.opens,
    closes: block.closes,
  })),
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    telephone: SITE.phone,
    email: SITE.email,
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
  },
  sameAs: [...SITE.sameAs],
  // Pan-India delivery from a single Delhi showroom.
  areaServed: { "@type": "Country", name: "India" },
  currenciesAccepted: "INR",
  paymentAccepted: "Cash on Delivery, UPI, Credit Card, Debit Card, Net Banking",
  priceRange: "₹₹",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={archivo.variable}>
      <head>
        {/*
          Runs before first paint so a strip dismissed earlier in this session
          is hidden by CSS rather than removed by React a moment later, which
          would shove the whole page up as it went. Tiny, synchronous and
          wrapped because Safari throws on storage access in private mode.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("hc-promo")==="off")document.documentElement.dataset.promo="off"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-base antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-plate focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-base"
        >
          Skip to content
        </a>

        {/*
          The provider wraps header and page together because the basket count
          lives in one and the add-to-basket button in the other. While the
          preview gate is closed it renders its children and does nothing else
          -- no storage, no Shopify calls.
        */}
        <CartProvider>
          <PromoBanner messages={promoMessages()} />
          <SiteHeader groups={navGroups()} />
          <main id="main">{children}</main>
          <SiteFooter groups={footerGroups()} />
          <CartDrawer />
        </CartProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(businessSchema),
          }}
        />
      </body>
    </html>
  );
}
