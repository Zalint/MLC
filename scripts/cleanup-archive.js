#!/usr/bin/env node
/**
 * MATIX LIVREUR - ARCHIVE CLEANUP SCRIPT
 * Nettoyage mensuel des archives GPS (> 30 jours)
 */

const db = require('../backend/models/database');

async function cleanupArchiveData() {
  try {
    console.log('🗂️  === NETTOYAGE ARCHIVE GPS MENSUEL ===');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    
    // Vérifier la connexion
    await db.query('SELECT NOW() as current_time');
    console.log('✅ Connexion base de données OK');
    
    // Statistiques archive avant nettoyage
    const archiveStatsQuery = `
      SELECT 
        COUNT(*) as total_archived,
        MIN(timestamp) as oldest_record,
        MAX(timestamp) as newest_record,
        pg_size_pretty(pg_total_relation_size('gps_locations_archive')) as archive_size
      FROM gps_locations_archive
    `;
    
    const archiveStats = await db.query(archiveStatsQuery);
    console.log('\n📊 État archive avant nettoyage:', archiveStats.rows[0]);
    
    // Compter les données archive anciennes (> 30 jours)
    const countQuery = `
      SELECT COUNT(*) as old_archive_count
      FROM gps_locations_archive 
      WHERE timestamp < NOW() - INTERVAL '30 days'
    `;
    
    const countResult = await db.query(countQuery);
    const recordsToDelete = parseInt(countResult.rows[0].old_archive_count);
    
    console.log(`\n🗑️  Données archive à supprimer: ${recordsToDelete} (> 30 jours)`);
    
    if (recordsToDelete === 0) {
      console.log('✅ Aucune donnée archive ancienne à supprimer');
      process.exit(0);
    }
    
    // Supprimer les données archive anciennes
    const deleteQuery = `
      DELETE FROM gps_locations_archive 
      WHERE timestamp < NOW() - INTERVAL '30 days'
    `;
    
    const deleteResult = await db.query(deleteQuery);
    const deletedRows = deleteResult.rowCount || 0;
    
    console.log(`✅ Suppression archive terminée: ${deletedRows} positions supprimées`);
    
    // Optimisation si nécessaire
    if (deletedRows > 500) {
      console.log('🔧 Optimisation table archive...');
      await db.query('VACUUM ANALYZE gps_locations_archive');
      console.log('✅ Optimisation archive terminée');
    }
    
    // Statistiques finales
    const finalStats = await db.query(archiveStatsQuery);
    console.log('\n📊 État archive après nettoyage:', finalStats.rows[0]);
    
    console.log('\n📋 === RÉSUMÉ NETTOYAGE ARCHIVE ===');
    console.log(`🗑️  Supprimé: ${deletedRows} positions archive`);
    console.log(`📦 Archive conservée: ${finalStats.rows[0].total_archived} positions`);
    console.log(`💾 Taille archive: ${finalStats.rows[0].archive_size}`);
    console.log(`📅 Prochain nettoyage: 1er du mois prochain`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur nettoyage archive:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

console.log('🚀 Démarrage nettoyage archive GPS...');
cleanupArchiveData(); 