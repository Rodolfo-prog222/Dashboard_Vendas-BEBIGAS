"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { num } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type RawMaterial = {
  id: string;
  nome: string;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
};

const UNIDADES = ["un", "kg", "g", "l", "ml", "porção"];

function emptyForm() {
  return { nome: "", unidade: "kg", estoque_atual: "0", estoque_minimo: "0" };
}

function MaterialDialog({ material, onSaved }: { material?: RawMaterial; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(
    material
      ? {
          nome: material.nome,
          unidade: material.unidade,
          estoque_atual: String(material.estoque_atual),
          estoque_minimo: String(material.estoque_minimo),
        }
      : emptyForm(),
  );

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome da matéria-prima.");
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      unidade: form.unidade,
      estoque_atual: Number(form.estoque_atual) || 0,
      estoque_minimo: Number(form.estoque_minimo) || 0,
    };
    const { error } = material
      ? await supabase.from("raw_materials").update(payload).eq("id", material.id)
      : await supabase.from("raw_materials").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(material ? "Matéria-prima atualizada." : "Matéria-prima cadastrada.");
    setOpen(false);
    if (!material) setForm(emptyForm());
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {material ? (
          <Button size="icon" variant="ghost" className="size-8">
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" /> Nova matéria-prima
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{material ? "Editar matéria-prima" : "Nova matéria-prima"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estoque atual</Label>
              <Input
                type="number"
                step="0.001"
                value={form.estoque_atual}
                onChange={(e) => setForm((f) => ({ ...f, estoque_atual: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estoque mínimo</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={form.estoque_minimo}
                onChange={(e) => setForm((f) => ({ ...f, estoque_minimo: e.target.value }))}
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O estoque atual também é ajustado automaticamente por Compras e Produção — edite aqui só para
            correções manuais ou a contagem inicial.
          </p>
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

export default function EstoquePage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const { data: materiais, isLoading } = useQuery({
    queryKey: ["estoque-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("raw_materials").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as RawMaterial[];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["estoque-lista"] });
    queryClient.invalidateQueries({ queryKey: ["materiais-ativos"] });
  }

  async function toggleAtivo(id: string, value: boolean) {
    const { error } = await supabase.from("raw_materials").update({ ativo: value }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta matéria-prima? Isso falha se ela já tiver compras ou fichas técnicas vinculadas."))
      return;
    const { error } = await supabase.from("raw_materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Matéria-prima excluída.");
    refresh();
  }

  const isAdmin = !!me?.isAdmin;

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle="Controle de matéria-prima"
        actions={isAdmin ? <MaterialDialog onSaved={refresh} /> : undefined}
      />

      {!isAdmin && (
        <div className="surface mb-4 flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem acessar o estoque.
        </div>
      )}

      {isAdmin && (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matéria-prima</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Estoque atual</TableHead>
                <TableHead className="text-right">Estoque mínimo</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (materiais ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma matéria-prima cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                (materiais ?? []).map((m) => {
                  const baixo = m.estoque_atual < m.estoque_minimo;
                  const negativo = m.estoque_atual < 0;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell>{m.unidade}</TableCell>
                      <TableCell
                        className={
                          "text-right " +
                          (negativo ? "font-medium text-destructive" : baixo ? "font-medium text-warning-foreground" : "")
                        }
                      >
                        <span className="inline-flex items-center gap-1 justify-end">
                          {(negativo || baixo) && <AlertTriangle className="size-3.5" />}
                          {num(m.estoque_atual, 3)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{num(m.estoque_minimo, 3)}</TableCell>
                      <TableCell>
                        <Switch checked={m.ativo} onCheckedChange={(v) => toggleAtivo(m.id, v)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <MaterialDialog material={m} onSaved={refresh} />
                          <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => excluir(m.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
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
