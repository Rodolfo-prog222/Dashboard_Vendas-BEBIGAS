"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/lib/auth";
import { dateBR } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Profile = { id: string; nome: string; email: string | null; ativo: boolean; created_at: string };
type Role = { user_id: string; role: "admin" | "operador" };

export default function UsuariosPage() {
  const { data: me } = useMe();
  const isAdmin = !!me?.isAdmin;
  const queryClient = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["usuarios-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, email, ativo, created_at").order("created_at");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: isAdmin,
  });

  const { data: roles } = useQuery({
    queryKey: ["usuarios-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
    enabled: isAdmin,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["usuarios-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["usuarios-roles"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  const totalAdmins = (roles ?? []).filter((r) => r.role === "admin").length;

  async function toggleAtivo(id: string, ativo: boolean) {
    const { error } = await supabase.from("profiles").update({ ativo }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function promover(userId: string) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (error) return toast.error(error.message);
    toast.success("Usuário promovido a administrador.");
    refresh();
  }

  async function rebaixar(userId: string) {
    if (totalAdmins <= 1) return toast.error("É preciso manter ao menos um administrador.");
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    if (error) return toast.error(error.message);
    toast.success("Usuário rebaixado a operador.");
    refresh();
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Usuários" subtitle="Contas com acesso ao sistema" />
        <div className="surface flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Apenas administradores podem gerenciar usuários.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Usuários" subtitle="Contas com acesso ao sistema" />
      <p className="surface mb-4 flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <UserCog className="size-4" /> Novas contas são criadas na tela de login (Criar conta). A primeira conta vira administrador
        automaticamente; as seguintes entram como operador e podem ser promovidas aqui.
      </p>

      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (
              (profiles ?? []).map((p) => {
                const isUserAdmin = (roles ?? []).some((r) => r.user_id === p.id && r.role === "admin");
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.nome} {p.id === me?.userId && <span className="text-xs text-muted-foreground">(você)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{dateBR(p.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={isUserAdmin ? "default" : "secondary"}>{isUserAdmin ? "Administrador" : "Operador"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={p.ativo} onCheckedChange={(v) => toggleAtivo(p.id, v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      {isUserAdmin ? (
                        <Button size="sm" variant="outline" onClick={() => rebaixar(p.id)}>
                          Tornar operador
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => promover(p.id)}>
                          <ShieldCheck className="size-3.5" /> Promover a admin
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
