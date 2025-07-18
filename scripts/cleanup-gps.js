#!/usr/bin/env node
/**
 * MATIX LIVREUR - GPS CLEANUP SCRIPT
 * Nettoie les données GPS vieilles de plus de 3 jours
 * Optimisé pour production avec remplissage 5min
 */

const db = require('../backend/models/database');

async function cleanupOldGpsData() {
  try {
    console.log('🧹 === NETTOYAGE GPS AUTOMATIQUE ===');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    
    // Vérifier la connexion à la base
    await db.query('SELECT NOW() as current_time');
    console.log('✅ Connexion base de données OK');
    
    // 1. Statistiques avant nettoyage
    console.log('\n📊 État actuel des données GPS:');
    
    const statsQuery = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as positions_count,
        COUNT(DISTINCT livreur_id) as livreurs_actifs
      FROM gps_locations 
      WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;
    
    const currentStats = await db.query(statsQuery);
    console.table(currentStats.rows);
    
    // 2. Compter les données à supprimer (> 3 jours)
    const countQuery = `
      SELECT COUNT(*) as old_records_count
      FROM gps_locations 
      WHERE timestamp < NOW() - INTERVAL '3 days'
    `;
    
    const countResult = await db.query(countQuery);
    const recordsToDelete = parseInt(countResult.rows[0].old_records_count);
    
    console.log(`\n🗑️  Données à supprimer: ${recordsToDelete} positions GPS (> 3 jours)`);
    
    if (recordsToDelete === 0) {
      console.log('✅ Aucune donnée ancienne à nettoyer');
      process.exit(0);
    }
    
    // 3. Supprimer les anciennes données
    console.log('\n🔄 Suppression en cours...');
    
    const deleteQuery = `
      DELETE FROM gps_locations 
      WHERE timestamp < NOW() - INTERVAL '3 days'
    `;
    
    const deleteResult = await db.query(deleteQuery);
    const deletedRows = deleteResult.rowCount || 0;
    
    console.log(`✅ Suppression terminée: ${deletedRows} positions supprimées`);
    
    // 4. Statistiques après nettoyage
    const totalRemainingQuery = `
      SELECT COUNT(*) as total_remaining
      FROM gps_locations
    `;
    
    const totalResult = await db.query(totalRemainingQuery);
    const totalRemaining = parseInt(totalResult.rows[0].total_remaining);
    
    console.log(`📈 Positions GPS restantes: ${totalRemaining}`);
    
    // 5. Vérifier les métriques quotidiennes (ne pas toucher)
    const metricsQuery = `
      SELECT COUNT(*) as metrics_count
      FROM gps_daily_metrics
      WHERE tracking_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const metricsResult = await db.query(metricsQuery);
    const metricsCount = parseInt(metricsResult.rows[0].metrics_count);
    
    console.log(`📊 Métriques quotidiennes conservées: ${metricsCount} (30 derniers jours)`);
    
    // 6. Optimisation de la base (optionnel)
    if (deletedRows > 1000) {
      console.log('\n🔧 Optimisation de la table...');
      await db.query('VACUUM ANALYZE gps_locations');
      console.log('✅ Optimisation terminée');
    }
    
    // 7. Résumé final
    console.log('\n📋 === RÉSUMÉ NETTOYAGE ===');
    console.log(`✅ Supprimé: ${deletedRows} positions GPS anciennes`);
    console.log(`📍 Conservé: ${totalRemaining} positions GPS récentes`);
    console.log(`📊 Métriques: ${metricsCount} lignes de métriques`);
    console.log(`⏰ Rétention: 3 jours pour gps_locations`);
    console.log(`📅 Prochain nettoyage: demain à la même heure`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage GPS:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Lancer le nettoyage
console.log('🚀 Démarrage du nettoyage GPS automatique...');
cleanupOldGpsData(); 