const bcrypt = require('bcrypt');
const db = require('./models/database');

async function generateAndUpdateHash() {
  try {
    console.log('Generating new hash for Password123!...');
    const newHash = await bcrypt.hash('Password123!', 12);
    console.log('NEW HASH:', newHash);
    
    // Test the new hash immediately
    const testResult = await bcrypt.compare('Password123!', newHash);
    console.log('Test result:', testResult);
    
    if (testResult) {
      // Update in database
      await db.query('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, 'Mane']);
      console.log('✅ Hash updated in database for Mane');
      console.log('SQL for manual update:');
      console.log(`UPDATE users SET password_hash = '${newHash}' WHERE username = 'Mane';`);
    } else {
      console.log('❌ Hash test failed!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateAndUpdateHash(); 