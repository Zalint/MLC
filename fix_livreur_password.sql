-- ================================================
-- FIX PASSWORD LIVREURS - Password123!
-- Hash vérifié et fonctionnel: $2b$12$DpFgC3rEBSBJx6f6T8kGWuthXnlp6hz9o7Lq6kl5bI60ouFG9cvxG
-- ================================================

UPDATE users 
SET password_hash = '$2b$12$DpFgC3rEBSBJx6f6T8kGWuthXnlp6hz9o7Lq6kl5bI60ouFG9cvxG'
WHERE username IN ('Mane', 'Diallo', 'Diaby', 'Aliou');

-- Vérification
SELECT 
    username, 
    role,
    CASE 
        WHEN password_hash = '$2b$12$DpFgC3rEBSBJx6f6T8kGWuthXnlp6hz9o7Lq6kl5bI60ouFG9cvxG' 
        THEN '✅ Password mis à jour' 
        ELSE '❌ Erreur'
    END as status
FROM users 
WHERE username IN ('Mane', 'Diallo', 'Diaby', 'Aliou')
ORDER BY username;
