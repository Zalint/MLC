-- Fix password hashes with CORRECT bcrypt hashes
-- Generated on 2025-05-26

-- Update LIVREURS with Password123!
UPDATE users SET password_hash = '$2b$12$FYho3eVPFsJErZg1pJT3O.v3yrQHfkK1WDHPqIYkSGbTtTfErSDr6' 
WHERE username IN ('Mane', 'Diaby', 'Diallo', 'Aliou', 'Livreur 1', 'Livreur 2');

-- Update MANAGERS with Manager123!
UPDATE users SET password_hash = '$2b$12$ORbJavsAReKpvABNs3Fb0O7t1MroY1D53CJRju9KIkga8PmpNY85e' 
WHERE username IN ('SALIOU', 'OUSMANE', 'DIDI', 'AMARY');

-- Update ADMIN with Admin123!
UPDATE users SET password_hash = '$2b$12$/.tXiYHzdxoFk.nd8rLZcOeDaz0xtmfiJEVh1iCRj6eGt7iOT.j92' 
WHERE username = 'admin';

-- Update timestamps
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