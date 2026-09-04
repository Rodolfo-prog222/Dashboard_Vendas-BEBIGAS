-- BEBIDAS DESCONTINUADAS: desativa produtos categoria "bebida" e move Pudim para "sobremesa"
UPDATE public.products SET ativo = false WHERE categoria = 'bebida';
UPDATE public.products SET categoria = 'sobremesa' WHERE nome ILIKE 'Pudim%';
ALTER TABLE public.products ADD COLUMN terceirizado BOOLEAN NOT NULL DEFAULT false;

-- ESTOQUE (matéria-prima)
CREATE TABLE public.raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  estoque_atual NUMERIC(10,3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(10,3) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_materials TO authenticated;
GRANT ALL ON public.raw_materials TO service_role;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_materials_admin_all" ON public.raw_materials FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_raw_material_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER raw_materials_touch_updated_at BEFORE UPDATE ON public.raw_materials
FOR EACH ROW EXECUTE FUNCTION public.touch_raw_material_updated_at();
REVOKE ALL ON FUNCTION public.touch_raw_material_updated_at() FROM PUBLIC, anon, authenticated;

-- COMPRAS (entradas de matéria-prima)
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  quantidade NUMERIC(10,3) NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  fornecedor TEXT,
  data_compra DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_admin_all" ON public.purchases FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.apply_purchase_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.raw_materials
  SET estoque_atual = estoque_atual + NEW.quantidade,
      updated_at = now()
  WHERE id = NEW.raw_material_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchases_apply_stock AFTER INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_stock();
REVOKE ALL ON FUNCTION public.apply_purchase_stock() FROM PUBLIC, anon, authenticated;

-- FICHA TÉCNICA (matéria-prima consumida por unidade produzida de cada produto)
CREATE TABLE public.recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantidade NUMERIC(10,4) NOT NULL DEFAULT 0,
  UNIQUE (product_id, raw_material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_items TO authenticated;
GRANT ALL ON public.recipe_items TO service_role;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_items_admin_all" ON public.recipe_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PRODUÇÃO (log diário; decrementa estoque salvo se produto for terceirizado)
CREATE TABLE public.production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  produto_nome TEXT NOT NULL,
  quantidade NUMERIC(10,3) NOT NULL,
  data_producao DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production TO authenticated;
GRANT ALL ON public.production TO service_role;
ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_admin_all" ON public.production FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.apply_production_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_terceirizado BOOLEAN;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT terceirizado INTO is_terceirizado FROM public.products WHERE id = NEW.product_id;
  IF COALESCE(is_terceirizado, true) THEN
    RETURN NEW;
  END IF;

  UPDATE public.raw_materials rm
  SET estoque_atual = rm.estoque_atual - (ri.quantidade * NEW.quantidade),
      updated_at = now()
  FROM public.recipe_items ri
  WHERE ri.product_id = NEW.product_id AND rm.id = ri.raw_material_id;

  RETURN NEW;
END;
$$;
CREATE TRIGGER production_apply_stock AFTER INSERT ON public.production
FOR EACH ROW EXECUTE FUNCTION public.apply_production_stock();
REVOKE ALL ON FUNCTION public.apply_production_stock() FROM PUBLIC, anon, authenticated;
