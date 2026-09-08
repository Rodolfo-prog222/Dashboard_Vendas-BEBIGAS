-- Mais casas decimais no fator de conversão, pra representar razões como 7/3
-- (2,33333333...) sem perder precisão perceptível.
ALTER TABLE public.products
  ALTER COLUMN fator_conversao TYPE NUMERIC(14,8);

-- Corrige o valor já cadastrado da Maionese Grande (era 2,33 — arredondamento
-- manual de 7 unidades pequenas a cada 3 grandes) para a razão exata.
UPDATE public.products
SET fator_conversao = 7.0 / 3.0
WHERE nome = 'Maionese Grande' AND base_product_id IS NOT NULL;
