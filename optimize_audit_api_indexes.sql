-- ⚡ Optimisation des requêtes API Audit Client
-- Ce script ajoute des index pour accélérer les recherches par téléphone

-- Index sur phone_number pour les recherches de client
CREATE INDEX IF NOT EXISTS idx_orders_phone_number 
ON orders(phone_number);

-- Index composite pour filtrage rapide (téléphone + type + date)
CREATE INDEX IF NOT EXISTS idx_orders_phone_type_date 
ON orders(phone_number, order_type, created_at DESC);

-- Index sur order_type pour les filtres MATA
CREATE INDEX IF NOT EXISTS idx_orders_order_type 
ON orders(order_type);

-- Index sur created_at pour le tri par date
CREATE INDEX IF NOT EXISTS idx_orders_created_at 
ON orders(created_at DESC);

-- Index sur created_by pour les JOIN avec users
CREATE INDEX IF NOT EXISTS idx_orders_created_by 
ON orders(created_by);

-- Analyser les tables pour mettre à jour les statistiques
ANALYZE orders;
ANALYZE users;

-- Afficher les index créés
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'orders'
ORDER BY indexname;

