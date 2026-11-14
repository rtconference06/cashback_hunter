import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Cashback Hunter",
    template: "%s · Cashback Hunter",
  },
  description: "A personal shopping desk that ranks Rakuten deals for the people you buy for.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} h-full`}>
      <body className="min-h-full bg-white font-sans antialiased">
        <Suspense fallback={<div className="h-16 border-b border-[#DDDDDD] bg-white" />}>
          <SiteHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
