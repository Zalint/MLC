const { Client } = require('pg');

const connectionString = 'postgresql://matix_user:OZeJ5hk86x23wwqwawXVMcU38fe6O8r3@dpg-d0q9eha4d50c73c1q9cg-a.frankfurt-postgres.render.com/matix_livreur';

async function checkMataPrices() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données de production\n');

    // Requête pour récupérer tous les prix distincts des livraisons MATA de janvier
    const query = `
      SELECT 
        o.course_price,
        COUNT(*) as nombre,
        u.username as livreur,
        STRING_AGG(DISTINCT o.point_de_vente, ', ') as points_vente
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.order_type = 'MATA'
        AND DATE_TRUNC('month', o.created_at) = '2026-01-01'::date
      GROUP BY o.course_price, u.username
      ORDER BY o.course_price, u.username
    `;

    console.log('🔍 Analyse des prix des livraisons MATA de janvier 2026...\n');
    const result = await client.query(query);

    // Grouper par prix
    const byPrice = {};
    result.rows.forEach(row => {
      const price = parseFloat(row.course_price);
      if (!byPrice[price]) {
        byPrice[price] = {
          total: 0,
          details: []
        };
      }
      byPrice[price].total += parseInt(row.nombre);
      byPrice[price].details.push({
        livreur: row.livreur || 'Inconnu',
        nombre: parseInt(row.nombre),
        points_vente: row.points_vente
      });
    });

    console.log('═'.repeat(100));
    console.log('📊 DISTRIBUTION DES PRIX - LIVRAISONS MATA JANVIER 2026');
    console.log('═'.repeat(100));
    console.log('');

    let totalGeneral = 0;
    let montantGeneral = 0;

    for (const [price, data] of Object.entries(byPrice).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
      const priceFloat = parseFloat(price);
      const montantTotal = priceFloat * data.total;
      totalGeneral += data.total;
      montantGeneral += montantTotal;

      console.log(`💰 Prix : ${price} FCFA`);
      console.log(`   Total : ${data.total} livraison(s) = ${montantTotal} FCFA`);
      console.log('   ─'.repeat(50));
      
      data.details.forEach(detail => {
        console.log(`   • ${detail.livreur}: ${detail.nombre} livraison(s)`);
        if (detail.points_vente) {
          console.log(`     Points de vente: ${detail.points_vente}`);
        }
      });
      console.log('');
    }

    console.log('═'.repeat(100));
    console.log(`📈 RÉSUMÉ GLOBAL`);
    console.log('═'.repeat(100));
    console.log(`Total de livraisons MATA : ${totalGeneral}`);
    console.log(`Montant total : ${montantGeneral} FCFA`);
    console.log('');

    // Afficher les catégories spécifiques
    const at1000 = byPrice['1000'] ? byPrice['1000'].total : 0;
    const at1500 = byPrice['1500'] ? byPrice['1500'].total : 0;
    const autres = totalGeneral - at1000 - at1500;

    console.log('📊 Répartition :');
    console.log(`   • À 1000 FCFA : ${at1000} livraison(s) (${((at1000/totalGeneral)*100).toFixed(1)}%)`);
    console.log(`   • À 1500 FCFA : ${at1500} livraison(s) (${((at1500/totalGeneral)*100).toFixed(1)}%)`);
    if (autres > 0) {
      console.log(`   • Autres prix : ${autres} livraison(s) (${((autres/totalGeneral)*100).toFixed(1)}%)`);
    }
    console.log('');

    // Vérifier s'il y a des prix différents de 1000 et 1500
    const autresPrix = Object.keys(byPrice).filter(p => p !== '1000' && p !== '1500');
    
    if (autresPrix.length > 0) {
      console.log('⚠️  ATTENTION : Des prix différents de 1000 et 1500 FCFA ont été trouvés !');
      console.log('');
      console.log('Prix différents détectés :');
      autresPrix.forEach(price => {
        const priceFloat = parseFloat(price);
        console.log(`   • ${price} FCFA : ${byPrice[price].total} livraison(s) = ${priceFloat * byPrice[price].total} FCFA`);
      });
    } else {
      console.log('✅ Seulement des prix à 1000 et 1500 FCFA trouvés.');
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

// Exécuter la requête
checkMataPrices();
