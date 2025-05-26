const db = require('./models/database');
const bcrypt = require('bcrypt');

async function fixManePassword() {
  try {
    // Check current hash
    const current = await db.query('SELECT password_hash FROM users WHERE username = $1', ['Mane']);
    console.log('Current hash:', current.rows[0].password_hash);
    
    // The correct hash for Password123!
    const correctHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Ki';
    
    // Update the hash
    await db.query('UPDATE users SET password_hash = $1 WHERE username = $2', [correctHash, 'Mane']);
    console.log('✅ Hash updated for Mane');
    
    // Test the new hash
    const testResult = await bcrypt.compare('Password123!', correctHash);
    console.log('🔐 Test result:', testResult);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixManePassword(); 