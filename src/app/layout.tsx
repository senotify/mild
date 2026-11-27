import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/format";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: "Mild is an open platform where anyone can read and write stories about tech, backend engineering, AI and more.",
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": `${SITE_URL}/feed.xml` } },
  // Google Search Console ownership proof (public by design).
  verification: { google: "9z-ZvqE1LNOtubN4gunl0kbNQLyJ_lPCRMbtp1sMUfY" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

// Runs before paint: the saved choice wins, otherwise follow the OS.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("mild-theme");}catch(e){}if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Umami analytics (stats.senotify.com): cookieless; data-domains keeps local development out. */}
        <script
          defer
          src="https://stats.senotify.com/script.js"
          data-website-id="180197f1-9c2a-465b-b7a8-4f177d1bffeb"
          data-domains="mild.senotify.com"
        />
      </head>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
