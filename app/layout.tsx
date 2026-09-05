import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al-Madina | Turkish & Mediterranean Grocery",
  description: "A polished ecommerce storefront mockup for Al-Madina in Schweinfurt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
