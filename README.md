# Bebigás CRM — Next.js + Supabase

Migração do projeto original (Lovable / TanStack Start) para **Next.js 15 (App Router) + React 19**,
pronta para deploy na **Vercel** sem passos extras.

## O que já vem pronto
- Landing (`/`), login/cadastro (`/auth`)
- Painel (`/dashboard`)
- PDV — Nova venda (`/vendas/nova`) e histórico (`/vendas`)
- Carteira de clientes (`/clientes`, `/clientes/[id]`)
- Produtos e preços (`/produtos`) — admin
- Programa de fidelidade (`/fidelidade`) — admin
- Financeiro: faturamento, despesas e lucro (`/financeiro`) — admin
- Usuários e permissões (`/usuarios`) — admin
- Autenticação e proteção de rotas via `src/middleware.ts` (cookies, `@supabase/ssr`)
- Tema visual verde/branco do Bebigás em `src/app/globals.css`

## 1. Pré-requisitos
- Node.js 20+
- Uma conta no [Supabase](https://supabase.com) (pode ser o mesmo projeto que já existia no Lovable, ou um novo)

## 2. Banco de dados (Supabase)
As migrações SQL já usadas no projeto original estão em `supabase/migrations/`.

**Se você já tem o projeto Supabase do Lovable:** não precisa fazer nada aqui — é só apontar as
variáveis de ambiente abaixo para o mesmo projeto, os dados e usuários continuam os mesmos.

**Se for um projeto novo:** rode as migrações pela CLI do Supabase ou copie e cole o conteúdo de
cada arquivo de `supabase/migrations/` (em ordem) no SQL Editor do painel do Supabase.

## 3. Variáveis de ambiente
Copie `.env.local.example` para `.env.local` e preencha com os dados do seu projeto Supabase
(painel → Project Settings → API):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-ou-publishable
```

## 4. Rodando localmente
```bash
npm install
npm run dev
```
Acesse http://localhost:3000 — crie a primeira conta em "Criar conta" (ela vira administrador
automaticamente). As contas seguintes entram como operador e podem ser promovidas em **Usuários**.

## 5. Deploy na Vercel
1. Suba este projeto para um repositório no GitHub/GitLab/Bitbucket.
2. Na Vercel: **New Project** → importe o repositório → o Next.js é detectado automaticamente
   (nenhuma configuração de build extra é necessária).
3. Em **Environment Variables**, adicione as mesmas duas variáveis do `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. Pronto — o middleware de autenticação e as páginas já funcionam nativamente no
   ambiente serverless da Vercel.

No painel do Supabase, em **Authentication → URL Configuration**, adicione a URL da Vercel
(ex: `https://seu-projeto.vercel.app`) em *Site URL* / *Redirect URLs* para o login funcionar em produção.

## Estrutura
```
src/
  app/                     rotas (App Router)
    (app)/                 grupo de rotas autenticadas (protegidas pelo middleware)
    auth/                  login/cadastro
  components/              AppShell, providers, componentes ui/ (shadcn)
  lib/
    supabase/              client.ts (navegador), server.ts (Server Components), types.ts (schema)
    auth.ts, loyalty.ts, format.ts
  middleware.ts            protege rotas e renova a sessão
supabase/migrations/       SQL do banco (tabelas, RLS, triggers)
```

## Notas técnicas da migração
- Trocado TanStack Router/Start por **Next.js App Router**; TanStack Query foi mantido para
  data-fetching no cliente.
- A sessão do Supabase agora fica em **cookies** (via `@supabase/ssr`), em vez de localStorage —
  necessário para o middleware e para funcionar corretamente em SSR/Vercel.
- Todos os componentes `shadcn/ui` foram copiados sem alterações (são independentes de framework).
- `npm run build` foi validado localmente sem erros antes da entrega.
