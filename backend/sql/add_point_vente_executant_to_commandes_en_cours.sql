-- Migration : ajout de la colonne point_vente_executant dans commandes_en_cours
-- Cette colonne stocke le point de vente qui exécute la livraison
-- (différent de point_vente, qui est le point de vente d'origine de la commande).
-- Optionnelle : les commandes existantes et celles dont l'API externe ne fournit
-- pas l'information auront NULL.

ALTER TABLE commandes_en_cours
    ADD COLUMN IF NOT EXISTS point_vente_executant VARCHAR(255);

COMMENT ON COLUMN commandes_en_cours.point_vente_executant IS
    'Point de vente qui exécute / livre la commande (peut différer du point de vente d''origine)';

DO $$
BEGIN
    RAISE NOTICE '✅ Colonne point_vente_executant ajoutée à commandes_en_cours';
END $$;
