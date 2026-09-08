-- CUSTEIO AUTOMÁTICO POR FICHA TÉCNICA + ESTOQUE DE PRODUTO VENDÁVEL
--
-- A partir de agora, recipe_items representa os ingredientes do LOTE inteiro da
-- receita (não mais "por unidade produzida"); products.rendimento diz quantas
-- unidades/porções aquele lote rende. O padrão rendimento=1 mantém compatibilidade
-- com fichas já cadastradas (equivalente ao comportamento anterior).

ALTER TABLE public.products
  ADD COLUMN rendimento NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (rendimento > 0),
  ADD COLUMN estoque_atual NUMERIC(10,3) NOT NULL DEFAULT 0;

-- Compras passam a poder mirar em matéria-prima OU em produto pronto (revenda/terceirizado).
ALTER TABLE public.purchases
  ALTER COLUMN raw_material_id DROP NOT NULL,
  ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  ADD CONSTRAINT purchases_target_check CHECK (
    (raw_material_id IS NOT NULL AND product_id IS NULL) OR
    (raw_material_id IS NULL AND product_id IS NOT NULL)
  );

-- Custo unitário mais recente de cada matéria-prima (preço da última compra).
CREATE OR REPLACE FUNCTION public.get_raw_materials_last_cost()
RETURNS TABLE (raw_material_id UUID, custo NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (rm.id) rm.id, pu.preco_unitario
  FROM public.raw_materials rm
  LEFT JOIN public.purchases pu ON pu.raw_material_id = rm.id
  ORDER BY rm.id, pu.data_compra DESC NULLS LAST, pu.created_at DESC NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.get_raw_materials_last_cost() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_raw_materials_last_cost() TO authenticated;

-- Custo calculado de cada produto: terceirizado usa o preço da compra mais recente
-- desse produto (ou o custo manual, se ainda não foi comprado); os demais somam o
-- custo do lote da ficha técnica (ingrediente x preço mais recente da matéria-prima)
-- e dividem pelo rendimento.
CREATE OR REPLACE FUNCTION public.get_products_custo()
RETURNS TABLE (product_id UUID, custo NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  FROM public.products p;
$$;
REVOKE ALL ON FUNCTION public.get_products_custo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_products_custo() TO authenticated;

-- Compra de matéria-prima soma no estoque da matéria-prima; compra de produto
-- (revenda/terceirizado) soma direto no estoque vendável do produto.
CREATE OR REPLACE FUNCTION public.apply_purchase_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_material_id IS NOT NULL THEN
    UPDATE public.raw_materials
    SET estoque_atual = estoque_atual + NEW.quantidade,
        updated_at = now()
    WHERE id = NEW.raw_material_id;
  ELSE
    UPDATE public.products
    SET estoque_atual = estoque_atual + NEW.quantidade
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Produção consome matéria-prima na fração de lotes produzidos (quantidade /
-- rendimento) e sempre soma a quantidade produzida no estoque vendável do produto.
CREATE OR REPLACE FUNCTION public.apply_production_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_terceirizado BOOLEAN;
  rendimento_lote NUMERIC;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT terceirizado, rendimento INTO is_terceirizado, rendimento_lote
  FROM public.products WHERE id = NEW.product_id;

  IF NOT COALESCE(is_terceirizado, true) THEN
    UPDATE public.raw_materials rm
    SET estoque_atual = rm.estoque_atual - (ri.quantidade * (NEW.quantidade / rendimento_lote)),
        updated_at = now()
    FROM public.recipe_items ri
    WHERE ri.product_id = NEW.product_id AND rm.id = ri.raw_material_id;
  END IF;

  UPDATE public.products
  SET estoque_atual = estoque_atual + NEW.quantidade
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

-- Bloqueia a venda de um item além do estoque disponível do produto (trava a
-- linha para evitar corrida entre vendas simultâneas) e decrementa o estoque.
CREATE OR REPLACE FUNCTION public.apply_sale_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  disponivel NUMERIC;
  nome_produto TEXT;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT estoque_atual, nome INTO disponivel, nome_produto
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF disponivel IS NULL THEN
    RETURN NEW;
  END IF;

  IF disponivel < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, solicitado %', nome_produto, disponivel, NEW.quantidade;
  END IF;

  UPDATE public.products SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_items_apply_stock AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.apply_sale_stock();
REVOKE ALL ON FUNCTION public.apply_sale_stock() FROM PUBLIC, anon, authenticated;
