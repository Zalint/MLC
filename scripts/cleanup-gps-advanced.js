#!/usr/bin/env node
/**
 * MATIX LIVREUR - GPS CLEANUP SCRIPT AVANCÉ
 * Nettoyage intelligent avec archivage et vérifications
 * Version Production Améliorée
 */

const db = require('../backend/models/database');

// Configuration flexible via variables d'environnement
const CONFIG = {
  RETENTION_DAYS: parseInt(process.env.GPS_RETENTION_DAYS) || 7,        // 7 jours par défaut
  ARCHIVE_DAYS: parseInt(process.env.GPS_ARCHIVE_DAYS) || 30,           // Archive 30 jours
  ARCHIVE_ENABLED: process.env.GPS_ARCHIVE_ENABLED === 'true',          // Archivage optionnel
  VACUUM_THRESHOLD: parseInt(process.env.VACUUM_THRESHOLD) || 1000,     // Seuil optimisation
  DRY_RUN: process.env.DRY_RUN === 'true',                             // Mode test
  NOTIFICATION_WEBHOOK: process.env.CLEANUP_WEBHOOK_URL                 // Webhook alertes
};

async function createArchiveTableIfNeeded() {
  try {
    console.log('📦 Vérification table d\'archive...');
    
    const createArchiveQuery = `
      CREATE TABLE IF NOT EXISTS gps_locations_archive (
        LIKE gps_locations INCLUDING ALL
      );
      
      -- Index pour performances sur l'archive
      CREATE INDEX IF NOT EXISTS idx_gps_archive_timestamp 
      ON gps_locations_archive(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_gps_archive_livreur_date 
      ON gps_locations_archive(livreur_id, DATE(timestamp));
    `;
    
    await db.query(createArchiveQuery);
    console.log('✅ Table d\'archive prête');
  } catch (error) {
    console.error('❌ Erreur création table archive:', error.message);
    throw error;
  }
}

async function checkDataCoherence() {
  try {
    console.log('🔍 Vérification cohérence données...');
    
    // Vérifier que les métriques quotidiennes existent pour les données à supprimer
    const coherenceQuery = `
      SELECT 
        DATE(gl.timestamp) as missing_date,
        COUNT(*) as gps_positions
      FROM gps_locations gl
      LEFT JOIN gps_daily_metrics gdm ON DATE(gl.timestamp) = gdm.tracking_date 
        AND gl.livreur_id = gdm.livreur_id
      WHERE gl.timestamp < NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days'
        AND gl.timestamp >= NOW() - INTERVAL '${CONFIG.RETENTION_DAYS + 7} days'  -- Derniers 7 jours à supprimer
        AND gdm.tracking_date IS NULL
      GROUP BY DATE(gl.timestamp)
      ORDER BY missing_date DESC
    `;
    
    const missingMetrics = await db.query(coherenceQuery);
    
    if (missingMetrics.rows.length > 0) {
      console.warn('⚠️  Métriques quotidiennes manquantes détectées:');
      console.table(missingMetrics.rows);
      
      // Générer les métriques manquantes
      console.log('🔧 Génération des métriques manquantes...');
      for (const row of missingMetrics.rows) {
        const dateStr = row.missing_date.toISOString().split('T')[0];
        await db.query('SELECT calculate_daily_metrics($1)', [dateStr]);
        console.log(`  ✅ Métriques générées pour ${dateStr}`);
      }
    } else {
      console.log('✅ Cohérence données OK');
    }
  } catch (error) {
    console.error('❌ Erreur vérification cohérence:', error.message);
    // Ne pas bloquer le processus pour cette vérification
  }
}

