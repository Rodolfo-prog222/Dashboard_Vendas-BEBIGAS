-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','operador');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "roles_admin_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());

-- new user handler: first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_admin BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_admin;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN has_admin THEN 'operador'::public.app_role ELSE 'admin'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'bebida',
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo NUMERIC(10,2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'un',
  disponivel_hoje BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_admin_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "products_admin_update" ON public.products FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "products_admin_delete" ON public.products FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  preco_antigo NUMERIC(10,2),
  preco_novo NUMERIC(10,2) NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_admin_select" ON public.price_history FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "price_history_admin_insert" ON public.price_history FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.preco IS DISTINCT FROM OLD.preco THEN
    INSERT INTO public.price_history (product_id, preco_antigo, preco_novo, changed_by)
    VALUES (NEW.id, OLD.preco, NEW.preco, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_price_change BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_price_change();

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  nascimento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select_auth" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert_auth" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update_auth" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_admin_delete" ON public.customers FOR DELETE TO authenticated USING (public.is_admin());

-- SALES
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_venda DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em preparo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_select_auth" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_insert_auth" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sales_update_auth" ON public.sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sales_admin_delete" ON public.sales FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  produto_nome TEXT NOT NULL,
  quantidade NUMERIC(10,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items_select_auth" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sale_items_insert_auth" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sale_items_admin_delete" ON public.sale_items FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  metodo TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_payments_select_auth" ON public.sale_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "sale_payments_insert_auth" ON public.sale_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sale_payments_admin_delete" ON public.sale_payments FOR DELETE TO authenticated USING (public.is_admin());

-- LOYALTY
CREATE TABLE public.loyalty_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pontos_por_real NUMERIC(10,2) NOT NULL DEFAULT 1,
  pontos_para_resgate INT NOT NULL DEFAULT 100,
  recompensa TEXT NOT NULL DEFAULT 'R$ 10 de desconto',
  valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_settings_select_auth" ON public.loyalty_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "loyalty_settings_admin_update" ON public.loyalty_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "loyalty_settings_admin_insert" ON public.loyalty_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
INSERT INTO public.loyalty_settings (id) VALUES (1);

CREATE TABLE public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  pontos INT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'acumulo',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_tx_select_auth" ON public.loyalty_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "loyalty_tx_insert_auth" ON public.loyalty_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- EXPENSES (admin only)
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'insumos',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_admin_all" ON public.expenses FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SEED PRODUCTS
INSERT INTO public.products (nome, categoria, preco, custo, unidade) VALUES
('Frango Assado','comida',45.00,28.00,'un'),
('Costela de Vaca Assada','comida',95.00,60.00,'kg'),
('Costela de Porco Assada','comida',75.00,45.00,'kg'),
('Maionese','comida',18.00,8.00,'porção'),
('Feijão Tropeiro','comida',20.00,9.00,'porção'),
('Pudim','comida',15.00,6.00,'un'),
('Feijoada','comida',35.00,18.00,'porção'),
('Batata Assada','comida',15.00,6.00,'porção'),
('Porção de Arroz','comida',12.00,4.00,'porção'),
('Cerveja Lata 350ml','bebida',5.50,3.80,'un'),
('Refrigerante 2L','bebida',10.00,7.00,'un'),
('Água Mineral 500ml','bebida',3.00,1.50,'un'),
('Gelo 5kg','bebida',12.00,7.00,'un');