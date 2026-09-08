-- VARIAÇÕES DE TAMANHO: um produto pode ser um múltiplo de outro (ex.: "Grande" =
-- 2,33x "Pequeno"), compartilhando o mesmo estoque físico do produto base.

ALTER TABLE public.products
  ADD COLUMN base_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN fator_conversao NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (fator_conversao > 0),
  ADD CONSTRAINT products_base_not_self CHECK (base_product_id IS DISTINCT FROM id);

-- Impede encadeamento (variação de variação), nos dois sentidos: o produto base
-- escolhido não pode já ser uma variação, e um produto que já serve de base para
-- outro não pode virar variação de um terceiro.
CREATE OR REPLACE FUNCTION public.prevent_chained_base_product()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_of_base UUID;
  used_as_base BOOLEAN;
BEGIN
  IF NEW.base_product_id IS NOT NULL THEN
    SELECT base_product_id INTO base_of_base FROM public.products WHERE id = NEW.base_product_id;
    IF base_of_base IS NOT NULL THEN
      RAISE EXCEPTION 'Produto base não pode ser, ele mesmo, uma variação de outro produto.';
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.products WHERE base_product_id = NEW.id) INTO used_as_base;
    IF used_as_base THEN
      RAISE EXCEPTION 'Este produto já é usado como base de outra variação — não pode virar variação também.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_prevent_chained_base BEFORE INSERT OR UPDATE OF base_product_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.prevent_chained_base_product();
REVOKE ALL ON FUNCTION public.prevent_chained_base_product() FROM PUBLIC, anon, authenticated;

-- Uma variação não tem ficha técnica própria (usa a do produto base).
CREATE OR REPLACE FUNCTION public.prevent_variant_recipe()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  has_base UUID;
BEGIN
  SELECT base_product_id INTO has_base FROM public.products WHERE id = NEW.product_id;
  IF has_base IS NOT NULL THEN
    RAISE EXCEPTION 'Este produto é uma variação de outro — não pode ter ficha técnica própria.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER recipe_items_prevent_variant BEFORE INSERT ON public.recipe_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_variant_recipe();
REVOKE ALL ON FUNCTION public.prevent_variant_recipe() FROM PUBLIC, anon, authenticated;

-- Custo: variação = custo do produto base × fator_conversao; senão, mesma regra de
-- antes (terceirizado usa preço de compra do próprio produto; senão, ficha técnica).
CREATE OR REPLACE FUNCTION public.get_products_custo()
RETURNS TABLE (product_id UUID, custo NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base_custo AS (
    SELECT
      p.id,
      CASE
        WHEN p.terceirizado THEN COALESCE(
          (SELECT pu.preco_unitario FROM public.purchases pu
           WHERE pu.product_id = p.id
           ORDER BY pu.data_compra DESC, pu.created_at DESC
           LIMIT 1),
          p.custo
        )
        ELSE (
          SELECT COALESCE(SUM(ri.quantidade * COALESCE(lc.custo, 0)), 0) / p.rendimento
          FROM public.recipe_items ri
          LEFT JOIN LATERAL (
            SELECT pu.preco_unitario AS custo
            FROM public.purchases pu
            WHERE pu.raw_material_id = ri.raw_material_id
            ORDER BY pu.data_compra DESC, pu.created_at DESC
            LIMIT 1
          ) lc ON true
          WHERE ri.product_id = p.id
        )
      END AS custo
    FROM public.products p
    WHERE p.base_product_id IS NULL
  )
  SELECT
    p.id,
    CASE
      WHEN p.base_product_id IS NOT NULL THEN
        (SELECT bc.custo FROM base_custo bc WHERE bc.id = p.base_product_id) * p.fator_conversao
      ELSE bc.custo
    END AS custo
  FROM public.products p
  LEFT JOIN base_custo bc ON bc.id = p.id;
$$;

-- Estoque de venda: uma variação não tem estoque próprio — a trava e o desconto
-- passam a mirar sempre no produto base (ou no próprio produto, se não for variação),
-- na quantidade equivalente (quantidade vendida x fator_conversao).
CREATE OR REPLACE FUNCTION public.apply_sale_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alvo_id UUID;
  fator NUMERIC;
  qtd_equivalente NUMERIC;
  disponivel NUMERIC;
  nome_produto TEXT;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(base_product_id, id), COALESCE(fator_conversao, 1), nome
  INTO alvo_id, fator, nome_produto
  FROM public.products
  WHERE id = NEW.product_id;

  IF alvo_id IS NULL THEN
    RETURN NEW;
  END IF;

  qtd_equivalente := NEW.quantidade * fator;

  SELECT estoque_atual INTO disponivel
  FROM public.products
  WHERE id = alvo_id
  FOR UPDATE;

  IF disponivel < qtd_equivalente THEN
    RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, solicitado % (equivalente)', nome_produto, disponivel, qtd_equivalente;
  END IF;

  UPDATE public.products SET estoque_atual = estoque_atual - qtd_equivalente WHERE id = alvo_id;

  RETURN NEW;
END;
$$;
