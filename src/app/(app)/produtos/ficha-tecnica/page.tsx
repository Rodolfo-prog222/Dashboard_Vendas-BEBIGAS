"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { useProductsCusto, useRawMaterialsLastCost } from "@/lib/products";
import { brl, num } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Product = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  terceirizado: boolean;
  rendimento: number;
  base_product_id: string | null;
  fator_conversao: number;
};
type RawMaterial = { id: string; nome: string; unidade: string };
type RecipeRow = { raw_material_id: string; quantidade: string };
type Modo = "receita" | "terceirizado" | "variacao";

function FichaDialog({
  produto,
  materiais,
  custosMateriais,
  produtosBase,
  custosProdutos,
  onSaved,
}: {
  produto: Product;
  materiais: RawMaterial[];
  custosMateriais: Record<string, number>;
  produtosBase: Product[];
  custosProdutos: Record<string, number>;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modo, setModo] = useState<Modo>("receita");
  const [rendimento, setRendimento] = useState(String(produto.rendimento));
  const [baseProductId, setBaseProductId] = useState("");
  const [qtdVariacao, setQtdVariacao] = useState("1");
  const [qtdBase, setQtdBase] = useState("1");
  const [rows, setRows] = useState<RecipeRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setModo(produto.base_product_id ? "variacao" : produto.terceirizado ? "terceirizado" : "receita");
    setRendimento(String(produto.rendimento));
    setBaseProductId(produto.base_product_id ?? "");
    setQtdVariacao("1");
    setQtdBase(String(produto.fator_conversao));
    setLoading(true);
    supabase
      .from("recipe_items")
      .select("raw_material_id, quantidade")
      .eq("product_id", produto.id)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) return toast.error(error.message);
        setRows((data ?? []).map((r) => ({ raw_material_id: r.raw_material_id, quantidade: String(r.quantidade) })));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const custoLote = rows.reduce((s, r) => s + (Number(r.quantidade) || 0) * (custosMateriais[r.raw_material_id] ?? 0), 0);
  const custoPorUnidade = Number(rendimento) > 0 ? custoLote / Number(rendimento) : 0;
  const baseSelecionado = produtosBase.find((p) => p.id === baseProductId);
  const fator = (Number(qtdVariacao) || 0) > 0 ? (Number(qtdBase) || 0) / Number(qtdVariacao) : 0;
  const custoVariacao = (custosProdutos[baseProductId] ?? 0) * fator;

  function addRow() {
    setRows((prev) => [...prev, { raw_material_id: "", quantidade: "" }]);
  }
  function updateRow(idx: number, patch: Partial<RecipeRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const validRows = rows.filter((r) => r.raw_material_id && Number(r.quantidade) > 0);
    if (modo === "receita" && validRows.length === 0) {
      return toast.error("Adicione ao menos um ingrediente, ou escolha outro modo.");
    }
    if (modo === "receita" && (!rendimento || Number(rendimento) <= 0)) {
      return toast.error("Informe quantas unidades o lote rende.");
    }
    if (modo === "variacao" && !baseProductId) {
      return toast.error("Selecione o produto base.");
    }
    if (modo === "variacao" && (!(Number(qtdVariacao) > 0) || !(Number(qtdBase) > 0))) {
      return toast.error("Informe a proporção entre este produto e o produto base.");
    }
    setSaving(true);
    try {
      const { error: prodError } = await supabase
        .from("products")
        .update({
          terceirizado: modo === "terceirizado",
          rendimento: modo === "receita" ? Number(rendimento) : 1,
          base_product_id: modo === "variacao" ? baseProductId : null,
          fator_conversao: modo === "variacao" ? fator : 1,
        })
        .eq("id", produto.id);
      if (prodError) throw prodError;

      const { error: delError } = await supabase.from("recipe_items").delete().eq("product_id", produto.id);
      if (delError) throw delError;

      if (modo === "receita" && validRows.length > 0) {
        const payload = validRows.map((r) => ({
          product_id: produto.id,
          raw_material_id: r.raw_material_id,
          quantidade: Number(r.quantidade),
        }));
        const { error: insError } = await supabase.from("recipe_items").insert(payload);
        if (insError) throw insError;
      }

      toast.success("Ficha técnica salva.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar a ficha técnica.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-3.5" /> Editar ficha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ficha técnica — {produto.nome}</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Como este produto é abastecido</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receita própria (ficha técnica)</SelectItem>
                <SelectItem value="terceirizado">Terceirizado (comprado pronto)</SelectItem>
                <SelectItem value="variacao">Variação de outro produto (mesmo estoque)</SelectItem>
              </SelectContent>
            </Select>
            {modo === "terceirizado" && (
              <p className="text-xs text-muted-foreground">Comprado pronto de terceiros — estoque entra pela tela de Compras.</p>
            )}
          </div>

          {modo === "variacao" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Produto base (mesmo estoque)</Label>
                <Select value={baseProductId} onValueChange={setBaseProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {produtosBase
                      .filter((p) => p.id !== produto.id)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} ({p.unidade})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Proporção com o produto base</Label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    className="w-16"
                    value={qtdVariacao}
                    onChange={(e) => setQtdVariacao(e.target.value)}
                    required
                  />
                  <span>{produto.nome}(s) equivale(m) a</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    className="w-16"
                    value={qtdBase}
                    onChange={(e) => setQtdBase(e.target.value)}
                    required
                  />
                  <span>{baseSelecionado ? baseSelecionado.nome : "produto base"}(s)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex.: 3 e 7 quer dizer &ldquo;3 {produto.nome} equivalem a 7 {baseSelecionado?.nome ?? "produto base"}&rdquo; — o sistema
                  calcula o fator exato sozinho (aqui: {num(fator, 4)}), sem arredondar. Esse fator é usado pra descontar o estoque do
                  produto base e calcular o custo.
                </p>
              </div>
              {baseProductId && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Custo calculado: </span>
                  <span className="font-semibold">{brl(custoVariacao)}</span>
                  {custoVariacao === 0 && (
                    <span className="ml-2 text-xs text-warning-foreground">
                      (o produto base ainda não tem custo — preencha a ficha técnica ou uma compra dele primeiro)
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {modo === "receita" && (
            <div className="space-y-1.5">
              <Label>Rende quantas {produto.unidade}(s)</Label>
              <Input
                type="number"
                min={0}
                step="0.001"
                className="w-32"
                value={rendimento}
                onChange={(e) => setRendimento(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Quantas unidades/porções o lote abaixo rende quando produzido inteiro.
              </p>
            </div>
          )}

          {modo === "receita" && (
            <div className="space-y-2">
              <Label>Ingredientes do lote (receita completa)</Label>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <>
                  {rows.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum ingrediente ainda.</p>
                  )}
                  {rows.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select value={r.raw_material_id} onValueChange={(v) => updateRow(idx, { raw_material_id: v })}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Matéria-prima..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materiais.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nome} ({m.unidade})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        className="w-28"
                        placeholder="Qtd."
                        value={r.quantidade}
                        onChange={(e) => updateRow(idx, { quantidade: e.target.value })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0 text-destructive"
                        onClick={() => removeRow(idx)}
                        aria-label="Remover ingrediente"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
              <Button type="button" size="sm" variant="outline" onClick={addRow}>
                <Plus className="size-3.5" /> Adicionar ingrediente
              </Button>
            </div>
          )}

          {modo === "receita" && rows.length > 0 && (
            <div className="surface flex items-center justify-between p-3 text-sm">
              <span className="text-muted-foreground">Custo do lote: {brl(custoLote)}</span>
              <span className="font-semibold">Custo por {produto.unidade}: {brl(custoPorUnidade)}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving || loading}>
              {saving && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FichaTecnicaPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, categoria, unidade, terceirizado, rendimento, base_product_id, fator_conversao")
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

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

  const { data: custosMateriais } = useRawMaterialsLastCost();
  const { data: custosProdutos } = useProductsCusto();

  const { data: itemCounts } = useQuery({
    queryKey: ["ficha-tecnica-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipe_items").select("product_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.product_id] = (counts[row.product_id] ?? 0) + 1;
      return counts;
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["produtos-lista"] });
    queryClient.invalidateQueries({ queryKey: ["produtos-ativos"] });
    queryClient.invalidateQueries({ queryKey: ["produtos-ativos-producao"] });
    queryClient.invalidateQueries({ queryKey: ["produtos-terceirizados-ativos"] });
    queryClient.invalidateQueries({ queryKey: ["ficha-tecnica-counts"] });
    queryClient.invalidateQueries({ queryKey: ["products-custo"] });
  }

  const isAdmin = !!me?.isAdmin;
  const produtosBase = (produtos ?? []).filter((p) => !p.base_product_id);
  const produtosPorId = Object.fromEntries((produtos ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <PageHeader title="Ficha técnica" subtitle="O que cada produto consome de matéria-prima" />

      {!isAdmin && (
        <div className="surface mb-4 flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem acessar a ficha técnica.
        </div>
      )}

      {isAdmin && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ficha técnica</TableHead>
                <TableHead className="text-right">Custo/unidade</TableHead>
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
              ) : (
                (produtos ?? []).map((p) => {
                  const count = itemCounts?.[p.id] ?? 0;
                  const produtoBase = p.base_product_id ? produtosPorId[p.base_product_id] : undefined;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {p.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {produtoBase ? (
                          <span className="text-sm text-muted-foreground">
                            Variação de {produtoBase.nome} ({num(p.fator_conversao, 4)}x)
                          </span>
                        ) : p.terceirizado ? (
                          <Badge variant="secondary">Terceirizado</Badge>
                        ) : count > 0 ? (
                          <span className="text-sm text-muted-foreground">{count} ingrediente(s)</span>
                        ) : (
                          <span className="text-sm text-warning-foreground">Sem ficha cadastrada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {brl(custosProdutos?.[p.id] ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <FichaDialog
                          produto={p}
                          materiais={materiais ?? []}
                          custosMateriais={custosMateriais ?? {}}
                          produtosBase={produtosBase}
                          custosProdutos={custosProdutos ?? {}}
                          onSaved={refresh}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

