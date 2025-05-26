const bcrypt = require('bcrypt');

async function generateCorrectHashes() {
  try {
    console.log('Generating correct password hashes...\n');
    
    // Generate hash for livreurs (Password123!)
    const livreurPassword = 'Password123!';
    const livreurHash = await bcrypt.hash(livreurPassword, 12);
    console.log('LIVREURS password:', livreurPassword);
    console.log('LIVREURS hash:', livreurHash);
    
    // Verify livreur hash
    const livreurVerify = await bcrypt.compare(livreurPassword, livreurHash);
    console.log('LIVREURS verification:', livreurVerify);
    console.log('');
    
    // Generate hash for managers (Manager123!)
    const managerPassword = 'Manager123!';
    const managerHash = await bcrypt.hash(managerPassword, 12);
    console.log('MANAGERS password:', managerPassword);
    console.log('MANAGERS hash:', managerHash);
    
    // Verify manager hash
    const managerVerify = await bcrypt.compare(managerPassword, managerHash);
    console.log('MANAGERS verification:', managerVerify);
    console.log('');
    
    // Generate hash for admin (Admin123!)
    const adminPassword = 'Admin123!';
    const adminHash = await bcrypt.hash(adminPassword, 12);
    console.log('ADMIN password:', adminPassword);
    console.log('ADMIN hash:', adminHash);
    
    // Verify admin hash
    const adminVerify = await bcrypt.compare(adminPassword, adminHash);
    console.log('ADMIN verification:', adminVerify);
    console.log('');
    
    // Generate SQL update statements
    console.log('=== SQL UPDATE STATEMENTS ===');
    console.log(`-- Update LIVREURS with Password123!`);
    console.log(`UPDATE users SET password_hash = '${livreurHash}' WHERE username IN ('Mane', 'Diaby', 'Diallo', 'Aliou', 'Livreur 1', 'Livreur 2');`);
    console.log('');
    console.log(`-- Update MANAGERS with Manager123!`);
    console.log(`UPDATE users SET password_hash = '${managerHash}' WHERE username IN ('SALIOU', 'OUSMANE', 'DIDI', 'AMARY');`);
    console.log('');
    console.log(`-- Update ADMIN with Admin123!`);
    console.log(`UPDATE users SET password_hash = '${adminHash}' WHERE username = 'admin';`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

generateCorrectHashes(); 