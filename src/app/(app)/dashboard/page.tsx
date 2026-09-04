"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cake, Gift, Plus, ShoppingCart, TrendingUp, Wallet, PiggyBank, Repeat, UserPlus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, Area, AreaChart } from "recharts";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { useLoyaltyBalances, useLoyaltySettings } from "@/lib/loyalty";
import { brl, dateBR, todayISO, addDaysISO, SALE_STATUS } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof TrendingUp;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground/70" />
      </div>
      <p
        className={
          "mt-2 text-xl font-semibold tabular-nums tracking-tight " +
          (tone === "positive" ? "text-accent" : tone === "negative" ? "text-destructive" : "")
        }
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const topClientesConfig = {
  total: { label: "Total gasto", color: "var(--chart-1)" },
} satisfies ChartConfig;

const novosClientesConfig = {
  novos: { label: "Novos clientes", color: "var(--chart-2)" },
} satisfies ChartConfig;

export default function Dashboard() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const hoje = todayISO();
  const mesInicio = `${hoje.slice(0, 8)}01`;
  const inicioPeriodo = addDaysISO(hoje, -89);
  const mesNome = MESES[new Date(`${hoje}T12:00:00`).getMonth()];

  const { data: vendasMes } = useQuery({
    queryKey: ["dashboard-sales-mes", mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, data_venda, total, custo_total, status, customer_id, created_at, customers(nome)")
        .gte("data_venda", mesInicio)
        .lte("data_venda", hoje)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: despesasMes } = useQuery({
    queryKey: ["dashboard-despesas-mes", mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("valor").gte("data", mesInicio).lte("data", hoje);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["dashboard-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, nome, telefone, nascimento, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vendasTodasCustomerIds } = useQuery({
    queryKey: ["dashboard-sales-customer-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("customer_id").not("customer_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vendasPeriodo } = useQuery({
    queryKey: ["dashboard-sales-periodo", inicioPeriodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("customer_id, total, customers(nome)")
        .gte("data_venda", inicioPeriodo)
        .not("customer_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: settings } = useLoyaltySettings();
  const { data: balances } = useLoyaltyBalances();

  const faturamentoMes = (vendasMes ?? []).reduce((s, v) => s + Number(v.total), 0);
  const custoProdutosMes = (vendasMes ?? []).reduce((s, v) => s + Number(v.custo_total), 0);
  const totalDespesasMes = (despesasMes ?? []).reduce((s, d) => s + Number(d.valor), 0);
  const custosMes = custoProdutosMes + totalDespesasMes;
  const lucroMes = faturamentoMes - custosMes;

  const abertos = (vendasMes ?? []).filter((v) => v.status !== "entregue");

  const novosClientesMes = (clientes ?? []).filter((c) => (c.created_at?.slice(0, 10) ?? "") >= mesInicio).length;

  const recorrenciaCount = useMemo(() => {
    const porCliente = new Map<string, number>();
    for (const v of vendasTodasCustomerIds ?? []) {
      if (!v.customer_id) continue;
      porCliente.set(v.customer_id, (porCliente.get(v.customer_id) ?? 0) + 1);
    }
    return [...porCliente.values()].filter((n) => n >= 2).length;
  }, [vendasTodasCustomerIds]);

  const aniversariantes = (clientes ?? []).filter((c) => {
    if (!c.nascimento) return false;
    const md = c.nascimento.slice(5);
    for (let i = 0; i < 7; i++) {
      if (addDaysISO(hoje, i).slice(5) === md) return true;
    }
    return false;
  });

  const prontosResgate = (clientes ?? [])
    .map((c) => ({ ...c, pontos: balances?.[c.id] ?? 0 }))
    .filter((c) => settings && c.pontos >= settings.pontos_para_resgate)
    .sort((a, b) => b.pontos - a.pontos);

  const topClientes = useMemo(() => {
    const porCliente = new Map<string, { nome: string; total: number }>();
    for (const v of vendasPeriodo ?? []) {
      if (!v.customer_id) continue;
      const nome = (v.customers as { nome: string } | null)?.nome ?? "Cliente";
      const atual = porCliente.get(v.customer_id) ?? { nome, total: 0 };
      atual.total += Number(v.total);
      porCliente.set(v.customer_id, atual);
    }
    return [...porCliente.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 7)
      .reverse(); // barra horizontal: maior no topo
  }, [vendasPeriodo]);

  const novosClientesPorSemana = useMemo(() => {
    const semanas = Array.from({ length: 10 }, (_, i) => addDaysISO(hoje, -7 * (9 - i)));
    return semanas.map((inicio) => {
      const fim = addDaysISO(inicio, 6);
      const novos = (clientes ?? []).filter((c) => {
        const criado = c.created_at?.slice(0, 10);
        return criado && criado >= inicio && criado <= fim;
      }).length;
      return { semana: dateBR(inicio).slice(0, 5), novos };
    });
  }, [clientes, hoje]);

  async function avancarStatus(id: string, status: string) {
    const idx = SALE_STATUS.indexOf(status as (typeof SALE_STATUS)[number]);
    const next = SALE_STATUS[Math.min(idx + 1, SALE_STATUS.length - 1)];
    const { error } = await supabase.from("sales").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Pedido marcado como ${next}`);
    queryClient.invalidateQueries({ queryKey: ["dashboard-sales-mes"] });
  }

  return (
    <div>
      <PageHeader
        title={`Olá, ${me?.nome ?? ""}`}
        subtitle={`${mesNome} · movimento do mês até hoje (${dateBR(hoje)})`}
        actions={
          <>
            <Button asChild>
              <Link href="/vendas/nova">
                <ShoppingCart className="size-4" /> Nova venda
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/clientes">
                <Plus className="size-4" /> Novo cliente
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Vendas" value={brl(faturamentoMes)} hint={`${(vendasMes ?? []).length} pedido(s) no mês`} icon={TrendingUp} />
        <StatCard label="Custos" value={brl(custosMes)} hint="Produtos + despesas do mês" icon={Wallet} />
        <StatCard
          label="Lucro"
          value={brl(lucroMes)}
          hint={faturamentoMes > 0 ? `${((lucroMes / faturamentoMes) * 100).toFixed(0)}% de margem` : undefined}
          icon={PiggyBank}
          tone={lucroMes >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Recorrência" value={String(recorrenciaCount)} hint="Clientes com 2+ compras" icon={Repeat} />
        <StatCard label="Novos clientes" value={String(novosClientesMes)} hint={`Cadastrados em ${mesNome.toLowerCase()}`} icon={UserPlus} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="surface p-5">
          <h2 className="font-semibold">Clientes que mais compram</h2>
          <p className="text-xs text-muted-foreground">Total gasto nos últimos 90 dias</p>
          {topClientes.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Sem vendas com cliente identificado ainda.</p>
          ) : (
            <ChartContainer config={topClientesConfig} className="mt-3 aspect-auto h-64 w-full">
              <BarChart data={topClientes} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => brl(Number(v))} />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} barSize={14}>
                  <LabelList dataKey="total" position="right" formatter={(v: number) => brl(v)} className="fill-foreground text-[11px]" />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="surface p-5">
          <h2 className="font-semibold">Novos clientes</h2>
          <p className="text-xs text-muted-foreground">Cadastros por semana, últimas 10 semanas</p>
          <ChartContainer config={novosClientesConfig} className="mt-3 aspect-auto h-64 w-full">
            <AreaChart data={novosClientesPorSemana} margin={{ left: 0, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="novosClientesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-novos)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-novos)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="semana" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={1} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} tick={{ fontSize: 11 }} />
              <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="novos"
                stroke="var(--color-novos)"
                strokeWidth={2}
                fill="url(#novosClientesFill)"
                dot={{ r: 3, fill: "var(--color-novos)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="font-semibold">Pedidos em aberto</h2>
          {abertos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido pendente. Tudo entregue!</p>
          ) : (
            <ul className="mt-3 divide-y">
              {abertos.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {(v.customers as { nome: string } | null)?.nome ?? "Cliente balcão"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dateBR(v.data_venda)} · {brl(Number(v.total))}
                    </p>
                  </div>
                  <Badge variant={v.status === "pronto" ? "default" : "secondary"}>{v.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => avancarStatus(v.id, v.status)}>
                    {v.status === "em preparo" ? "Marcar pronto" : "Marcar entregue"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="surface p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Cake className="size-4 text-accent" /> Aniversariantes da semana
            </h2>
            {aniversariantes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum aniversário nos próximos 7 dias.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {aniversariantes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/clientes/${c.id}`} className="truncate font-medium hover:underline">
                      {c.nome}
                    </Link>
                    <span className="text-muted-foreground">{dateBR(c.nascimento!).slice(0, 5)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="surface p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Gift className="size-4 text-accent" /> Prontos para resgate
            </h2>
            {prontosResgate.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente com pontos suficientes.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {prontosResgate.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/clientes/${c.id}`} className="truncate font-medium hover:underline">
                      {c.nome}
                    </Link>
                    <Badge variant="secondary">{c.pontos} pts</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
