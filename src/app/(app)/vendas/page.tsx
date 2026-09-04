"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { brl, dateBR, todayISO, addDaysISO, downloadCSV, paymentLabel, SALE_STATUS } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { ViewToggle } from "@/components/ViewToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Sale = {
  id: string;
  data_venda: string;
  subtotal: number;
  desconto: number;
  total: number;
  status: string;
  observacoes: string | null;
  customers: { nome: string } | null;
  sale_items: { id: string; produto_nome: string; quantidade: number }[];
  sale_payments: { metodo: string; valor: number }[];
};

type DiaGroup = { data: string; vendas: Sale[]; total: number; count: number };

function agruparPorDia(vendas: Sale[]): DiaGroup[] {
  const map = new Map<string, Sale[]>();
  for (const v of vendas) {
    const arr = map.get(v.data_venda) ?? [];
    arr.push(v);
    map.set(v.data_venda, arr);
  }
  return [...map.entries()]
    .map(([data, vendas]) => ({
      data,
      vendas,
      total: vendas.reduce((s, v) => s + Number(v.total), 0),
      count: vendas.length,
    }))
    .sort((a, b) => b.data.localeCompare(a.data));
}

function statusVariant(status: string) {
  return status === "entregue" ? "secondary" : status === "pronto" ? "default" : "outline";
}

function DiaDetalheDialog({ dia, onClose }: { dia: DiaGroup | null; onClose: () => void }) {
  return (
    <Dialog open={!!dia} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Vendas de {dia ? dateBR(dia.data) : ""} — {dia?.count} pedido(s), {brl(dia?.total ?? 0)}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {dia?.vendas.map((v) => (
            <div key={v.id} className="surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{v.customers?.nome ?? "Cliente balcão"}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                  <span className="font-semibold">{brl(Number(v.total))}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {(v.sale_items ?? []).map((i) => `${i.quantidade}x ${i.produto_nome}`).join(", ") || "Sem itens"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pago:{" "}
                {(v.sale_payments ?? []).length === 0
                  ? "-"
                  : v.sale_payments.map((p) => `${paymentLabel[p.metodo] ?? p.metodo} ${brl(Number(p.valor))}`).join(" + ")}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VendaCard({ venda, onAvancar }: { venda: Sale; onAvancar: (id: string, status: string) => void }) {
  return (
    <div className="surface space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{venda.customers?.nome ?? "Cliente balcão"}</p>
        <span className="shrink-0 text-sm font-semibold">{brl(Number(venda.total))}</span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {(venda.sale_items ?? []).map((i) => `${i.quantidade}x ${i.produto_nome}`).join(", ") || "Sem itens"}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{dateBR(venda.data_venda)}</span>
        {venda.status !== "entregue" && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAvancar(venda.id, venda.status)}>
            {venda.status === "em preparo" ? "Marcar pronto" : "Marcar entregue"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function VendasPage() {
  const queryClient = useQueryClient();
  const hoje = todayISO();
  const [de, setDe] = useState(addDaysISO(hoje, -29));
  const [ate, setAte] = useState(hoje);
  const [status, setStatus] = useState<string>("todos");
  const [view, setView] = useState<"lista" | "kanban-status" | "kanban-dia">("lista");
  const [diaSelecionado, setDiaSelecionado] = useState<DiaGroup | null>(null);

  const { data: vendas, isLoading } = useQuery({
    queryKey: ["vendas-lista", de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, data_venda, subtotal, desconto, total, status, observacoes, customers(nome), sale_items(id, produto_nome, quantidade), sale_payments(metodo, valor)",
        )
        .gte("data_venda", de)
        .lte("data_venda", ate)
        .order("data_venda", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Sale[];
    },
  });

  const filtradas = (vendas ?? []).filter((v) => status === "todos" || v.status === status);
  const totalPeriodo = filtradas.reduce((s, v) => s + Number(v.total), 0);
  const porDia = useMemo(() => agruparPorDia(filtradas), [filtradas]);

  async function avancarStatus(id: string, atual: string) {
    const idx = SALE_STATUS.indexOf(atual as (typeof SALE_STATUS)[number]);
    const next = SALE_STATUS[Math.min(idx + 1, SALE_STATUS.length - 1)];
    const { error } = await supabase.from("sales").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Pedido marcado como ${next}`);
    queryClient.invalidateQueries({ queryKey: ["vendas-lista"] });
  }

  function exportar() {
    const rows: (string | number)[][] = [["Data", "Cliente", "Itens", "Subtotal", "Desconto", "Total", "Status", "Pagamentos"]];
    for (const v of filtradas) {
      rows.push([
        dateBR(v.data_venda),
        v.customers?.nome ?? "Cliente balcão",
        (v.sale_items ?? []).map((i) => `${i.quantidade}x ${i.produto_nome}`).join(" | "),
        Number(v.subtotal),
        Number(v.desconto),
        Number(v.total),
        v.status,
        (v.sale_payments ?? []).map((p) => `${paymentLabel[p.metodo] ?? p.metodo}: ${brl(Number(p.valor))}`).join(" | "),
      ]);
    }
    downloadCSV(`vendas_${de}_a_${ate}.csv`, rows);
  }

  return (
    <div>
      <PageHeader
        title="Vendas"
        subtitle={`${filtradas.length} pedido(s) · Total do período: ${brl(totalPeriodo)}`}
        actions={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="size-4" /> Exportar CSV
            </Button>
            <Button asChild>
              <Link href="/vendas/nova">
                <Plus className="size-4" /> Nova venda
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="surface flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {SALE_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            { value: "lista", label: "Lista" },
            { value: "kanban-status", label: "Kanban · status" },
            { value: "kanban-dia", label: "Kanban · dia" },
          ]}
        />
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : filtradas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda no período selecionado.</p>
      ) : view === "lista" ? (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Total do dia</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {porDia.map((dia) => (
                <TableRow key={dia.data}>
                  <TableCell className="whitespace-nowrap font-medium">{dateBR(dia.data)}</TableCell>
                  <TableCell className="text-right">{dia.count}</TableCell>
                  <TableCell className="text-right font-medium">{brl(dia.total)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setDiaSelecionado(dia)}>
                      <Eye className="size-3.5" /> Visualizar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : view === "kanban-status" ? (
        <div className="grid gap-4 md:grid-cols-3">
          {SALE_STATUS.map((s) => {
            const doStatus = filtradas.filter((v) => v.status === s);
            return (
              <div key={s} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold capitalize">{s}</h2>
                  <Badge variant="outline">{doStatus.length}</Badge>
                </div>
                <div className="space-y-2">
                  {doStatus.length === 0 ? (
                    <p className="surface p-3 text-center text-xs text-muted-foreground">Nenhum pedido</p>
                  ) : (
                    doStatus.map((v) => <VendaCard key={v.id} venda={v} onAvancar={avancarStatus} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {porDia.map((dia) => (
            <div key={dia.data} className="w-64 shrink-0 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{dateBR(dia.data)}</h2>
                <Badge variant="outline">{brl(dia.total)}</Badge>
              </div>
              <div className="space-y-2">
                {dia.vendas.map((v) => (
                  <VendaCard key={v.id} venda={v} onAvancar={avancarStatus} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <DiaDetalheDialog dia={diaSelecionado} onClose={() => setDiaSelecionado(null)} />
    </div>
  );
}
