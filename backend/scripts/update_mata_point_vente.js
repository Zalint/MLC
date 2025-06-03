const db = require('../models/database');

async function checkMataOrders() {
  try {
    console.log('🔍 Checking MATA orders for point_de_vente values...\n');
    
    // Check all MATA orders
    const result = await db.query(`
      SELECT id, client_name, point_de_vente, created_at
      FROM orders 
      WHERE order_type = 'MATA' 
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    const mataOrders = result.rows;
    console.log(`Found ${mataOrders.length} MATA orders (showing last 20):\n`);
    
    let emptyCount = 0;
    let filledCount = 0;
    
    mataOrders.forEach((order, index) => {
      const hasPointVente = order.point_de_vente && order.point_de_vente.trim() !== '';
      const status = hasPointVente ? '✅' : '❌';
      const pointVente = hasPointVente ? order.point_de_vente : '(empty)';
      
      console.log(`${index + 1}. ${status} ${order.client_name} - Point de vente: ${pointVente} - ${new Date(order.created_at).toLocaleDateString('fr-FR')}`);
      
      if (hasPointVente) {
        filledCount++;
      } else {
        emptyCount++;
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Orders with point_de_vente: ${filledCount}`);
    console.log(`   Orders without point_de_vente: ${emptyCount}`);
    
    if (emptyCount > 0) {
      console.log(`\n💡 To fix empty values, you can either:`);
      console.log(`   1. Create new MATA orders (the form now captures point_de_vente)`);
      console.log(`   2. Manually update existing orders in the database`);
      console.log(`   3. Use the order edit function in the frontend`);
    }
    
  } catch (error) {
    console.error('❌ Error checking MATA orders:', error);
  }
}

// Run the check
checkMataOrders().then(() => {
  console.log('\n✅ Check completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 