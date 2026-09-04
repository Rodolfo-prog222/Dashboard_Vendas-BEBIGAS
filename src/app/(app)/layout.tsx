import { AppShell } from "@/components/AppShell";

// A proteção de acesso já acontece no middleware (src/middleware.ts), que redireciona
// para /auth quando não há sessão válida. Este layout só monta a casca visual (sidebar,
// menu mobile) em volta de todas as páginas autenticadas.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
