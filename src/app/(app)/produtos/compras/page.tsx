"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { brl, dateBR, num, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type RawMaterial = { id: string; nome: string; unidade: string };

type Purchase = {
  id: string;
  raw_material_id: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  fornecedor: string | null;
  data_compra: string;
  observacoes: string | null;
  raw_materials: { nome: string; unidade: string } | null;
};

function emptyForm() {
  return {
    raw_material_id: "",
    quantidade: "",
    preco_unitario: "",
    valor_total: "",
    fornecedor: "",
    data_compra: todayISO(),
    observacoes: "",
  };
}

function CompraDialog({ materiais, onSaved }: { materiais: RawMaterial[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [totalTocado, setTotalTocado] = useState(false);

  useEffect(() => {
    if (totalTocado) return;
    const q = Number(form.quantidade) || 0;
    const p = Number(form.preco_unitario) || 0;
    setForm((f) => ({ ...f, valor_total: q && p ? (q * p).toFixed(2) : f.valor_total }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.quantidade, form.preco_unitario]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.raw_material_id) return toast.error("Selecione a matéria-prima.");
    if (!form.quantidade || Number(form.quantidade) <= 0) return toast.error("Informe a quantidade comprada.");
    setSaving(true);
    const { error } = await supabase.from("purchases").insert({
      raw_material_id: form.raw_material_id,
      quantidade: Number(form.quantidade),
      preco_unitario: Number(form.preco_unitario) || 0,
      valor_total: Number(form.valor_total) || 0,
      fornecedor: form.fornecedor.trim() || null,
      data_compra: form.data_compra,
      observacoes: form.observacoes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Compra registrada — estoque atualizado.");
    setOpen(false);
    setForm(emptyForm());
    setTotalTocado(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={materiais.length === 0}>
          <Plus className="size-4" /> Nova compra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova compra</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Matéria-prima</Label>
            <Select value={form.raw_material_id} onValueChange={(v) => setForm((f) => ({ ...f, raw_material_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {materiais.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} ({m.unidade})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={0}
                step="0.001"
                value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço unit. (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.preco_unitario}
                onChange={(e) => setForm((f) => ({ ...f, preco_unitario: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.valor_total}
                onChange={(e) => {
                  setTotalTocado(true);
                  setForm((f) => ({ ...f, valor_total: e.target.value }));
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input value={form.fornecedor} onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data da compra</Label>
              <Input
                type="date"
                value={form.data_compra}
                onChange={(e) => setForm((f) => ({ ...f, data_compra: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Registrar compra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ComprasPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const { data: materiais } = useQuery({
    queryKey: ["materiais-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, nome, unidade")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as RawMaterial[];
    },
  });

  const { data: compras, isLoading } = useQuery({
    queryKey: ["compras-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, raw_materials(nome, unidade)")
        .order("data_compra", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Purchase[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["compras-lista"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-lista"] });
    queryClient.invalidateQueries({ queryKey: ["materiais-ativos"] });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta compra? O estoque já somado NÃO será revertido automaticamente — ajuste manualmente em Estoque se necessário."))
      return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Compra excluída.");
    refresh();
  }

  const isAdmin = !!me?.isAdmin;

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle="Entradas de matéria-prima no estoque"
        actions={isAdmin ? <CompraDialog materiais={materiais ?? []} onSaved={refresh} /> : undefined}
      />

      {!isAdmin && (
        <div className="surface mb-4 flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem acessar compras.
        </div>
      )}

      {isAdmin && (materiais ?? []).length === 0 && (
        <div className="surface mb-4 p-3 text-sm text-muted-foreground">
          Cadastre uma matéria-prima em{" "}
          <a href="/produtos/estoque" className="underline">
            Estoque
          </a>{" "}
          antes de registrar compras.
        </div>
      )}

      {isAdmin && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Matéria-prima</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Preço unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (compras ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma compra registrada.
                  </TableCell>
                </TableRow>
              ) : (
                (compras ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{dateBR(c.data_compra)}</TableCell>
                    <TableCell className="font-medium">{c.raw_materials?.nome ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {num(c.quantidade, 3)} {c.raw_materials?.unidade}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{brl(c.preco_unitario)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(c.valor_total)}</TableCell>
                    <TableCell className="text-muted-foreground">{c.fornecedor ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => excluir(c.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
