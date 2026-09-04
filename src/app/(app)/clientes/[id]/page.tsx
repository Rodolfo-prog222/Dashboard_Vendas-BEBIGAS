"use client";

import { use, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gift, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useLoyaltySettings } from "@/lib/loyalty";
import { brl, dateBR } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMe } from "@/lib/auth";

export default function ClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: settings } = useLoyaltySettings();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: vendas } = useQuery({
    queryKey: ["cliente-vendas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, data_venda, total, status")
        .eq("customer_id", id)
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pontosTransacoes } = useQuery({
    queryKey: ["cliente-pontos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_transactions")
        .select("id, pontos, tipo, descricao, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<{ nome: string; telefone: string; endereco: string; nascimento: string; observacoes: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const active = form ?? (cliente ? { nome: cliente.nome, telefone: cliente.telefone ?? "", endereco: cliente.endereco ?? "", nascimento: cliente.nascimento ?? "", observacoes: cliente.observacoes ?? "" } : null);

  const totalGasto = (vendas ?? []).reduce((s, v) => s + Number(v.total), 0);
  const ticketMedio = vendas && vendas.length ? totalGasto / vendas.length : 0;
  const ultimaCompra = vendas?.[0];
  const saldoPontos = (pontosTransacoes ?? []).reduce((s, t) => s + Number(t.pontos), 0);
  const prontoParaResgate = settings ? saldoPontos >= settings.pontos_para_resgate : false;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("customers")
      .update({
        nome: active.nome,
        telefone: active.telefone || null,
        endereco: active.endereco || null,
        nascimento: active.nascimento || null,
        observacoes: active.observacoes || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente atualizado.");
    queryClient.invalidateQueries({ queryKey: ["cliente", id] });
    queryClient.invalidateQueries({ queryKey: ["clientes-lista"] });
  }

  async function excluir() {
    if (!confirm(`Excluir o cliente ${cliente?.nome}? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente excluído.");
    router.push("/clientes");
  }

  async function registrarResgate() {
    if (!settings) return;
    const { error } = await supabase.from("loyalty_transactions").insert({
      customer_id: id,
      pontos: -settings.pontos_para_resgate,
      tipo: "resgate",
      descricao: settings.recompensa,
    });
    if (error) return toast.error(error.message);
    toast.success(`Resgate registrado: ${settings.recompensa}`);
    queryClient.invalidateQueries({ queryKey: ["cliente-pontos", id] });
    queryClient.invalidateQueries({ queryKey: ["loyalty-balances"] });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!cliente) return <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/clientes")}>
        <ArrowLeft className="size-4" /> Voltar
      </Button>
      <PageHeader
        title={cliente.nome}
        subtitle={`Cliente desde ${dateBR(cliente.created_at)}`}
        actions={
          me?.isAdmin ? (
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={excluir}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="surface p-5">
            <h2 className="mb-3 font-semibold">Dados do cliente</h2>
            {active && (
              <form onSubmit={salvar} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={active.nome} onChange={(e) => setForm({ ...active, nome: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={active.telefone} onChange={(e) => setForm({ ...active, telefone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nascimento</Label>
                    <Input type="date" value={active.nascimento} onChange={(e) => setForm({ ...active, nascimento: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Endereço</Label>
                  <Input value={active.endereco} onChange={(e) => setForm({ ...active, endereco: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={active.observacoes} onChange={(e) => setForm({ ...active, observacoes: e.target.value })} />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar alterações
                </Button>
              </form>
            )}
          </div>

          <div className="surface p-5">
            <h2 className="mb-3 font-semibold">Histórico de compras</h2>
            {!vendas || vendas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma compra registrada ainda.</p>
            ) : (
              <ul className="divide-y">
                {vendas.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>{dateBR(v.data_venda)}</span>
                    <Badge variant="outline">{v.status}</Badge>
                    <span className="font-medium">{brl(Number(v.total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface p-5">
            <h2 className="font-semibold">Resumo</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total gasto</dt>
                <dd className="font-medium">{brl(totalGasto)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ticket médio</dt>
                <dd className="font-medium">{brl(ticketMedio)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Compras</dt>
                <dd className="font-medium">{vendas?.length ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Última compra</dt>
                <dd className="font-medium">{ultimaCompra ? dateBR(ultimaCompra.data_venda) : "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="surface p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Gift className="size-4 text-primary" /> Fidelidade
            </h2>
            <p className="mt-3 text-2xl font-bold">{saldoPontos} pts</p>
            {settings && (
              <p className="mt-1 text-xs text-muted-foreground">
                Resgate a partir de {settings.pontos_para_resgate} pts · {settings.recompensa}
              </p>
            )}
            {prontoParaResgate && (
              <Button className="mt-3 w-full" size="sm" onClick={registrarResgate}>
                Registrar resgate
              </Button>
            )}
            {(pontosTransacoes ?? []).length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                {(pontosTransacoes ?? []).slice(0, 8).map((t) => (
                  <li key={t.id} className="flex justify-between text-muted-foreground">
                    <span>{t.descricao ?? t.tipo}</span>
                    <span className={t.pontos < 0 ? "text-destructive" : "text-primary-deep"}>
                      {t.pontos > 0 ? "+" : ""}
                      {t.pontos}
                    </span>
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
