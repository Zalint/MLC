-- Migration: extension des types de commandes (Yango, Keur Balli)
-- A exécuter une seule fois sur la base de données existante

-- PostgreSQL ne permet pas de modifier une contrainte CHECK directement,
-- il faut la supprimer puis en recréer une nouvelle.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE orders
  ALTER COLUMN order_type TYPE VARCHAR(10),
  ADD CONSTRAINT orders_order_type_check
    CHECK (order_type IN ('MATA', 'MLC', 'YANGO', 'KEUR_BALLI', 'AUTRE'));
