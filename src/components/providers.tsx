"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryCache, QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/confirm-dialog";

// Sobe esta string quando o formato dos dados cacheados mudar, para descartar
// caches antigos incompatíveis salvos no localStorage dos usuários.
const CACHE_BUSTER = "v1";
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: CACHE_MAX_AGE,
            placeholderData: keepPreviousData,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Se a query já tem dado em cache (ex.: refetch em segundo plano), falha
            // silenciosamente para não incomodar o usuário — os dados antigos continuam na tela.
            if (query.state.data !== undefined) return;
            toast.error(error instanceof Error ? error.message : "Erro ao carregar dados.");
          },
        }),
      }),
  );
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.refresh();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      else queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  const content = (
    <ConfirmProvider>
      {children}
      <Toaster position="top-center" richColors />
    </ConfirmProvider>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {typeof window !== "undefined" ? (
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: createSyncStoragePersister({ storage: window.localStorage, key: "bebigas-query-cache" }),
            buster: CACHE_BUSTER,
            maxAge: CACHE_MAX_AGE,
          }}
        >
          {content}
        </PersistQueryClientProvider>
      ) : (
        <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
      )}
    </ThemeProvider>
  );
}
