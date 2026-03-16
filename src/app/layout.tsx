import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Vox — Ask Your Data Anything",
  description:
    "Connect your PostgreSQL database and ask questions in plain English. AI-powered SQL generation, real-time streaming, and instant visualizations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${nunito.variable}`} suppressHydrationWarning>
      <body className="antialiased">

        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