async function archiveOldData() {
  if (!CONFIG.ARCHIVE_ENABLED) {
    console.log('📦 Archivage désactivé, passage à la suppression');
    return 0;
  }
  
  try {
    console.log('📦 Archivage des données anciennes...');
    
    // Archiver les données entre RETENTION_DAYS et ARCHIVE_DAYS
    const archiveQuery = `
      WITH data_to_archive AS (
        SELECT * FROM gps_locations 
        WHERE timestamp < NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days'
          AND timestamp >= NOW() - INTERVAL '${CONFIG.ARCHIVE_DAYS} days'
      )
      INSERT INTO gps_locations_archive 
      SELECT * FROM data_to_archive
      ON CONFLICT (id) DO NOTHING
    `;
    
    if (CONFIG.DRY_RUN) {
      console.log('🧪 DRY RUN - Archivage simulé');
      const countQuery = `
        SELECT COUNT(*) as archive_count
        FROM gps_locations 
        WHERE timestamp < NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days'
          AND timestamp >= NOW() - INTERVAL '${CONFIG.ARCHIVE_DAYS} days'
      `;
      const count = await db.query(countQuery);
      console.log(`📦 Aurait archivé: ${count.rows[0].archive_count} positions`);
      return 0;
    }
    
    const archiveResult = await db.query(archiveQuery);
    const archivedRows = archiveResult.rowCount || 0;
    
    console.log(`✅ Archivage terminé: ${archivedRows} positions archivées`);
    return archivedRows;
    
  } catch (error) {
    console.error('❌ Erreur archivage:', error.message);
    throw error;
  }
}

async function deleteOldData() {
  try {
    console.log('🗑️  Suppression des données anciennes...');
    
    // Compter d'abord
    const countQuery = `
      SELECT COUNT(*) as delete_count
      FROM gps_locations 
      WHERE timestamp < NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days'
    `;
    
    const countResult = await db.query(countQuery);
    const recordsToDelete = parseInt(countResult.rows[0].delete_count);
    
    if (recordsToDelete === 0) {
      console.log('✅ Aucune donnée ancienne à supprimer');
      return 0;
    }
    
    console.log(`🗑️  ${recordsToDelete} positions à supprimer (> ${CONFIG.RETENTION_DAYS} jours)`);
    
    if (CONFIG.DRY_RUN) {
      console.log('🧪 DRY RUN - Suppression simulée');
      return recordsToDelete;
    }
    
    // Supprimer les données
    const deleteQuery = `
      DELETE FROM gps_locations 
      WHERE timestamp < NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days'
    `;
    
    const deleteResult = await db.query(deleteQuery);
    const deletedRows = deleteResult.rowCount || 0;
    
    console.log(`✅ Suppression terminée: ${deletedRows} positions supprimées`);
    return deletedRows;
    
  } catch (error) {
    console.error('❌ Erreur suppression:', error.message);
    throw error;
  }
}

