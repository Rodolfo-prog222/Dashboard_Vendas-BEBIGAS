"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Cliente Supabase para uso em Client Components (navegador).
 * Guarda a sessão em cookies (via @supabase/ssr) para que o middleware e os
 * Server Components consigam ler o mesmo login.
 */
export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Variáveis de ambiente do Supabase ausentes: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.local.example).",
    );
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

/** Instância única do cliente para o navegador — importar e usar diretamente. */
export const supabase = createClient();
