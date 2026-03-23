import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Wallet Tracker",
  description:
    "Pink, image-first Solana wallet dashboard with neon visuals, allocation charts, and compact swap cards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