async function optimizeDatabase(deletedRows) {
  /**
   * VACUUM_THRESHOLD : Seuil de déclenchement de l'optimisation
   * 
   * À quoi ça sert ?
   * - VACUUM récupère l'espace disque des lignes supprimées
   * - Met à jour les statistiques de la table pour l'optimiseur
   * - Améliore les performances des requêtes futures
   * 
   * Pourquoi un seuil ?
   * - VACUUM est coûteux en ressources (CPU, I/O)
   * - Inutile pour de petites suppressions (< 1000 lignes)
   * - Évite de surcharger la base pour rien
   * 
   * Exemple : 
   * - VACUUM_THRESHOLD = 1000
   * - Si on supprime 50 lignes → pas de VACUUM
   * - Si on supprime 5000 lignes → VACUUM automatique
   */
  
  if (deletedRows < CONFIG.VACUUM_THRESHOLD) {
    console.log(`⚡ Optimisation ignorée: ${deletedRows} < ${CONFIG.VACUUM_THRESHOLD} (seuil)`);
    return;
  }
  
  try {
    console.log(`🔧 Optimisation base (${deletedRows} suppressions > ${CONFIG.VACUUM_THRESHOLD} seuil)...`);
    
    if (CONFIG.DRY_RUN) {
      console.log('🧪 DRY RUN - Optimisation simulée');
      return;
    }
    
    // VACUUM ANALYZE récupère l'espace ET met à jour les stats
    await db.query('VACUUM ANALYZE gps_locations');
    console.log('✅ Optimisation terminée');
    
    // Statistiques post-optimisation
    const sizeQuery = `
      SELECT 
        pg_size_pretty(pg_relation_size('gps_locations')) as table_size,
        pg_size_pretty(pg_total_relation_size('gps_locations')) as total_size_with_indexes
    `;
    
    const sizeResult = await db.query(sizeQuery);
    console.log('📊 Taille table après optimisation:', sizeResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Erreur optimisation:', error.message);
    // Ne pas faire échouer le processus pour l'optimisation
  }
}

async function sendNotification(summary) {
  if (!CONFIG.NOTIFICATION_WEBHOOK) {
    return;
  }
  
  try {
    const payload = {
      text: `🧹 GPS Cleanup Report`,
      attachments: [{
        color: summary.errors > 0 ? 'danger' : 'good',
        fields: [
          { title: 'Archivé', value: summary.archived, short: true },
          { title: 'Supprimé', value: summary.deleted, short: true },
          { title: 'Conservé', value: summary.remaining, short: true },
          { title: 'Rétention', value: `${CONFIG.RETENTION_DAYS} jours`, short: true }
        ]
      }]
    };
    
    // Vous pouvez implémenter l'envoi vers Slack, Discord, etc.
    console.log('📡 Notification envoyée:', JSON.stringify(payload, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur notification:', error.message);
  }
}

async function cleanupGpsDataAdvanced() {
  try {
    console.log('🧹 === NETTOYAGE GPS AVANCÉ ===');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    console.log('⚙️  Configuration:', CONFIG);
    
    if (CONFIG.DRY_RUN) {
      console.log('🧪 === MODE DRY RUN - AUCUNE MODIFICATION ===');
    }
    
    // Vérification connexion
    await db.query('SELECT NOW() as current_time');
    console.log('✅ Connexion base de données OK');
    
    // Statistiques avant
    const statsQuery = `
      SELECT 
        COUNT(*) as total_positions,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days' THEN 1 END) as recent_positions,
        COUNT(CASE WHEN timestamp < NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days' THEN 1 END) as old_positions,
        pg_size_pretty(pg_total_relation_size('gps_locations')) as table_size
      FROM gps_locations
    `;
    
    const beforeStats = await db.query(statsQuery);
    console.log('\n📊 État initial:', beforeStats.rows[0]);
    
    // Processus de nettoyage
    await createArchiveTableIfNeeded();
    await checkDataCoherence();
    const archivedRows = await archiveOldData();
    const deletedRows = await deleteOldData();
    await optimizeDatabase(deletedRows);
    
    // Statistiques finales
    const afterStats = await db.query(statsQuery);
    const finalStats = afterStats.rows[0];
    
    console.log('\n📊 État final:', finalStats);
    
    // Résumé
    const summary = {
      archived: archivedRows,
      deleted: deletedRows,
      remaining: finalStats.total_positions,
      table_size: finalStats.table_size,
      errors: 0
    };
    
    console.log('\n📋 === RÉSUMÉ FINAL ===');
    console.log(`📦 Archivé: ${summary.archived} positions`);
    console.log(`🗑️  Supprimé: ${summary.deleted} positions`);
    console.log(`📍 Conservé: ${summary.remaining} positions`);
    console.log(`💾 Taille table: ${summary.table_size}`);
    console.log(`⏰ Rétention: ${CONFIG.RETENTION_DAYS} jours`);
    console.log(`🔧 Seuil VACUUM: ${CONFIG.VACUUM_THRESHOLD} suppressions`);
    
    await sendNotification(summary);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur critique:', error);
    console.error('Stack trace:', error.stack);
    
    await sendNotification({ errors: 1, error: error.message });
    process.exit(1);
  }
}

// Lancement
console.log('🚀 Démarrage nettoyage GPS avancé...');
cleanupGpsDataAdvanced(); 