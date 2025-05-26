const bcrypt = require('bcrypt');

async function testHashDirect() {
  try {
    const password = 'Manager123!';
    const hashFromDB = '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    
    console.log('Testing password:', password);
    console.log('Against hash:', hashFromDB);
    
    const result = await bcrypt.compare(password, hashFromDB);
    console.log('Result:', result);
    
    if (!result) {
      console.log('❌ Hash verification failed!');
      
      // Let's generate a new hash and test it
      console.log('Generating new hash...');
      const newHash = await bcrypt.hash(password, 12);
      console.log('New hash:', newHash);
      
      const newResult = await bcrypt.compare(password, newHash);
      console.log('New hash test:', newResult);
    } else {
      console.log('✅ Hash verification successful!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testHashDirect(); 