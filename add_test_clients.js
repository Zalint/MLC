const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'matix_livreur',
  user: 'postgres',
  password: 'bonea2024'
});

async function addTestClients() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Ajout des clients de test...');
    
    // Supprimer les clients de test existants
    console.log('🗑️ Suppression des clients de test existants...');
    await client.query(`
      DELETE FROM orders WHERE client_name IN (
        'Jean Dupont (Test)',
        'Marie Martin (Test)',
        'Pierre Durand (Test)',
        'Sophie Bernard (Test)',
        'Michel Petit (Test)',
        'Claire Moreau (Test)',
        'André Leroy (Test)',
        'Isabelle Roux (Test)'
      )
    `);
    
    // Récupérer un utilisateur existant
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      throw new Error('Aucun utilisateur trouvé dans la base de données');
    }
    const userId = userResult.rows[0].id;
    console.log(`👤 Utilisateur trouvé: ID ${userId}`);
    
    // Ajouter les clients de test
    const testClients = [
      // Client 1: Jean Dupont (MATA)
      {
        name: 'Jean Dupont (Test)',
        phone: '773920001',
        address: '123 Rue de la Paix, Dakar',
        adresse_source: 'O.Foire',
        adresse_destination: 'Sicap Liberté 2, Dakar',
        point_de_vente: 'O.Foire',
        amount: 5000.00,
        course_price: 1500.00,
        order_type: 'MATA'
      },
      {
        name: 'Jean Dupont (Test)',
        phone: '773920001',
        address: '123 Rue de la Paix, Dakar',
        adresse_source: 'O.Foire',
        adresse_destination: 'Almadies, Dakar',
        point_de_vente: 'O.Foire',
        amount: 3500.00,
        course_price: 1500.00,
        order_type: 'MATA'
      },
      
      // Client 2: Marie Martin (MLC)
      {
        name: 'Marie Martin (Test)',
        phone: '773920002',
        address: '456 Avenue Georges Bush, Dakar',
        adresse_source: 'Point E, Dakar',
        adresse_destination: 'Yoff, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 1750.00,
        order_type: 'MLC'
      },
      {
        name: 'Marie Martin (Test)',
        phone: '773920002',
        address: '456 Avenue Georges Bush, Dakar',
        adresse_source: 'Fann, Dakar',
        adresse_destination: 'Mermoz, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 1750.00,
        order_type: 'MLC'
      },
      
      // Client 3: Pierre Durand (AUTRE)
      {
        name: 'Pierre Durand (Test)',
        phone: '773920003',
        address: '789 Boulevard de la Corniche, Dakar',
        adresse_source: 'Plateau, Dakar',
        adresse_destination: 'Médina, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 2000.00,
        order_type: 'AUTRE'
      },
      {
        name: 'Pierre Durand (Test)',
        phone: '773920003',
        address: '789 Boulevard de la Corniche, Dakar',
        adresse_source: 'Gorée, Dakar',
        adresse_destination: 'Plateau, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 2500.00,
        order_type: 'AUTRE'
      },
      
      // Client 4: Sophie Bernard (MATA)
      {
        name: 'Sophie Bernard (Test)',
        phone: '773920004',
        address: '321 Rue des Ambassadeurs, Dakar',
        adresse_source: 'Sacre Coeur',
        adresse_destination: 'Almadies, Dakar',
        point_de_vente: 'Sacre Coeur',
        amount: 4200.00,
        course_price: 1500.00,
        order_type: 'MATA'
      },
      {
        name: 'Sophie Bernard (Test)',
        phone: '773920004',
        address: '321 Rue des Ambassadeurs, Dakar',
        adresse_source: 'Sacre Coeur',
        adresse_destination: 'Point E, Dakar',
        point_de_vente: 'Sacre Coeur',
        amount: 3800.00,
        course_price: 1500.00,
        order_type: 'MATA'
      },
      
      // Client 5: Michel Petit (MLC)
      {
        name: 'Michel Petit (Test)',
        phone: '773920005',
        address: '654 Avenue Cheikh Anta Diop, Dakar',
        adresse_source: 'UCAD, Dakar',
        adresse_destination: 'Fass, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 2000.00,
        order_type: 'MLC'
      },
      {
        name: 'Michel Petit (Test)',
        phone: '773920005',
        address: '654 Avenue Cheikh Anta Diop, Dakar',
        adresse_source: 'Fass, Dakar',
        adresse_destination: 'UCAD, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 2000.00,
        order_type: 'MLC'
      },
      
      // Client 6: Claire Moreau (AUTRE)
      {
        name: 'Claire Moreau (Test)',
        phone: '773920006',
        address: '987 Rue de la Plage, Dakar',
        adresse_source: 'Yoff, Dakar',
        adresse_destination: 'Ngor, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 3000.00,
        order_type: 'AUTRE'
      },
      {
        name: 'Claire Moreau (Test)',
        phone: '773920006',
        address: '987 Rue de la Plage, Dakar',
        adresse_source: 'Ngor, Dakar',
        adresse_destination: 'Yoff, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 3000.00,
        order_type: 'AUTRE'
      },
      
      // Client 7: André Leroy (MATA)
      {
        name: 'André Leroy (Test)',
        phone: '773920007',
        address: '147 Rue du Commerce, Dakar',
        adresse_source: 'Mbao',
        adresse_destination: 'Rufisque, Dakar',
        point_de_vente: 'Mbao',
        amount: 2800.00,
        course_price: 1500.00,
        order_type: 'MATA'
      },
      {
        name: 'André Leroy (Test)',
        phone: '773920007',
        address: '147 Rue du Commerce, Dakar',
        adresse_source: 'Mbao',
        adresse_destination: 'Bargny, Dakar',
        point_de_vente: 'Mbao',
        amount: 3200.00,
        course_price: 1500.00,
        order_type: 'MATA'
      },
      
      // Client 8: Isabelle Roux (MLC)
      {
        name: 'Isabelle Roux (Test)',
        phone: '773920008',
        address: '258 Avenue Léopold Sédar Senghor, Dakar',
        adresse_source: 'Gueule Tapée, Dakar',
        adresse_destination: 'Colobane, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 1750.00,
        order_type: 'MLC'
      },
      {
        name: 'Isabelle Roux (Test)',
        phone: '773920008',
        address: '258 Avenue Léopold Sédar Senghor, Dakar',
        adresse_source: 'Colobane, Dakar',
        adresse_destination: 'Gueule Tapée, Dakar',
        point_de_vente: null,
        amount: null,
        course_price: 1750.00,
        order_type: 'MLC'
      }
    ];
    
    console.log(`📝 Ajout de ${testClients.length} commandes de test...`);
    
    for (let i = 0; i < testClients.length; i++) {
      const client = testClients[i];
      const daysAgo = Math.floor(Math.random() * 10) + 1; // 1 à 10 jours
      
      await client.query(`
        INSERT INTO orders (
          client_name, phone_number, address, adresse_source, adresse_destination, 
          point_de_vente, amount, course_price, order_type, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - INTERVAL '${daysAgo} days')
      `, [
        client.name, client.phone, client.address, client.adresse_source, 
        client.adresse_destination, client.point_de_vente, client.amount, 
        client.course_price, client.order_type, userId
      ]);
      
      console.log(`✅ Ajouté: ${client.name} (${client.order_type})`);
    }
    
    // Vérifier les résultats
    const result = await client.query(`
      SELECT 
        client_name,
        phone_number,
        COUNT(*) as nombre_commandes,
        MAX(created_at) as derniere_commande,
        STRING_AGG(DISTINCT order_type, ', ') as types_commandes
      FROM orders 
      WHERE client_name LIKE '%(Test)%'
      GROUP BY client_name, phone_number
      ORDER BY derniere_commande DESC
    `);
    
    console.log('\n📊 Résumé des clients de test ajoutés:');
    console.log('='.repeat(80));
    result.rows.forEach(row => {
      console.log(`${row.client_name} (${row.phone_number})`);
      console.log(`  - ${row.nombre_commandes} commande(s)`);
      console.log(`  - Types: ${row.types_commandes}`);
      console.log(`  - Dernière: ${row.derniere_commande}`);
      console.log('');
    });
    
    console.log('✅ Clients de test ajoutés avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des clients de test:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécuter le script
addTestClients(); 