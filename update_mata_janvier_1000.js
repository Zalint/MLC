const { Client } = require('pg');

const connectionString = 'postgresql://matix_user:OZeJ5hk86x23wwqwawXVMcU38fe6O8r3@dpg-d0q9eha4d50c73c1q9cg-a.frankfurt-postgres.render.com/matix_livreur';

async function updateMataJanvier() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données de production\n');

    // ÉTAPE 1 : Vérification préalable
    console.log('🔍 ÉTAPE 1 : Vérification des données à modifier...\n');
    const verificationQuery = `
      SELECT 
        COUNT(*) as nombre_livraisons,
        COUNT(*) * 1500 as montant_actuel,
        COUNT(*) * 1000 as montant_futur,
        (COUNT(*) * 1500) - (COUNT(*) * 1000) as difference
      FROM orders
      WHERE order_type = 'MATA'
        AND course_price = 1500
        AND DATE_TRUNC('month', created_at) = '2026-01-01'::date
    `;

    const verif = await client.query(verificationQuery);
    const stats = verif.rows[0];
    
    console.log('📊 Statistiques :');
    console.log(`   Nombre de livraisons : ${stats.nombre_livraisons}`);
    console.log(`   Montant actuel : ${stats.montant_actuel} FCFA`);
    console.log(`   Montant futur : ${stats.montant_futur} FCFA`);
    console.log(`   Différence : ${stats.difference} FCFA`);
    console.log('');

    // ÉTAPE 2 : Demander confirmation
    console.log('⚠️  ATTENTION : Vous êtes sur le point de modifier la base de PRODUCTION !');
    console.log('⚠️  Cette action modifiera ' + stats.nombre_livraisons + ' lignes.');
    console.log('');
    console.log('Pour continuer, décommentez la section UPDATE dans le code.');
    console.log('');

    // DÉCOMMENTEZ CETTE SECTION POUR EXÉCUTER L'UPDATE
    /*
    console.log('🔄 ÉTAPE 2 : Exécution de l\'UPDATE...\n');
    
    const updateQuery = `
      UPDATE orders
      SET course_price = 1000
      WHERE order_type = 'MATA'
        AND course_price = 1500
        AND DATE_TRUNC('month', created_at) = '2026-01-01'::date
    `;

    const updateResult = await client.query(updateQuery);
    console.log(`✅ UPDATE réussi : ${updateResult.rowCount} ligne(s) modifiée(s)\n`);

    // ÉTAPE 3 : Vérification post-update
    console.log('🔍 ÉTAPE 3 : Vérification post-update...\n');
    
    const verificationPostQuery = `
      SELECT 
        u.username as livreur,
        COUNT(*) as nombre_livraisons,
        SUM(o.course_price) as montant_total
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.order_type = 'MATA'
        AND o.course_price = 1000
        AND DATE_TRUNC('month', o.created_at) = '2026-01-01'::date
      GROUP BY u.username
      ORDER BY u.username
    `;

    const verifPost = await client.query(verificationPostQuery);
    
    console.log('📊 Répartition après UPDATE :');
    console.log('═'.repeat(80));
    
    let totalLivraisons = 0;
    let totalMontant = 0;
    
    verifPost.rows.forEach(row => {
      console.log(`   ${row.livreur}: ${row.nombre_livraisons} livraison(s) = ${row.montant_total} FCFA`);
      totalLivraisons += parseInt(row.nombre_livraisons);
      totalMontant += parseFloat(row.montant_total);
    });
    
    console.log('═'.repeat(80));
    console.log(`   TOTAL: ${totalLivraisons} livraison(s) = ${totalMontant} FCFA`);
    console.log('');
    console.log('✅ Opération terminée avec succès !');
    */

    console.log('ℹ️  Aucune modification effectuée (mode vérification uniquement)');

  } catch (error) {
    console.error('❌ Erreur lors de l\'opération:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ Connexion fermée');
  }
}

// Exécuter le script
updateMataJanvier();
