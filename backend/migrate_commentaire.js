const db = require('./models/database');

async function addCommentaireColumn() {
  try {
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS commentaire TEXT;');
    console.log('✅ Colonne commentaire ajoutée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout de la colonne commentaire:', error);
    process.exit(1);
  }
}

addCommentaireColumn(); 