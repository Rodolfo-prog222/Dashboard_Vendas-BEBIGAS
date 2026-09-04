import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Bebigás CRM",
  description: "CRM de vendas do Bebigás: PDV, clientes, fidelidade e financeiro.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Bebigás CRM",
    description: "CRM de vendas do Bebigás: PDV, clientes, fidelidade e financeiro.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
