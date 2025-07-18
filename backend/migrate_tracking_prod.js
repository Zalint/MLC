// ===== MIGRATION TRACKING CONFIG PRODUCTION =====
// Date: 2025-01-18
// Description: Ajout configuration heures tracking GPS 7j/7
// Usage: node migrate_tracking_prod.js

const { Pool } = require('pg');

// Configuration pour la production (variables d'environnement)
const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST,
  port: process.env.DB_PORT || process.env.PGPORT || 5432,
  database: process.env.DB_NAME || process.env.PGDATABASE,
  user: process.env.DB_USER || process.env.PGUSER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateTrackingConfig() {
  let client;
  
  try {
    console.log('🚀 Début de la migration tracking config...\n');
    
    client = await pool.connect();
    
    // Commencer une transaction
    await client.query('BEGIN');
    console.log('📝 Transaction démarrée');
    
    // 1. Ajouter les nouvelles colonnes
    console.log('\n1️⃣ Ajout des colonnes de tracking...');
    
    const addColumnsQueries = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_start_hour INTEGER DEFAULT 9',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_end_hour INTEGER DEFAULT 21',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_timezone VARCHAR(50) DEFAULT \'Africa/Dakar\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_enabled_days VARCHAR(20) DEFAULT \'0,1,2,3,4,5,6\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_tracking_active BOOLEAN DEFAULT true'
    ];
    
    for (const query of addColumnsQueries) {
      await client.query(query);
      console.log('  ✅', query.split(' ')[5]); // Affiche le nom de la colonne
    }
    
    // 2. Mettre à jour les livreurs existants
    console.log('\n2️⃣ Configuration 7j/7 pour tous les livreurs...');
    
    const updateResult = await client.query(`
      UPDATE users 
      SET 
        tracking_start_hour = 9,
        tracking_end_hour = 21,
        tracking_timezone = 'Africa/Dakar',
        tracking_enabled_days = '0,1,2,3,4,5,6',
        gps_tracking_active = true
      WHERE role = 'LIVREUR' 
        AND (tracking_start_hour IS NULL OR tracking_enabled_days != '0,1,2,3,4,5,6')
      RETURNING username
    `);
    
    console.log(`  ✅ ${updateResult.rowCount} livreurs mis à jour`);
    updateResult.rows.forEach(row => {
      console.log(`     - ${row.username}`);
    });
    
    // 3. Créer l'index
    console.log('\n3️⃣ Création de l\'index de performance...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_tracking_config 
      ON users(role, gps_tracking_active, tracking_start_hour, tracking_end_hour)
    `);
    console.log('  ✅ Index idx_users_tracking_config créé');
    
    // 4. Vérification finale
    console.log('\n4️⃣ Vérification de la migration...');
    
    const verificationResult = await client.query(`
      SELECT 
        COUNT(*) as total_livreurs,
        COUNT(CASE WHEN tracking_enabled_days = '0,1,2,3,4,5,6' THEN 1 END) as config_7j7,
        COUNT(CASE WHEN gps_tracking_active = true THEN 1 END) as tracking_actif
      FROM users 
      WHERE role = 'LIVREUR'
    `);
    
    const stats = verificationResult.rows[0];
    console.log(`  📊 Livreurs total: ${stats.total_livreurs}`);
    console.log(`  ⚙️ Configurations 7j/7: ${stats.config_7j7}`);
    console.log(`  🟢 Tracking actif: ${stats.tracking_actif}`);
    
    if (stats.total_livreurs === stats.config_7j7 && stats.total_livreurs === stats.tracking_actif) {
      console.log('  🎯 SUCCESS: Tous les livreurs configurés correctement !');
    } else {
      console.log('  ⚠️ ATTENTION: Configuration incomplète détectée');
    }
    
    // 5. Afficher la configuration finale
    console.log('\n5️⃣ Configuration finale des livreurs:');
    
    const finalConfig = await client.query(`
      SELECT 
        username,
        tracking_start_hour || 'h-' || tracking_end_hour || 'h' as horaires,
        tracking_enabled_days as jours,
        CASE 
          WHEN tracking_enabled_days = '0,1,2,3,4,5,6' THEN '✅ 7j/7'
          ELSE '⚠️ Partiel'
        END as statut_jours,
        CASE 
          WHEN gps_tracking_active THEN '🟢 Actif'
          ELSE '🔴 Inactif'
        END as statut_gps
      FROM users 
      WHERE role = 'LIVREUR' 
      ORDER BY username
    `);
    
    finalConfig.rows.forEach(row => {
      console.log(`  ${row.username}: ${row.horaires} | ${row.statut_jours} | ${row.statut_gps}`);
    });
    
    // Valider la transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction validée');
    
    console.log('\n🎉 MIGRATION TRACKING CONFIG TERMINÉE AVEC SUCCÈS !');
    console.log('🔄 Redémarrage de l\'application recommandé pour appliquer les changements');
    
  } catch (error) {
    // Annuler la transaction en cas d'erreur
    if (client) {
      await client.query('ROLLBACK');
      console.log('🔄 Transaction annulée');
    }
    
    console.error('\n❌ ERREUR lors de la migration:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    throw error;
    
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Exécuter la migration
if (require.main === module) {
  migrateTrackingConfig()
    .then(() => {
      console.log('\n🚀 Migration terminée - Script fermé');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Migration échouée:', error.message);
      process.exit(1);
    });
}

module.exports = { migrateTrackingConfig }; 