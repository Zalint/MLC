-- Création de la table subscriptions pour les cartes d'abonnement MLC
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    card_number VARCHAR(20) UNIQUE NOT NULL,
    total_deliveries INTEGER NOT NULL DEFAULT 10,
    used_deliveries INTEGER NOT NULL DEFAULT 0,
    remaining_deliveries INTEGER NOT NULL DEFAULT 10,
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT check_deliveries_positive CHECK (total_deliveries > 0),
    CONSTRAINT check_used_deliveries_valid CHECK (used_deliveries >= 0 AND used_deliveries <= total_deliveries),
    CONSTRAINT check_remaining_deliveries_valid CHECK (remaining_deliveries >= 0 AND remaining_deliveries <= total_deliveries),
    CONSTRAINT check_deliveries_sum CHECK (used_deliveries + remaining_deliveries = total_deliveries),
    CONSTRAINT check_expiry_after_purchase CHECK (expiry_date > purchase_date)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone_number ON subscriptions(phone_number);
CREATE INDEX IF NOT EXISTS idx_subscriptions_card_number ON subscriptions(card_number);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active, remaining_deliveries, expiry_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_by ON subscriptions(created_by);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry_date ON subscriptions(expiry_date);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();

-- Commentaires pour la documentation
COMMENT ON TABLE subscriptions IS 'Table pour gérer les cartes d''abonnement MLC avec 10 livraisons';
COMMENT ON COLUMN subscriptions.card_number IS 'Numéro unique de la carte au format MLC-YYYY-NNNN';
COMMENT ON COLUMN subscriptions.total_deliveries IS 'Nombre total de livraisons sur la carte (généralement 10)';
COMMENT ON COLUMN subscriptions.used_deliveries IS 'Nombre de livraisons déjà utilisées';
COMMENT ON COLUMN subscriptions.remaining_deliveries IS 'Nombre de livraisons restantes';
COMMENT ON COLUMN subscriptions.expiry_date IS 'Date d''expiration de la carte';
COMMENT ON COLUMN subscriptions.is_active IS 'Indique si la carte est active (peut être désactivée manuellement)'; 