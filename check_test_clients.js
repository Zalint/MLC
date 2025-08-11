const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'matix_livreur',
  user: 'postgres',
  password: 'bonea2024'
});

async function checkTestClients() {
  try {
    const result = await pool.query(`
      SELECT 
        client_name,
        phone_number,
        COUNT(*) as nombre_commandes
      FROM orders 
      WHERE client_name LIKE '%(Test)%'
      GROUP BY client_name, phone_number
      ORDER BY client_name
    `);
    
    console.log('📊 Clients de test trouvés:', result.rows.length);
    
    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log(`- ${row.client_name} (${row.phone_number}) - ${row.nombre_commandes} commande(s)`);
      });
    } else {
      console.log('❌ Aucun client de test trouvé');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkTestClients(); 