"use client";

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase/client";

export type LoyaltySettings = {
  pontos_por_real: number;
  pontos_para_resgate: number;
  recompensa: string;
  valor_desconto: number;
};

export function useLoyaltySettings() {
  return useQuery<LoyaltySettings>({
    queryKey: ["loyalty-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_settings")
        .select("pontos_por_real, pontos_para_resgate, recompensa, valor_desconto")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return {
        pontos_por_real: Number(data?.pontos_por_real ?? 1),
        pontos_para_resgate: Number(data?.pontos_para_resgate ?? 100),
        recompensa: data?.recompensa ?? "Desconto",
        valor_desconto: Number(data?.valor_desconto ?? 0),
      };
    },
  });
}

/** Saldo de pontos por cliente (acúmulos positivos + resgates negativos). */
export function useLoyaltyBalances() {
  return useQuery<Record<string, number>>({
    queryKey: ["loyalty-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loyalty_transactions").select("customer_id, pontos");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[row.customer_id] = (map[row.customer_id] ?? 0) + Number(row.pontos);
      }
      return map;
    },
  });
}
