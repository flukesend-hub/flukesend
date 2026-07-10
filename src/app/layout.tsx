import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Inter for the interface, Fraunces for the warm display headings. These match
// the mockup and feed the CSS variables used in globals.css.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.flukesend.com"),
  title: "Flukesend",
  description:
    "Branded photo delivery and review engine for whale watch operators.",
  openGraph: {
    type: "website",
    siteName: "Flukesend",
    title: "Flukesend - branded photo galleries that turn into reviews",
    description:
      "Branded photo delivery and review engine for whale watch operators. Guests scan a QR aboard, photos land in their camera roll, reviews roll in.",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "Flukesend: photo galleries that turn into reviews",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flukesend - branded photo galleries that turn into reviews",
    description:
      "Branded photo delivery and review engine for whale watch operators.",
    images: ["/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        {children}
        {/* Anonymous, cookieless page view counting (Vercel Web Analytics).
            Only reports from production deployments. */}
        <Analytics />
      </body>
    </html>
  );
}
