const db = require('../models/database');

async function testMataQuery() {
  try {
    console.log('🔍 Testing MATA monthly dashboard query...\n');
    
    const month = '2025-06'; // Same as shown in the user's screenshot
    const orderType = 'MATA';
    
    const query = `
      SELECT 
        o.id,
        DATE(o.created_at) as date,
        o.phone_number,
        o.client_name,
        o.adresse_source,
        COALESCE(NULLIF(o.adresse_destination, ''), o.address) as adresse_destination,
        o.point_de_vente,
        o.amount as montant_commande,
        o.commentaire,
        o.service_rating,
        o.quality_rating,
        o.price_rating,
        u.username as livreur,
        o.created_at
      FROM orders o
      JOIN users u ON o.created_by = u.id
      WHERE o.order_type = $1
        AND TO_CHAR(o.created_at, 'YYYY-MM') = $2
      ORDER BY o.created_at ASC
    `;
    
    console.log('Query parameters:', [orderType, month]);
    
    const result = await db.query(query, [orderType, month]);
    const mataOrders = result.rows;
    
    console.log(`\n📊 Found ${mataOrders.length} MATA orders for ${month}:`);
    
    if (mataOrders.length === 0) {
      console.log('❌ No MATA orders found for June 2025');
      
      // Let's check all MATA orders regardless of date
      const allMataQuery = `
        SELECT 
          o.id,
          DATE(o.created_at) as date,
          o.client_name,
          o.point_de_vente,
          TO_CHAR(o.created_at, 'YYYY-MM') as month
        FROM orders o
        WHERE o.order_type = 'MATA'
        ORDER BY o.created_at DESC
        LIMIT 10
      `;
      
      const allResult = await db.query(allMataQuery);
      console.log('\n📋 All MATA orders (last 10):');
      allResult.rows.forEach((order, index) => {
        console.log(`${index + 1}. ${order.client_name} - ${order.point_de_vente || '(null)'} - ${order.month} - ${order.date}`);
      });
      
    } else {
      mataOrders.forEach((order, index) => {
        console.log(`${index + 1}. ${order.client_name} - Point de vente: "${order.point_de_vente || '(null)'}" - ${order.date}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing MATA query:', error);
  }
}

// Run the test
testMataQuery().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 