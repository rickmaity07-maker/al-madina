import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Al-Madina | Turkish & Mediterranean Grocery",
    template: "%s | Al-Madina",
  },
  description: "Fresh Turkish & Mediterranean groceries in Schweinfurt — order online for cash-on-delivery or in-store pickup.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Al-Madina | Turkish & Mediterranean Grocery",
    description: "Fresh Turkish & Mediterranean groceries in Schweinfurt — order online for cash-on-delivery or in-store pickup.",
    siteName: "Al-Madina Markt",
    locale: "de_DE",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a12e3d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
