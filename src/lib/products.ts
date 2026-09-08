"use client";

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase/client";

/** Custo calculado de cada produto (ficha técnica x preço de compra mais recente). */
export function useProductsCusto() {
  return useQuery<Record<string, number>>({
    queryKey: ["products-custo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_products_custo");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) map[row.product_id] = Number(row.custo ?? 0);
      return map;
    },
  });
}

/** Custo unitário mais recente de cada matéria-prima (preço da última compra). */
export function useRawMaterialsLastCost() {
  return useQuery<Record<string, number>>({
    queryKey: ["raw-materials-last-cost"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_raw_materials_last_cost");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) map[row.raw_material_id] = Number(row.custo ?? 0);
      return map;
    },
  });
}
