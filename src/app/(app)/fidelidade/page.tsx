"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { useLoyaltyBalances, useLoyaltySettings } from "@/lib/loyalty";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function FidelidadePage() {
  const { data: me } = useMe();
  const isAdmin = !!me?.isAdmin;
  const queryClient = useQueryClient();
  const { data: settings } = useLoyaltySettings();
  const { data: balances } = useLoyaltyBalances();

  const { data: customers } = useQuery({
    queryKey: ["clientes-fidelidade"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({ pontos_por_real: "1", pontos_para_resgate: "100", recompensa: "", valor_desconto: "0" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        pontos_por_real: String(settings.pontos_por_real),
        pontos_para_resgate: String(settings.pontos_para_resgate),
        recompensa: settings.recompensa,
        valor_desconto: String(settings.valor_desconto),
      });
    }
  }, [settings]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("loyalty_settings")
      .update({
        pontos_por_real: Number(form.pontos_por_real) || 0,
        pontos_para_resgate: Number(form.pontos_para_resgate) || 0,
        recompensa: form.recompensa,
        valor_desconto: Number(form.valor_desconto) || 0,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Regras de fidelidade atualizadas.");
    queryClient.invalidateQueries({ queryKey: ["loyalty-settings"] });
  }

  const ranking = (customers ?? [])
    .map((c) => ({ ...c, pontos: balances?.[c.id] ?? 0 }))
    .filter((c) => c.pontos !== 0)
    .sort((a, b) => b.pontos - a.pontos);

  return (
    <div>
      <PageHeader title="Fidelidade" subtitle="Regras de pontuação e saldo dos clientes" />

      {!isAdmin && (
        <div className="surface mb-4 flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem alterar as regras de fidelidade.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-1">
          <h2 className="font-semibold">Regras do programa</h2>
          <form onSubmit={salvar} className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label>Pontos por real gasto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={!isAdmin}
                value={form.pontos_por_real}
                onChange={(e) => setForm((f) => ({ ...f, pontos_por_real: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pontos necessários para resgate</Label>
              <Input
                type="number"
                min={0}
                disabled={!isAdmin}
                value={form.pontos_para_resgate}
                onChange={(e) => setForm((f) => ({ ...f, pontos_para_resgate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Recompensa</Label>
              <Input
                disabled={!isAdmin}
                value={form.recompensa}
                onChange={(e) => setForm((f) => ({ ...f, recompensa: e.target.value }))}
                placeholder="Ex.: R$ 10 de desconto"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor do desconto (R$, se aplicável)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={!isAdmin}
                value={form.valor_desconto}
                onChange={(e) => setForm((f) => ({ ...f, valor_desconto: e.target.value }))}
              />
            </div>
            {isAdmin && (
              <Button type="submit" disabled={saving} className="w-full">
                {saving && <Loader2 className="size-4 animate-spin" />} Salvar regras
              </Button>
            )}
          </form>
        </div>

        <div className="surface p-5 lg:col-span-2">
          <h2 className="font-semibold">Saldo de pontos por cliente</h2>
          {ranking.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente com pontos ainda.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {ranking.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.nome}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant={settings && c.pontos >= settings.pontos_para_resgate ? "default" : "secondary"}>
                      {c.pontos} pts
                    </Badge>
                    {settings && c.pontos >= settings.pontos_para_resgate && (
                      <span className="text-xs text-primary-deep">Pronto p/ resgate</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
