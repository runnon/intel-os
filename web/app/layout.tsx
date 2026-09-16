import type { Metadata } from "next";
import { Oswald, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Oswald({ variable: "--font-display", subsets: ["latin"] });
const ui = Space_Grotesk({ variable: "--font-ui", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Theater Picture",
  description:
    "Live, filterable geospatial picture of a theater from open sources — exportable as a briefable sheet. Not an official government product.",
};

// MARK-1/MARK-2: banner on every surface — marking convention plus the
// not-official / open-sources-only statement. MARK-3: no seals, no agency
// branding anywhere in this tree.
function Banner() {
  return (
    <div className="bg-[#1a4a2e] text-[#d8efe0] text-center text-[11px] tracking-[0.25em] font-mono py-1 select-none shrink-0">
      UNCLASSIFIED&ensp;·&ensp;OPEN SOURCES ONLY&ensp;·&ensp;NOT AN OFFICIAL
      GOVERNMENT PRODUCT
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} h-full antialiased`}
    >
      <body className="h-dvh flex flex-col bg-[#000057] text-[#f2f2f2]">
        <Banner />
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        <Banner />
      </body>
    </html>
  );
}
