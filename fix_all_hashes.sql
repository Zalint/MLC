-- Fix all password hashes for Matix Livreur users
-- This script updates all user passwords with the correct bcrypt hashes

-- Update LIVREURS with Password123! (hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki)
UPDATE users SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki' 
WHERE username IN ('Mane', 'Diaby', 'Diallo', 'Aliou', 'Livreur 1', 'Livreur 2');

-- Update MANAGERS with Manager123! (hash: $2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi)
UPDATE users SET password_hash = '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' 
WHERE username IN ('SALIOU', 'OUSMANE', 'DIDI', 'AMARY');

-- Update ADMIN with Admin123! (hash: $2b$12$6BNUOWmnLGDO7tmGrHyUBOogFLrTnQI00ih6lBGvxJ2IqhG9NQ1dS)
UPDATE users SET password_hash = '$2b$12$6BNUOWmnLGDO7tmGrHyUBOogFLrTnQI00ih6lBGvxJ2IqhG9NQ1dS' 
WHERE username = 'admin';

-- Update the updated_at timestamp
UPDATE users SET updated_at = NOW();

-- Verify the updates
SELECT username, role, 
       CASE 
         WHEN role = 'LIVREUR' THEN 'Password123!'
         WHEN role = 'MANAGER' THEN 'Manager123!'
         WHEN role = 'ADMIN' THEN 'Admin123!'
       END as expected_password,
       LEFT(password_hash, 20) || '...' as hash_preview,
       updated_at
FROM users 
ORDER BY role, username;

-- Show count of users by role
SELECT role, COUNT(*) as user_count 
FROM users 
GROUP BY role 
ORDER BY role; 