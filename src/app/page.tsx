import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Users, Gift, Wallet, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Bebigás CRM — Controle de vendas do depósito",
  description:
    "Sistema de vendas do Bebigás: PDV rápido, carteira de clientes, programa de fidelidade e controle de lucro.",
  openGraph: {
    title: "Bebigás CRM — Controle de vendas do depósito",
    description: "PDV rápido, clientes, fidelidade e financeiro em um só lugar para o Bebigás.",
  },
};

const DESTAQUES = [
  {
    icon: ShoppingCart,
    title: "PDV em poucos cliques",
    desc: "Registre os pedidos do fim de semana com status de preparo, do balcão até a entrega.",
  },
  {
    icon: Users,
    title: "Carteira de clientes",
    desc: "Histórico de compras, ticket médio e quem volta sempre — na ponta do dedo.",
  },
  { icon: Gift, title: "Fidelidade por pontos", desc: "Pontos por real gasto e resgates configuráveis." },
  { icon: Wallet, title: "Lucro de verdade", desc: "Faturamento, despesas, custo de produção e margem por item." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Image src="/logo-bebigas.png" alt="Bebigás" width={1624} height={363} priority className="h-8 w-auto" />
        <Button asChild variant="outline">
          <Link href="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <section className="border-b py-14 md:py-20">
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            O sábado corrido do Bebigás, sob controle.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Venda rápido no balcão, acompanhe cada cliente, premie quem volta sempre e saiba exatamente
            quanto sobrou no fim do fim de semana.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/auth">
                Acessar o sistema <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-x-10 gap-y-8 py-14 md:grid-cols-2 md:py-20">
          {DESTAQUES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <f.icon className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <h2 className="font-medium">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
