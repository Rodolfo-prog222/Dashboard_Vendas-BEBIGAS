"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const SUBNAV = [
  { to: "/produtos", label: "Produtos" },
  { to: "/produtos/estoque", label: "Estoque" },
  { to: "/produtos/compras", label: "Compras" },
  { to: "/produtos/ficha-tecnica", label: "Ficha técnica" },
  { to: "/produtos/producao", label: "Produção" },
];

export default function ProdutosLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="surface mb-5 inline-flex flex-wrap gap-1 p-1">
        {SUBNAV.map((item) => {
          const active = item.to === "/produtos" ? pathname === "/produtos" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
