const bcrypt = require('bcrypt');

const password = 'Password123!';
const saltRounds = 12;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('❌ Erreur:', err);
    return;
  }
  
  console.log('\n✅ Hash généré pour le mot de passe:', password);
  console.log('📋 Hash:', hash);
  console.log('\n📝 SQL à exécuter:');
  console.log(`
UPDATE users 
SET password_hash = '${hash}'
WHERE username IN ('Mane', 'Diallo', 'Diaby', 'Aliou');

SELECT username, role FROM users WHERE username IN ('Mane', 'Diallo');
  `);
  
  // Vérifier que le hash fonctionne
  bcrypt.compare(password, hash, (err, result) => {
    if (result) {
      console.log('\n✅ Vérification: Le hash fonctionne correctement!');
    } else {
      console.log('\n❌ Erreur: Le hash ne fonctionne pas');
    }
  });
});
