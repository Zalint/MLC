-- Script de migration pour les adresses des commandes MATA
-- Ce script copie les adresses de l'ancienne colonne 'address' vers 'adresse_destination'
-- pour les commandes MATA où adresse_destination est vide

-- Afficher d'abord les commandes concernées
SELECT 
    id,
    client_name,
    order_type,
    address,
    adresse_source,
    adresse_destination,
    created_at
FROM orders 
WHERE order_type = 'MATA' 
  AND (adresse_destination IS NULL OR adresse_destination = '')
  AND address IS NOT NULL 
  AND address != '';

-- Mettre à jour les commandes MATA en copiant address vers adresse_destination
UPDATE orders 
SET adresse_destination = address
WHERE order_type = 'MATA' 
  AND (adresse_destination IS NULL OR adresse_destination = '')
  AND address IS NOT NULL 
  AND address != '';

-- Vérifier les résultats après migration
SELECT 
    'Migration terminée' as status,
    COUNT(*) as commandes_mises_a_jour
FROM orders 
WHERE order_type = 'MATA' 
  AND adresse_destination IS NOT NULL 
  AND adresse_destination != '';

-- Afficher quelques exemples après migration
SELECT 
    client_name,
    address as ancienne_adresse,
    adresse_destination as nouvelle_adresse_destination,
    created_at
FROM orders 
WHERE order_type = 'MATA'
  AND adresse_destination IS NOT NULL
ORDER BY created_at DESC
LIMIT 5; 