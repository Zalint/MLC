const bcrypt = require('bcrypt');

async function generateHashes() {
    const password = 'mlc2024';
    const saltRounds = 12;
    
    console.log('Generating bcrypt hashes for initial users...\n');
    
    try {
        const hash1 = await bcrypt.hash(password, saltRounds);
        const hash2 = await bcrypt.hash(password, saltRounds);
        const hash3 = await bcrypt.hash(password, saltRounds);
        
        console.log('Password:', password);
        console.log('Salt rounds:', saltRounds);
        console.log('\nGenerated hashes:');
        console.log('ADMIN hash:', hash1);
        console.log('SALIOU hash:', hash2);
        console.log('OUSMANE hash:', hash3);
        
        console.log('\nSQL INSERT statement with generated hashes:');
        console.log(`
INSERT INTO users (id, username, password_hash, role, is_active) VALUES
    (uuid_generate_v4(), 'ADMIN', '${hash1}', 'ADMIN', true),
    (uuid_generate_v4(), 'SALIOU', '${hash2}', 'MANAGER', true),
    (uuid_generate_v4(), 'OUSMANE', '${hash3}', 'MANAGER', true)
ON CONFLICT (username) DO NOTHING;
        `);
        
    } catch (error) {
        console.error('Error generating hashes:', error);
    }
}

generateHashes(); 