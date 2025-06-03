const db = require('../models/database');

async function updateSampleMataOrders() {
  try {
    console.log('🔄 Updating sample MATA orders with different point_de_vente values...\n');
    
    // Get some MATA orders to update
    const result = await db.query(`
      SELECT id, client_name, point_de_vente 
      FROM orders 
      WHERE order_type = 'MATA' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    const orders = result.rows;
    console.log(`Found ${orders.length} MATA orders to update:`);
    
    const pointsDeVente = ['O.Foire', 'Mbao', 'Keur Massar'];
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const newPointVente = pointsDeVente[i % pointsDeVente.length];
      
      console.log(`${i + 1}. Updating ${order.client_name}: "${order.point_de_vente || '(null)'}" → "${newPointVente}"`);
      
      await db.query(`
        UPDATE orders 
        SET point_de_vente = $1 
        WHERE id = $2
      `, [newPointVente, order.id]);
    }
    
    console.log('\n✅ All orders updated successfully!');
    console.log('\n🔍 Verifying updates...');
    
    // Verify the updates
    const verifyResult = await db.query(`
      SELECT client_name, point_de_vente 
      FROM orders 
      WHERE order_type = 'MATA' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    verifyResult.rows.forEach((order, index) => {
      console.log(`${index + 1}. ${order.client_name} - Point de vente: "${order.point_de_vente}"`);
    });
    
  } catch (error) {
    console.error('❌ Error updating MATA orders:', error);
  }
}

// Run the update
updateSampleMataOrders().then(() => {
  console.log('\n✅ Update completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Update failed:', error);
  process.exit(1);
}); 