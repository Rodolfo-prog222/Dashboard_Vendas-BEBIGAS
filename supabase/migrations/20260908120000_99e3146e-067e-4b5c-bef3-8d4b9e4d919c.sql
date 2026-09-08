-- Impede que um usuário não-admin reative/desative a própria conta via update direto em profiles.
-- (o middleware bloqueia login de contas inativas; isso fecha a brecha no nível do banco)
CREATE OR REPLACE FUNCTION public.enforce_profiles_ativo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.ativo := OLD.ativo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_enforce_ativo
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profiles_ativo();

-- Agrega o saldo de pontos de fidelidade no banco em vez de trazer a tabela inteira
-- de loyalty_transactions para o cliente somar (fica caro conforme o histórico cresce).
CREATE OR REPLACE FUNCTION public.get_loyalty_balances()
RETURNS TABLE (customer_id UUID, saldo BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT customer_id, SUM(pontos)::BIGINT AS saldo
  FROM public.loyalty_transactions
  GROUP BY customer_id;
$$;
REVOKE ALL ON FUNCTION public.get_loyalty_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loyalty_balances() TO authenticated;

-- Conta clientes recorrentes (2+ vendas) no banco, sem trazer customer_id de todas as vendas.
CREATE OR REPLACE FUNCTION public.get_recurring_customers_count()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*) FROM (
    SELECT customer_id
    FROM public.sales
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
    HAVING COUNT(*) >= 2
  ) t;
$$;
REVOKE ALL ON FUNCTION public.get_recurring_customers_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recurring_customers_count() TO authenticated;

-- Alinha os GRANTs com as policies reais: não existe policy de UPDATE para essas
-- tabelas (e o app nunca atualiza essas linhas), então o GRANT de UPDATE é morto.
REVOKE UPDATE ON public.sale_items FROM authenticated;
REVOKE UPDATE ON public.sale_payments FROM authenticated;
