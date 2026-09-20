import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { footerGroups, navGroups } from "@/lib/nav";
import { SITE, absoluteUrl } from "@/lib/site";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: `${SITE.name} — Ergonomic Chairs, Desks & Workspace Accessories`,
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
    title: `${SITE.name} — Ergonomic Chairs, Desks & Workspace Accessories`,
    description: SITE.description,
    images: [
      {
        url: "/og/default.png",
        width: 1200,
        height: 630,
        alt: `${SITE.name} — ergonomic workspace furniture`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Ergonomic Chairs, Desks & Workspace Accessories`,
    description: SITE.description,
    images: ["/og/default.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#070706",
  colorScheme: "dark" as const,
};

/**
 * Organization only. No `aggregateRating` anywhere on this site: the ratings
 * in the source data are seeded demo content, and emitting them as structured
 * data would be a search-policy breach, not just an exaggeration.
 */
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  legalName: SITE.legalName,
  url: SITE.origin,
  logo: absoluteUrl("/icons/icon-512.png"),
  email: SITE.email,
  description: SITE.description,
  areaServed: "IN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={archivo.variable}>
      <body className="min-h-dvh bg-base antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-plate focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-base"
        >
          Skip to content
        </a>

        <SiteHeader groups={navGroups()} />
        <main id="main">{children}</main>
        <SiteFooter groups={footerGroups()} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
      </body>
    </html>
  );
}
