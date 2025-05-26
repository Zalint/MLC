-- Script de seed pour Matix Livreur
-- Insertion des comptes par défaut

-- Suppression des données existantes (optionnel, pour reset)
-- DELETE FROM orders;
-- DELETE FROM users;

-- Insertion des livreurs
-- Mot de passe: Password123! (hashé avec bcrypt, 12 rounds)
-- Hash généré: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki
INSERT INTO users (username, password_hash, role) VALUES
('Mane', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki', 'LIVREUR'),
('Diaby', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki', 'LIVREUR'),
('Diallo', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki', 'LIVREUR'),
('Aliou', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki', 'LIVREUR'),
('Livreur 1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki', 'LIVREUR'),
('Livreur 2', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki', 'LIVREUR')
ON CONFLICT (username) DO NOTHING;

-- Insertion des managers
-- Mot de passe: Manager123! (hashé avec bcrypt, 12 rounds)
-- Hash généré: $2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
INSERT INTO users (username, password_hash, role) VALUES
('SALIOU', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'MANAGER'),
('OUSMANE', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'MANAGER'),
('DIDI', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'MANAGER'),
('AMARY', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'MANAGER')
ON CONFLICT (username) DO NOTHING;

-- Insertion d'un admin par défaut (optionnel)
-- Mot de passe: Admin123! (hashé avec bcrypt, 12 rounds)
-- Hash généré: $2b$12$6BNUOWmnLGDO7tmGrHyUBOogFLrTnQI00ih6lBGvxJ2IqhG9NQ1dS
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2b$12$6BNUOWmnLGDO7tmGrHyUBOogFLrTnQI00ih6lBGvxJ2IqhG9NQ1dS', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- Affichage des utilisateurs créés
SELECT username, role, created_at FROM users ORDER BY role, username; 