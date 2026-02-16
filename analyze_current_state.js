const { Client } = require('pg');

const connectionString = 'postgresql://matix_user:OZeJ5hk86x23wwqwawXVMcU38fe6O8r3@dpg-d0q9eha4d50c73c1q9cg-a.frankfurt-postgres.render.com/matix_livreur';

async function analyzeCurrentState() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données de production\n');

    // ANALYSE 1: État actuel de toutes les livraisons MATA de janvier
    console.log('═'.repeat(100));
    console.log('📊 ANALYSE 1: ÉTAT ACTUEL - TOUTES LES LIVRAISONS MATA DE JANVIER 2026');
    console.log('═'.repeat(100));
    console.log('');

    const query1 = `
      SELECT 
        o.course_price,
        COUNT(*) as nombre,
        SUM(o.course_price) as montant_total
      FROM orders o
      WHERE o.order_type = 'MATA'
        AND DATE_TRUNC('month', o.created_at) = '2026-01-01'::date
      GROUP BY o.course_price
      ORDER BY o.course_price
    `;

    const result1 = await client.query(query1);
    
    let totalLivraisons = 0;
    let totalMontant = 0;

    console.log('Distribution actuelle des prix:');
    console.log('─'.repeat(100));
    result1.rows.forEach(row => {
      console.log(`   ${row.course_price} FCFA: ${row.nombre} livraison(s) = ${row.montant_total} FCFA`);
      totalLivraisons += parseInt(row.nombre);
      totalMontant += parseFloat(row.montant_total);
    });
    console.log('─'.repeat(100));
    console.log(`   TOTAL: ${totalLivraisons} livraison(s) = ${totalMontant} FCFA`);
    console.log('');

    // ANALYSE 2: Détails par livreur pour TOUTES les livraisons
    console.log('═'.repeat(100));
    console.log('📊 ANALYSE 2: DÉTAILS PAR LIVREUR - TOUTES LES LIVRAISONS MATA');
    console.log('═'.repeat(100));
    console.log('');

    const query2 = `
      SELECT 
        u.username as livreur,
        COUNT(*) as nombre_livraisons,
        SUM(o.course_price) as montant_total,
        COUNT(CASE WHEN o.course_price = 1000 THEN 1 END) as nb_1000,
        COUNT(CASE WHEN o.course_price = 1500 THEN 1 END) as nb_1500,
        COUNT(CASE WHEN o.course_price = 2000 THEN 1 END) as nb_2000
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.order_type = 'MATA'
        AND DATE_TRUNC('month', o.created_at) = '2026-01-01'::date
      GROUP BY u.username
      ORDER BY u.username
    `;

    const result2 = await client.query(query2);
    
    console.log('Livreur         | Total | Montant   | @ 1000 | @ 1500 | @ 2000');
    console.log('─'.repeat(100));
    
    let totaux = {
      total: 0,
      montant: 0,
      nb_1000: 0,
      nb_1500: 0,
      nb_2000: 0
    };

    result2.rows.forEach(row => {
      console.log(`${row.livreur.padEnd(15)} | ${String(row.nombre_livraisons).padStart(5)} | ${String(row.montant_total).padStart(9)} | ${String(row.nb_1000).padStart(6)} | ${String(row.nb_1500).padStart(6)} | ${String(row.nb_2000).padStart(6)}`);
      totaux.total += parseInt(row.nombre_livraisons);
      totaux.montant += parseFloat(row.montant_total);
      totaux.nb_1000 += parseInt(row.nb_1000);
      totaux.nb_1500 += parseInt(row.nb_1500);
      totaux.nb_2000 += parseInt(row.nb_2000);
    });

    console.log('─'.repeat(100));
    console.log(`${'TOTAL'.padEnd(15)} | ${String(totaux.total).padStart(5)} | ${String(totaux.montant).padStart(9)} | ${String(totaux.nb_1000).padStart(6)} | ${String(totaux.nb_1500).padStart(6)} | ${String(totaux.nb_2000).padStart(6)}`);
    console.log('');

    // ANALYSE 3: Comparaison avec l'état initial attendu
    console.log('═'.repeat(100));
    console.log('📊 ANALYSE 3: COMPARAISON AVEC L\'ÉTAT INITIAL');
    console.log('═'.repeat(100));
    console.log('');

    const etatInitialAttendu = {
      '1000': 598,
      '1500': 418,
      '2000': 42,
      'total': 1058
    };

    console.log('État initial attendu (avant UPDATE):');
    console.log(`   1000 FCFA: ${etatInitialAttendu['1000']} livraisons`);
    console.log(`   1500 FCFA: ${etatInitialAttendu['1500']} livraisons`);
    console.log(`   2000 FCFA: ${etatInitialAttendu['2000']} livraisons`);
    console.log(`   TOTAL: ${etatInitialAttendu['total']} livraisons`);
    console.log('');

    console.log('État actuel (après UPDATE ?):');
    result1.rows.forEach(row => {
      console.log(`   ${row.course_price} FCFA: ${row.nombre} livraisons`);
    });
    console.log(`   TOTAL: ${totalLivraisons} livraisons`);
    console.log('');

    // Déterminer ce qui s'est passé
    const nb1000Actuel = result1.rows.find(r => r.course_price === '1000')?.nombre || 0;
    const nb1500Actuel = result1.rows.find(r => r.course_price === '1500')?.nombre || 0;
    const nb2000Actuel = result1.rows.find(r => r.course_price === '2000')?.nombre || 0;

    console.log('═'.repeat(100));
    console.log('🔍 DIAGNOSTIC');
    console.log('═'.repeat(100));
    console.log('');

    if (nb1000Actuel >= etatInitialAttendu['total'] * 0.95) {
      console.log('⚠️  Il semble que TOUTES les livraisons MATA ont été mises à 1000 FCFA !');
      console.log('');
      console.log('Conséquences:');
      console.log(`   - ${nb1000Actuel} livraisons sont maintenant à 1000 FCFA`);
      console.log(`   - Montant total: ${nb1000Actuel * 1000} FCFA`);
      console.log(`   - Différence vs état initial: ${(etatInitialAttendu['1000'] * 1000 + etatInitialAttendu['1500'] * 1500 + etatInitialAttendu['2000'] * 2000) - (nb1000Actuel * 1000)} FCFA`);
    } else if (nb1000Actuel === etatInitialAttendu['1000'] + etatInitialAttendu['1500']) {
      console.log('✅ L\'UPDATE a bien converti les 418 livraisons de 1500F à 1000F');
      console.log(`   - Livraisons à 1000F: ${nb1000Actuel}`);
      console.log(`   - Livraisons à 2000F: ${nb2000Actuel} (inchangées)`);
    } else {
      console.log('🤔 État inattendu détecté:');
      console.log(`   - Attendu à 1000F: ${etatInitialAttendu['1000']} ou ${etatInitialAttendu['1000'] + etatInitialAttendu['1500']}`);
      console.log(`   - Actuel à 1000F: ${nb1000Actuel}`);
      console.log(`   - Différence: ${nb1000Actuel - etatInitialAttendu['1000']} livraisons`);
    }

    console.log('');
    console.log('═'.repeat(100));

  } catch (error) {
    console.error('❌ Erreur lors de la requête:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ Connexion fermée');
  }
}

// Exécuter l'analyse
analyzeCurrentState();
