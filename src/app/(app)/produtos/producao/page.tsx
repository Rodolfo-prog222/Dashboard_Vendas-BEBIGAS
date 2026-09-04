"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { dateBR, num, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type Product = { id: string; nome: string; terceirizado: boolean };

type ProductionEntry = {
  id: string;
  product_id: string | null;
  produto_nome: string;
  quantidade: number;
  data_producao: string;
  observacoes: string | null;
  products: { terceirizado: boolean } | null;
};

function emptyForm() {
  return { product_id: "", quantidade: "", data_producao: todayISO(), observacoes: "" };
}

function ProducaoDialog({ produtos, onSaved }: { produtos: Product[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const selecionado = produtos.find((p) => p.id === form.product_id);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.product_id) return toast.error("Selecione o produto.");
    if (!form.quantidade || Number(form.quantidade) <= 0) return toast.error("Informe a quantidade produzida.");
    setSaving(true);
    const { error } = await supabase.from("production").insert({
      product_id: form.product_id,
      produto_nome: selecionado?.nome ?? "",
      quantidade: Number(form.quantidade),
      data_producao: form.data_producao,
      observacoes: form.observacoes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Produção registrada.");
    setOpen(false);
    setForm(emptyForm());
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={produtos.length === 0}>
          <Plus className="size-4" /> Registrar produção
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar produção</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selecionado?.terceirizado && (
            <p className="rounded-lg border border-warning-foreground/30 bg-warning/10 p-2 text-xs text-warning-foreground">
              Este produto é terceirizado — nenhum insumo será descontado do estoque.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade produzida</Label>
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
              <Label>Data</Label>
              <Input
                type="date"
                value={form.data_producao}
                onChange={(e) => setForm((f) => ({ ...f, data_producao: e.target.value }))}
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
              {saving && <Loader2 className="size-4 animate-spin" />} Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProducaoPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const { data: produtos } = useQuery({
    queryKey: ["produtos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, terceirizado")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: entradas, isLoading } = useQuery({
    queryKey: ["producao-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production")
        .select("*, products(terceirizado)")
        .order("data_producao", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ProductionEntry[];
    },
  });

  const produtosOrdenados = useMemo(() => [...(produtos ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)), [produtos]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["producao-lista"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-lista"] });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este registro de produção? O estoque já descontado NÃO será revertido automaticamente."))
      return;
    const { error } = await supabase.from("production").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Registro excluído.");
    refresh();
  }

  const isAdmin = !!me?.isAdmin;

  return (
    <div>
      <PageHeader
        title="Produção"
        subtitle="O que foi produzido de cada produto no dia"
        actions={isAdmin ? <ProducaoDialog produtos={produtosOrdenados} onSaved={refresh} /> : undefined}
      />

      {!isAdmin && (
        <div className="surface mb-4 flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem acessar a produção.
        </div>
      )}

      {isAdmin && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (entradas ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma produção registrada.
                  </TableCell>
                </TableRow>
              ) : (
                (entradas ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{dateBR(e.data_producao)}</TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {e.produto_nome}
                        {e.products?.terceirizado && (
                          <Badge variant="secondary" className="text-[10px]">
                            Terceirizado
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{num(e.quantidade, 3)}</TableCell>
                    <TableCell className="text-muted-foreground">{e.observacoes ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => excluir(e.id)}>
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
