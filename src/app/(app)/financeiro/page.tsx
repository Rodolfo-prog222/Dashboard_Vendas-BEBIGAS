"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { brl, dateBR, downloadCSV, todayISO, addDaysISO, weekdayName } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORIAS_DESPESA = ["insumos", "gás", "embalagens", "mão de obra", "manutenção", "outros"];

function NovaDespesaDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ descricao: "", categoria: "insumos", valor: "", data: todayISO() });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) return toast.error("Preencha descrição e valor.");
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor: Number(form.valor),
      data: form.data,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Despesa lançada.");
    setForm({ descricao: "", categoria: "insumos", valor: "", data: todayISO() });
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nova despesa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova despesa</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_DESPESA.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FinanceiroPage() {
  const { data: me } = useMe();
  const isAdmin = !!me?.isAdmin;
  const queryClient = useQueryClient();
  const hoje = todayISO();
  const [de, setDe] = useState(addDaysISO(hoje, -29));
  const [ate, setAte] = useState(hoje);

  const { data: vendas } = useQuery({
    queryKey: ["financeiro-vendas", de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("data_venda, total, custo_total")
        .gte("data_venda", de)
        .lte("data_venda", ate);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: despesas } = useQuery({
    queryKey: ["financeiro-despesas", de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").gte("data", de).lte("data", ate).order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const faturamento = (vendas ?? []).reduce((s, v) => s + Number(v.total), 0);
  const custoProdutos = (vendas ?? []).reduce((s, v) => s + Number(v.custo_total), 0);
  const totalDespesas = (despesas ?? []).reduce((s, d) => s + Number(d.valor), 0);
  const lucro = faturamento - custoProdutos - totalDespesas;
  const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

  const porDia = Object.entries(
    (vendas ?? []).reduce<Record<string, number>>((acc, v) => {
      acc[v.data_venda] = (acc[v.data_venda] ?? 0) + Number(v.total);
      return acc;
    }, {}),
  )
    .map(([data, total]) => ({ data, dia: weekdayName(data).slice(0, 3), total }))
    .sort((a, b) => a.data.localeCompare(b.data));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["financeiro-despesas"] });
  }

  async function excluirDespesa(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  function exportar() {
    const rows: (string | number)[][] = [["Data", "Descrição", "Categoria", "Valor"]];
    for (const d of despesas ?? []) rows.push([dateBR(d.data), d.descricao, d.categoria, Number(d.valor)]);
    downloadCSV(`despesas_${de}_a_${ate}.csv`, rows);
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Financeiro" subtitle="Gastos, ganhos e lucro" />
        <div className="surface flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem ver os relatórios financeiros.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Gastos, ganhos e lucro"
        actions={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="size-4" /> Exportar despesas
            </Button>
            <NovaDespesaDialog onSaved={refresh} />
          </>
        }
      />

      <div className="surface mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Até</label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faturamento</p>
          <p className="mt-2 text-2xl font-bold">{brl(faturamento)}</p>
        </div>
        <div className="surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custo produtos + despesas</p>
          <p className="mt-2 text-2xl font-bold">{brl(custoProdutos + totalDespesas)}</p>
        </div>
        <div className="surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lucro líquido</p>
          <p className={`mt-2 text-2xl font-bold ${lucro >= 0 ? "text-primary-deep" : "text-destructive"}`}>{brl(lucro)}</p>
        </div>
        <div className="surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margem</p>
          <p className="mt-2 text-2xl font-bold">{margem.toFixed(1)}%</p>
        </div>
      </div>

      <div className="surface mt-4 p-5">
        <h2 className="mb-3 font-semibold">Faturamento por dia</h2>
        {porDia.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vendas no período selecionado.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => brl(v)} width={80} />
                <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(_, p) => (p?.[0] ? dateBR(p[0].payload.data) : "")} />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="surface mt-4 overflow-x-auto">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="font-semibold">Despesas do período</h2>
          <span className="text-sm text-muted-foreground">Total: {brl(totalDespesas)}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(despesas ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhuma despesa lançada no período.
                </TableCell>
              </TableRow>
            ) : (
              (despesas ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap">{dateBR(d.data)}</TableCell>
                  <TableCell>{d.descricao}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{d.categoria}</TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(d.valor))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => excluirDespesa(d.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
