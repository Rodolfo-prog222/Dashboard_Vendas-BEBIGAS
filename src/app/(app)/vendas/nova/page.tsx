"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Minus, Plus, Trash2, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { useLoyaltySettings } from "@/lib/loyalty";
import { brl, todayISO, PAYMENT_METHODS, paymentLabel } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  custo: number;
  unidade: string;
};

type CartItem = {
  product_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  custo_unitario: number;
  unidade: string;
};

type Payment = { metodo: (typeof PAYMENT_METHODS)[number]; valor: number };

export default function NovaVenda() {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: loyalty } = useLoyaltySettings();

  const { data: products } = useQuery({
    queryKey: ["produtos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, categoria, preco, custo, unidade")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, nome, telefone").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [payments, setPayments] = useState<Payment[]>([{ metodo: "dinheiro", valor: 0 }]);
  const [saving, setSaving] = useState(false);

  const comidas = (products ?? []).filter((p) => p.categoria === "comida");
  const sobremesas = (products ?? []).filter((p) => p.categoria === "sobremesa");
  const outras = (products ?? []).filter((p) => p.categoria !== "comida" && p.categoria !== "sobremesa");

  const subtotal = cart.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
  const custoTotal = cart.reduce((s, i) => s + i.custo_unitario * i.quantidade, 0);
  const descontoNum = Number(desconto) || 0;
  const total = Math.max(0, subtotal - descontoNum);
  const pontosEstimados = loyalty ? Math.round(total * loyalty.pontos_por_real) : 0;

  const totalPago = payments.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const diferenca = Math.round((total - totalPago) * 100) / 100;

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) => (i.product_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...prev,
        {
          product_id: p.id,
          produto_nome: p.nome,
          quantidade: 1,
          preco_unitario: Number(p.preco),
          custo_unitario: Number(p.custo),
          unidade: p.unidade,
        },
      ];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      qty <= 0 ? prev.filter((i) => i.product_id !== id) : prev.map((i) => (i.product_id === id ? { ...i, quantidade: qty } : i)),
    );
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((i) => i.product_id !== id));
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, { metodo: "pix", valor: 0 }]);
  }

  function updatePayment(idx: number, patch: Partial<Payment>) {
    setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function removePayment(idx: number) {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  }

  function preencherPagamentoTotal() {
    setPayments((prev) => (prev.length ? [{ ...prev[0], valor: total }, ...prev.slice(1).map((p) => ({ ...p, valor: 0 }))] : [{ metodo: "dinheiro", valor: total }]));
  }

  async function finalizarVenda() {
    if (cart.length === 0) return toast.error("Adicione ao menos um produto.");
    if (payments.length === 0 || payments.every((p) => !p.valor)) return toast.error("Informe a forma de pagamento.");
    if (Math.abs(diferenca) > 0.01) return toast.error(`O total pago (${brl(totalPago)}) não bate com o total da venda (${brl(total)}).`);

    setSaving(true);
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_id: customerId,
          vendedor_id: me?.userId ?? null,
          data_venda: todayISO(),
          subtotal,
          desconto: descontoNum,
          total,
          custo_total: custoTotal,
          status: "em preparo",
          observacoes: observacoes || null,
        })
        .select("id")
        .single();
      if (saleError || !sale) throw saleError ?? new Error("Falha ao criar venda");

      const itemsPayload = cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.product_id,
        produto_nome: i.produto_nome,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        custo_unitario: i.custo_unitario,
        subtotal: i.preco_unitario * i.quantidade,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(itemsPayload);
      if (itemsError) throw itemsError;

      const paymentsPayload = payments.filter((p) => p.valor > 0).map((p) => ({ sale_id: sale.id, metodo: p.metodo, valor: p.valor }));
      const { error: paymentsError } = await supabase.from("sale_payments").insert(paymentsPayload);
      if (paymentsError) throw paymentsError;

      if (customerId && pontosEstimados > 0) {
        await supabase.from("loyalty_transactions").insert({
          customer_id: customerId,
          sale_id: sale.id,
          pontos: pontosEstimados,
          tipo: "acumulo",
          descricao: `Compra de ${brl(total)}`,
        });
      }

      toast.success("Venda registrada!");
      router.push("/vendas");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar a venda.");
    } finally {
      setSaving(false);
    }
  }

  function ProductGrid({ title, items }: { title: string; items: Product[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="surface flex flex-col items-start gap-1 p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              <span className="text-sm font-medium leading-tight">{p.nome}</span>
              <span className="text-xs text-muted-foreground">{brl(p.preco)} / {p.unidade}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Nova venda" subtitle="Monte o pedido e registre o pagamento" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <ProductGrid title="Comida do fim de semana" items={comidas} />
          <ProductGrid title="Sobremesas" items={sobremesas} />
          <ProductGrid title="Outros" items={outras} />
          {(products ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum produto disponível. Cadastre produtos na tela{" "}
              <a href="/produtos" className="underline">
                Produtos
              </a>
              .
            </p>
          )}
        </div>

        <div className="surface flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-primary" />
            <h2 className="font-semibold">Pedido</h2>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedCustomer ? selectedCustomer.nome : "Cliente balcão (sem cadastro)"}
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="cliente-balcao"
                        onSelect={() => {
                          setCustomerId(null);
                          setCustomerOpen(false);
                        }}
                      >
                        <Check className={cn("size-4", customerId === null ? "opacity-100" : "opacity-0")} />
                        Cliente balcão
                      </CommandItem>
                      {(customers ?? []).map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.nome} ${c.telefone ?? ""}`}
                          onSelect={() => {
                            setCustomerId(c.id);
                            setCustomerOpen(false);
                          }}
                        >
                          <Check className={cn("size-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                          {c.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item ainda. Toque em um produto ao lado.</p>
            ) : (
              cart.map((i) => (
                <div key={i.product_id} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.produto_nome}</p>
                    <p className="text-xs text-muted-foreground">{brl(i.preco_unitario)} / {i.unidade}</p>
                  </div>
                  {i.unidade === "kg" ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        value={i.quantidade}
                        onChange={(e) => setQty(i.product_id, Number(e.target.value))}
                        className="h-7 w-20 text-right"
                      />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(i.product_id, i.quantidade - 1)}>
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{i.quantidade}</span>
                      <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(i.product_id, i.quantidade + 1)}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  )}
                  <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeFromCart(i.product_id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desconto">Desconto (R$)</Label>
            <Input id="desconto" type="number" min={0} step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          </div>

          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{brl(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Desconto</span>
              <span>-{brl(descontoNum)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{brl(total)}</span>
            </div>
            {!!customerId && loyalty && (
              <p className="text-xs text-primary-deep">+{pontosEstimados} pontos de fidelidade nesta compra</p>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label>Pagamento</Label>
              <Button type="button" size="sm" variant="ghost" onClick={preencherPagamentoTotal}>
                Preencher com o total
              </Button>
            </div>
            {payments.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={p.metodo} onValueChange={(v) => updatePayment(idx, { metodo: v as Payment["metodo"] })}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {paymentLabel[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={p.valor || ""}
                  onChange={(e) => updatePayment(idx, { valor: Number(e.target.value) })}
                  placeholder="0,00"
                />
                {payments.length > 1 && (
                  <Button size="icon" variant="ghost" className="size-8 shrink-0 text-destructive" onClick={() => removePayment(idx)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addPaymentRow}>
              <Plus className="size-3.5" /> Outra forma de pagamento
            </Button>
            {Math.abs(diferenca) > 0.01 && (
              <p className="text-xs text-warning-foreground">
                {diferenca > 0 ? `Faltam ${brl(diferenca)}` : `Sobrando ${brl(-diferenca)}`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>

          <Button size="lg" disabled={saving || cart.length === 0} onClick={finalizarVenda}>
            {saving && <Loader2 className="size-4 animate-spin" />} Finalizar venda — {brl(total)}
          </Button>
        </div>
      </div>
    </div>
  );
}
