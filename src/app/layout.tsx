import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "InsMobile · Inspeksi K3RS",
    template: "%s · InsMobile",
  },
  description:
    "InsMobile — sistem inspeksi mobile K3RS RSUD dr. Achmad Darwis. Formulir lingkungan kerja, kondisi APAR, dan sarana tanggap darurat.",
};

export const viewport: Viewport = {
  themeColor: "#14261c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body
        className={`${barlowCondensed.variable} ${publicSans.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
