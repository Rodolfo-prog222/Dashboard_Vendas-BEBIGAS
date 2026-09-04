"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
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

type Product = { id: string; nome: string; categoria: string; terceirizado: boolean };
type RawMaterial = { id: string; nome: string; unidade: string };
type RecipeRow = { raw_material_id: string; quantidade: string };

function FichaDialog({
  produto,
  materiais,
  ingredientesCount,
  onSaved,
}: {
  produto: Product;
  materiais: RawMaterial[];
  ingredientesCount: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terceirizado, setTerceirizado] = useState(produto.terceirizado);
  const [rows, setRows] = useState<RecipeRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setTerceirizado(produto.terceirizado);
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
    if (!terceirizado && validRows.length === 0) {
      return toast.error("Adicione ao menos um ingrediente, ou marque como terceirizado.");
    }
    setSaving(true);
    try {
      const { error: prodError } = await supabase.from("products").update({ terceirizado }).eq("id", produto.id);
      if (prodError) throw prodError;

      const { error: delError } = await supabase.from("recipe_items").delete().eq("product_id", produto.id);
      if (delError) throw delError;

      if (!terceirizado && validRows.length > 0) {
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
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Terceirizado</Label>
              <p className="text-xs text-muted-foreground">Comprado pronto de terceiros — não consome estoque.</p>
            </div>
            <Switch checked={terceirizado} onCheckedChange={setTerceirizado} />
          </div>

          {!terceirizado && (
            <div className="space-y-2">
              <Label>Ingredientes (consumo por unidade produzida)</Label>
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
                      <Button size="icon" variant="ghost" className="size-8 shrink-0 text-destructive" onClick={() => removeRow(idx)}>
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
        .select("id, nome, categoria, terceirizado")
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
    queryClient.invalidateQueries({ queryKey: ["ficha-tecnica-counts"] });
  }

  const isAdmin = !!me?.isAdmin;

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
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (
                (produtos ?? []).map((p) => {
                  const count = itemCounts?.[p.id] ?? 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {p.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.terceirizado ? (
                          <Badge variant="secondary">Terceirizado</Badge>
                        ) : count > 0 ? (
                          <span className="text-sm text-muted-foreground">{count} ingrediente(s)</span>
                        ) : (
                          <span className="text-sm text-warning-foreground">Sem ficha cadastrada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <FichaDialog produto={p} materiais={materiais ?? []} ingredientesCount={count} onSaved={refresh} />
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
