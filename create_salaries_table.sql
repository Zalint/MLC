-- Créer la table des salaires avec historisation (PostgreSQL)
CREATE TABLE IF NOT EXISTS salaries (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    effective_date DATE NOT NULL,
    comment TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_salaries_user_id ON salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_salaries_effective_date ON salaries(effective_date);
CREATE INDEX IF NOT EXISTS idx_salaries_user_date ON salaries(user_id, effective_date);

-- Insérer quelques salaires d'exemple (optionnel)
-- Vous devrez remplacer les UUIDs par les vrais UUIDs de vos utilisateurs
-- INSERT INTO salaries (user_id, amount, effective_date, comment, created_by) 
-- VALUES 
-- ('uuid-du-livreur-1', 150000, '2024-01-01', 'Salaire initial', 'uuid-du-manager'),
-- ('uuid-du-livreur-2', 140000, '2024-01-01', 'Salaire initial', 'uuid-du-manager'); 