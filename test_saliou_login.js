const bcrypt = require('bcrypt');
const db = require('./backend/models/database');

async function testSaliouLogin() {
  try {
    console.log('🔍 Testing SALIOU login...');
    
    // Get SALIOU's data from database
    const result = await db.query('SELECT * FROM users WHERE username = $1', ['SALIOU']);
    
    if (result.rows.length === 0) {
      console.log('❌ SALIOU not found in database');
      return;
    }
    
    const user = result.rows[0];
    console.log('✅ SALIOU found:', {
      id: user.id,
      username: user.username,
      role: user.role,
      hash_preview: user.password_hash.substring(0, 20) + '...'
    });
    
    // Test the password
    const testPassword = 'Manager123!';
    console.log('🔑 Testing password:', testPassword);
    
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log('🔑 Password verification result:', isValid);
    
    if (isValid) {
      console.log('✅ SUCCESS: Password is correct!');
    } else {
      console.log('❌ FAILED: Password is incorrect');
      
      // Let's also test what the hash should be
      console.log('🔧 Generating new hash for comparison...');
      const newHash = await bcrypt.hash(testPassword, 12);
      console.log('New hash:', newHash);
      
      const testNewHash = await bcrypt.compare(testPassword, newHash);
      console.log('New hash test:', testNewHash);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSaliouLogin(); 