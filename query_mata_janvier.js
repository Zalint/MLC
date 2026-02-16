const { Client } = require('pg');

const connectionString = 'postgresql://matix_user:OZeJ5hk86x23wwqwawXVMcU38fe6O8r3@dpg-d0q9eha4d50c73c1q9cg-a.frankfurt-postgres.render.com/matix_livreur';

async function queryMataJanvier() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données de production\n');

    // Requête pour récupérer les livraisons MATA de janvier 2026 à 1500 FCFA sans extra
    const query = `
      SELECT 
        o.id,
        o.client_name,
        o.phone_number,
        o.adresse_source,
        o.adresse_destination,
        o.point_de_vente,
        o.course_price,
        o.interne,
        o.created_at,
        u.username as livreur
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.order_type = 'MATA'
        AND o.course_price = 1500
        AND DATE_TRUNC('month', o.created_at) = '2026-01-01'::date
      ORDER BY o.created_at DESC
    `;

    console.log('🔍 Exécution de la requête...\n');
    const result = await client.query(query);

    console.log(`📊 Résultat : ${result.rows.length} livraison(s) trouvée(s)\n`);
    console.log('═'.repeat(120));

    if (result.rows.length > 0) {
      // Grouper par livreur
      const byLivreur = {};
      result.rows.forEach(row => {
        const livreur = row.livreur || 'Inconnu';
        if (!byLivreur[livreur]) {
          byLivreur[livreur] = [];
        }
        byLivreur[livreur].push(row);
      });

      // Afficher par livreur
      for (const [livreur, commandes] of Object.entries(byLivreur)) {
        console.log(`\n👤 LIVREUR: ${livreur} (${commandes.length} commande(s))`);
        console.log('─'.repeat(120));
        
        commandes.forEach((row, index) => {
          console.log(`\n  ${index + 1}. Commande ID: ${row.id}`);
          console.log(`     Client: ${row.client_name}`);
          console.log(`     Téléphone: ${row.phone_number}`);
          console.log(`     Source: ${row.adresse_source || 'N/A'}`);
          console.log(`     Destination: ${row.adresse_destination || 'N/A'}`);
          console.log(`     Point de vente: ${row.point_de_vente || 'N/A'}`);
          console.log(`     Prix: ${row.course_price} FCFA`);
          console.log(`     Interne: ${row.interne ? 'Oui' : 'Non'}`);
          console.log(`     Date: ${new Date(row.created_at).toLocaleString('fr-FR')}`);
        });
      }

      // Statistiques globales
      console.log('\n\n' + '═'.repeat(120));
      console.log('📈 STATISTIQUES');
      console.log('═'.repeat(120));
      
      // Total par livreur
      console.log('\n📊 Répartition par livreur:');
      for (const [livreur, commandes] of Object.entries(byLivreur)) {
        const total = commandes.length * 1500;
        console.log(`   ${livreur}: ${commandes.length} commande(s) = ${total} FCFA`);
      }

      // Total par type (interne/client)
      const internes = result.rows.filter(r => r.interne).length;
      const clients = result.rows.filter(r => !r.interne).length;
      console.log(`\n📊 Par type:`);
      console.log(`   MATA client: ${clients} commande(s)`);
      console.log(`   MATA interne: ${internes} commande(s)`);

      // Total général
      const totalGeneral = result.rows.length * 1500;
      console.log(`\n💰 TOTAL GÉNÉRAL: ${result.rows.length} commande(s) × 1500 FCFA = ${totalGeneral} FCFA`);
      
    } else {
      console.log('\n❌ Aucune livraison MATA à 1500 FCFA trouvée pour janvier 2026');
    }

    console.log('\n' + '═'.repeat(120));

  } catch (error) {
    console.error('❌ Erreur lors de la requête:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ Connexion fermée');
  }
}

// Exécuter la requête
queryMataJanvier();
