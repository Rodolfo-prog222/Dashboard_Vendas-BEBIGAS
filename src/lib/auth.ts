"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export type Me = {
  userId: string;
  email: string | null;
  nome: string;
  isAdmin: boolean;
  role: "admin" | "operador";
};

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("nome, email, ativo").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      return {
        userId: user.id,
        email: profile?.email ?? user.email ?? null,
        nome: profile?.nome || (user.email ?? "").split("@")[0],
        isAdmin,
        role: isAdmin ? "admin" : "operador",
      };
    },
  });
}
