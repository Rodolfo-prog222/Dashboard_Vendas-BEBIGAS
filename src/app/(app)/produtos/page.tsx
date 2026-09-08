"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { useProductsCusto } from "@/lib/products";
import { brl, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

type Product = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  custo: number;
  unidade: string;
  disponivel_hoje: boolean;
  ativo: boolean;
  terceirizado: boolean;
  estoque_atual: number;
  base_product_id: string | null;
  fator_conversao: number;
};

const CATEGORIAS = ["comida", "sobremesa"];
const UNIDADES = ["un", "kg", "porção", "l"];

function emptyForm() {
  return { nome: "", categoria: "comida", preco: "", custo: "", unidade: "un" };
}

function ProdutoDialog({
  produto,
  custoCalculado,
  onSaved,
}: {
  produto?: Product;
  custoCalculado?: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(
    produto
      ? { nome: produto.nome, categoria: produto.categoria, preco: String(produto.preco), custo: String(produto.custo), unidade: produto.unidade }
      : emptyForm(),
  );
  const custoTravado = !!produto && !produto.terceirizado;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do produto.");
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria,
      preco: Number(form.preco) || 0,
      ...(custoTravado ? {} : { custo: Number(form.custo) || 0 }),
      unidade: form.unidade,
    };
    const { error } = produto
      ? await supabase.from("products").update(payload).eq("id", produto.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(produto ? "Produto atualizado." : "Produto cadastrado.");
    setOpen(false);
    if (!produto) setForm(emptyForm());
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {produto ? (
          <Button size="icon" variant="ghost" className="size-8" aria-label="Editar produto">
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" /> Novo produto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço de venda (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.preco} onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Custo (R$)</Label>
              {custoTravado ? (
                <>
                  <Input type="text" readOnly disabled value={brl(custoCalculado ?? 0)} />
                  <p className="text-xs text-muted-foreground">Calculado pela ficha técnica.</p>
                </>
              ) : (
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.custo}
                  onChange={(e) => setForm((f) => ({ ...f, custo: e.target.value }))}
                  required
                />
              )}
            </div>
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

export default function ProdutosPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("categoria").order("nome");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: custosProdutos } = useProductsCusto();

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["produtos-lista"] });
    queryClient.invalidateQueries({ queryKey: ["produtos-ativos"] });
    queryClient.invalidateQueries({ queryKey: ["produtos-ativos-producao"] });
    queryClient.invalidateQueries({ queryKey: ["products-custo"] });
  }

  async function toggle(id: string, field: "disponivel_hoje" | "ativo", value: boolean) {
    const payload = field === "ativo" ? { ativo: value } : { disponivel_hoje: value };
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function excluir(id: string) {
    const ok = await confirm({
      title: "Excluir produto",
      description: "Excluir este produto? Vendas antigas continuam com o nome salvo.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto excluído.");
    refresh();
  }

  const isAdmin = !!me?.isAdmin;
  const produtosPorId = Object.fromEntries((produtos ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="Cadastro, preços e custos"
        actions={isAdmin ? <ProdutoDialog onSaved={refresh} /> : undefined}
      />

      {!isAdmin && (
        <div className="surface mb-4 flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem alterar produtos e preços.
        </div>
      )}

      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Disponível hoje</TableHead>
              <TableHead>Ativo</TableHead>
              {isAdmin && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (
              (produtos ?? []).map((p) => {
                const custo = custosProdutos?.[p.id] ?? p.custo;
                const margem = p.preco > 0 ? ((p.preco - custo) / p.preco) * 100 : 0;
                const produtoBase = p.base_product_id ? produtosPorId[p.base_product_id] : undefined;
                const estoque = produtoBase ? produtoBase.estoque_atual / p.fator_conversao : p.estoque_atual;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.nome}
                      {produtoBase && (
                        <p className="text-xs font-normal text-muted-foreground">
                          Variação de {produtoBase.nome} ({num(p.fator_conversao, 4)}x)
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {p.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{brl(p.preco)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{brl(custo)}</TableCell>
                    <TableCell className="text-right">{margem.toFixed(0)}%</TableCell>
                    <TableCell className={cn("text-right", estoque <= 0 && "text-destructive")}>
                      {num(estoque, 3)} {p.unidade}
                    </TableCell>
                    <TableCell>
                      <Switch checked={p.disponivel_hoje} disabled={!isAdmin} onCheckedChange={(v) => toggle(p.id, "disponivel_hoje", v)} />
                    </TableCell>
                    <TableCell>
                      <Switch checked={p.ativo} disabled={!isAdmin} onCheckedChange={(v) => toggle(p.id, "ativo", v)} />
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ProdutoDialog produto={p} custoCalculado={custosProdutos?.[p.id]} onSaved={refresh} />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive"
                            onClick={() => excluir(p.id)}
                            aria-label="Excluir produto"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
