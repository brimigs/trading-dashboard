import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Wallet Trade Dashboard",
  description: "Track swap activity and holdings for a specific Solana wallet.",
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
