"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { dateBR, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { ViewToggle } from "@/components/ViewToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Customer = {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  nascimento: string | null;
  observacoes: string | null;
  sales: { data_venda: string }[];
};

type Estagio = "novo" | "ativo" | "recorrente" | "inativo";

const ESTAGIOS: { key: Estagio; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "ativo", label: "Ativo" },
  { key: "recorrente", label: "Recorrente" },
  { key: "inativo", label: "Inativo" },
];

function estagioCliente(c: Customer, hoje: string): Estagio {
  if (c.sales.length === 0) return "novo";
  const ultima = c.sales.reduce((max, v) => (v.data_venda > max ? v.data_venda : max), c.sales[0].data_venda);
  const dias = (new Date(hoje).getTime() - new Date(ultima).getTime()) / 86400000;
  if (dias > 60) return "inativo";
  if (c.sales.length >= 2) return "recorrente";
  return "ativo";
}

function NovoClienteDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", endereco: "", nascimento: "", observacoes: "" });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do cliente.");
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      nascimento: form.nascimento || null,
      observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado!");
    setForm({ nome: "", telefone: "", endereco: "", nascimento: "", observacoes: "" });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["clientes-lista"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Novo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nascimento">Nascimento</Label>
              <Input
                id="nascimento"
                type="date"
                value={form.nascimento}
                onChange={(e) => setForm((f) => ({ ...f, nascimento: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Preferências, restrições..."
            />
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

export default function ClientesPage() {
  const [busca, setBusca] = useState("");
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const hoje = todayISO();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["clientes-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*, sales(data_venda)").order("nome");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const filtrados = (customers ?? []).filter((c) => {
    const q = busca.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.telefone ?? "").includes(q);
  });

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${customers?.length ?? 0} cliente(s) cadastrado(s)`} actions={<NovoClienteDialog />} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="surface flex flex-1 items-center gap-2 p-3 sm:max-w-sm">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            { value: "lista", label: "Lista" },
            { value: "kanban", label: "Kanban" },
          ]}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
      ) : view === "lista" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="surface block p-4 transition-colors hover:border-primary">
              <p className="font-semibold">{c.nome}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.telefone || "Sem telefone"}</p>
              {c.nascimento && <p className="mt-1 text-xs text-muted-foreground">Aniversário: {dateBR(c.nascimento).slice(0, 5)}</p>}
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ESTAGIOS.map((estagio) => {
            const doEstagio = filtrados.filter((c) => estagioCliente(c, hoje) === estagio.key);
            return (
              <div key={estagio.key} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{estagio.label}</h2>
                  <Badge variant="outline">{doEstagio.length}</Badge>
                </div>
                <div className="space-y-2">
                  {doEstagio.length === 0 ? (
                    <p className="surface p-3 text-center text-xs text-muted-foreground">Ninguém aqui</p>
                  ) : (
                    doEstagio.map((c) => {
                      const ultima = c.sales.length
                        ? c.sales.reduce((max, v) => (v.data_venda > max ? v.data_venda : max), c.sales[0].data_venda)
                        : null;
                      return (
                        <Link key={c.id} href={`/clientes/${c.id}`} className="surface block p-3 transition-colors hover:border-primary">
                          <p className="truncate text-sm font-medium">{c.nome}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.telefone || "Sem telefone"}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{c.sales.length} compra(s)</span>
                            <span>{ultima ? dateBR(ultima) : "Nunca comprou"}</span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
