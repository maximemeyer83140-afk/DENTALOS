import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "DentalOS",
  description: "Le système d'exploitation du cabinet dentaire suisse.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
