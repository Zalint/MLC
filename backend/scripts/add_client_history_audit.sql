-- Migration: Ajout de la table d'audit pour les consultations d'historique client
-- Date: 2025-11-17
-- Description: Track qui consulte l'historique des clients et pendant combien de temps

-- Activer l'extension UUID si ce n'est pas déjà fait
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table d'audit pour les consultations d'historique client
CREATE TABLE IF NOT EXISTS client_history_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Qui a consulté ?
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    
    -- Quel client a été consulté ?
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    
    -- Quand et combien de temps ?
    opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP,
    duration_seconds INTEGER,
    
    -- Informations additionnelles
    orders_count INTEGER DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Index pour les recherches rapides
    CONSTRAINT client_history_audit_user_id_idx FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON client_history_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_client_phone ON client_history_audit(client_phone);
CREATE INDEX IF NOT EXISTS idx_audit_opened_at ON client_history_audit(opened_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_role ON client_history_audit(user_role);
CREATE INDEX IF NOT EXISTS idx_audit_duration ON client_history_audit(duration_seconds);

-- Commentaires pour la documentation
COMMENT ON TABLE client_history_audit IS 'Audit des consultations d''historique client';
COMMENT ON COLUMN client_history_audit.user_id IS 'ID de l''utilisateur qui a consulté';
COMMENT ON COLUMN client_history_audit.client_phone IS 'Numéro de téléphone du client consulté';
COMMENT ON COLUMN client_history_audit.opened_at IS 'Moment où l''historique a été ouvert';
COMMENT ON COLUMN client_history_audit.closed_at IS 'Moment où l''historique a été fermé';
COMMENT ON COLUMN client_history_audit.duration_seconds IS 'Durée de consultation en secondes';

-- Vue pour faciliter les requêtes avec les noms complets
CREATE OR REPLACE VIEW v_client_history_audit AS
SELECT 
    a.id,
    a.user_id,
    a.username,
    a.user_role,
    a.client_name,
    a.client_phone,
    a.opened_at,
    a.closed_at,
    a.duration_seconds,
    a.orders_count,
    a.total_amount,
    CASE 
        WHEN a.duration_seconds IS NULL THEN 'En cours'
        WHEN a.duration_seconds < 60 THEN 'Rapide (< 1 min)'
        WHEN a.duration_seconds < 180 THEN 'Normal (1-3 min)'
        WHEN a.duration_seconds < 600 THEN 'Long (3-10 min)'
        ELSE 'Très long (> 10 min)'
    END as duration_category,
    a.created_at
FROM client_history_audit a
ORDER BY a.opened_at DESC;

COMMENT ON VIEW v_client_history_audit IS 'Vue enrichie des audits avec catégorisation de durée';

-- Message de confirmation
SELECT 'Table client_history_audit créée avec succès!' as message;

