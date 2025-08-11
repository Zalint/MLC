-- Script pour ajouter des clients de test dans la base de données
-- Ces clients permettront de tester la fonctionnalité de recherche et de pré-remplissage

-- Supprimer les clients de test existants (optionnel)
DELETE FROM orders WHERE client_name IN (
  'Jean Dupont (Test)',
  'Marie Martin (Test)',
  'Pierre Durand (Test)',
  'Sophie Bernard (Test)',
  'Michel Petit (Test)',
  'Claire Moreau (Test)',
  'André Leroy (Test)',
  'Isabelle Roux (Test)'
);

-- Ajouter des commandes de test pour créer des clients
-- Note: Vous devez remplacer 'USER_ID_HERE' par un ID d'utilisateur valide de votre base

-- Client 1: Jean Dupont (MATA)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('Jean Dupont (Test)', '773920001', '123 Rue de la Paix, Dakar', 'O.Foire', 'Sicap Liberté 2, Dakar', 'O.Foire', 5000.00, 1500.00, 'MATA', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '5 days'),
('Jean Dupont (Test)', '773920001', '123 Rue de la Paix, Dakar', 'O.Foire', 'Almadies, Dakar', 'O.Foire', 3500.00, 1500.00, 'MATA', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '3 days');

-- Client 2: Marie Martin (MLC)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('Marie Martin (Test)', '773920002', '456 Avenue Georges Bush, Dakar', 'Point E, Dakar', 'Yoff, Dakar', NULL, NULL, 1750.00, 'MLC', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '4 days'),
('Marie Martin (Test)', '773920002', '456 Avenue Georges Bush, Dakar', 'Fann, Dakar', 'Mermoz, Dakar', NULL, NULL, 1750.00, 'MLC', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '2 days');

-- Client 3: Pierre Durand (AUTRE)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('Pierre Durand (Test)', '773920003', '789 Boulevard de la Corniche, Dakar', 'Plateau, Dakar', 'Médina, Dakar', NULL, NULL, 2000.00, 'AUTRE', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '6 days'),
('Pierre Durand (Test)', '773920003', '789 Boulevard de la Corniche, Dakar', 'Gorée, Dakar', 'Plateau, Dakar', NULL, NULL, 2500.00, 'AUTRE', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '1 day');

-- Client 4: Sophie Bernard (MATA)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('Sophie Bernard (Test)', '773920004', '321 Rue des Ambassadeurs, Dakar', 'Sacre Coeur', 'Almadies, Dakar', 'Sacre Coeur', 4200.00, 1500.00, 'MATA', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '7 days'),
('Sophie Bernard (Test)', '773920004', '321 Rue des Ambassadeurs, Dakar', 'Sacre Coeur', 'Point E, Dakar', 'Sacre Coeur', 3800.00, 1500.00, 'MATA', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '5 days');

-- Client 5: Michel Petit (MLC)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('Michel Petit (Test)', '773920005', '654 Avenue Cheikh Anta Diop, Dakar', 'UCAD, Dakar', 'Fass, Dakar', NULL, NULL, 2000.00, 'MLC', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '8 days'),
('Michel Petit (Test)', '773920005', '654 Avenue Cheikh Anta Diop, Dakar', 'Fass, Dakar', 'UCAD, Dakar', NULL, NULL, 2000.00, 'MLC', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '4 days');

-- Client 6: Claire Moreau (AUTRE)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('Claire Moreau (Test)', '773920006', '987 Rue de la Plage, Dakar', 'Yoff, Dakar', 'Ngor, Dakar', NULL, NULL, 3000.00, 'AUTRE', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '9 days'),
('Claire Moreau (Test)', '773920006', '987 Rue de la Plage, Dakar', 'Ngor, Dakar', 'Yoff, Dakar', NULL, NULL, 3000.00, 'AUTRE', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '3 days');

-- Client 7: André Leroy (MATA)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('André Leroy (Test)', '773920007', '147 Rue du Commerce, Dakar', 'Mbao', 'Rufisque, Dakar', 'Mbao', 2800.00, 1500.00, 'MATA', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '10 days'),
('André Leroy (Test)', '773920007', '147 Rue du Commerce, Dakar', 'Mbao', 'Bargny, Dakar', 'Mbao', 3200.00, 1500.00, 'MATA', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '6 days');

-- Client 8: Isabelle Roux (MLC)
INSERT INTO orders (client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente, amount, course_price, order_type, created_by, created_at) VALUES
('Isabelle Roux (Test)', '773920008', '258 Avenue Léopold Sédar Senghor, Dakar', 'Gueule Tapée, Dakar', 'Colobane, Dakar', NULL, NULL, 1750.00, 'MLC', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '11 days'),
('Isabelle Roux (Test)', '773920008', '258 Avenue Léopold Sédar Senghor, Dakar', 'Colobane, Dakar', 'Gueule Tapée, Dakar', NULL, NULL, 1750.00, 'MLC', (SELECT id FROM users LIMIT 1), NOW() - INTERVAL '7 days');

-- Afficher un résumé des clients de test ajoutés
SELECT 
    'Clients de test ajoutés avec succès' as message,
    COUNT(DISTINCT client_name) as nombre_clients,
    COUNT(*) as nombre_commandes
FROM orders 
WHERE client_name LIKE '%(Test)%';

-- Afficher la liste des clients de test
SELECT 
    client_name,
    phone_number,
    COUNT(*) as nombre_commandes,
    MAX(created_at) as derniere_commande,
    STRING_AGG(DISTINCT order_type, ', ') as types_commandes
FROM orders 
WHERE client_name LIKE '%(Test)%'
GROUP BY client_name, phone_number
ORDER BY derniere_commande DESC; 