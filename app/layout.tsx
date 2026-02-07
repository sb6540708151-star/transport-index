import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transport Index",
  description: "Freight Rates Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}