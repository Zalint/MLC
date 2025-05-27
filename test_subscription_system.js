const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:4000/api/v1';
let authToken = '';

// Test data
const testClient = {
  client_name: 'Jean Dupont Test',
  phone_number: '0123456789',
  total_deliveries: 10,
  expiry_months: 6
};

const testOrder = {
  client_name: 'Jean Dupont Test',
  phone_number: '0123456789',
  address: '123 Rue de Test',
  description: 'Commande de test MLC',
  course_price: 1500
};

// Helper function to make authenticated requests
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      ...(data && { data })
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Test functions
async function testLogin() {
  console.log('\n🔐 Testing login...');
  try {
    const response = await makeRequest('POST', '/auth/login', {
      username: 'admin',
      password: 'Admin123!'
    });
    
    if (response.success && response.token) {
      authToken = response.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ Login failed - no token received');
      return false;
    }
  } catch (error) {
    console.log('❌ Login failed');
    return false;
  }
}

async function testCreateSubscription() {
  console.log('\n📝 Testing subscription creation...');
  try {
    const response = await makeRequest('POST', '/subscriptions', testClient);
    
    if (response.success && response.subscription) {
      console.log('✅ Subscription created successfully');
      console.log(`   Card Number: ${response.subscription.card_number}`);
      console.log(`   Client: ${response.subscription.client_name}`);
      console.log(`   Deliveries: ${response.subscription.remaining_deliveries}/${response.subscription.total_deliveries}`);
      return response.subscription;
    } else {
      console.log('❌ Subscription creation failed');
      return null;
    }
  } catch (error) {
    console.log('❌ Subscription creation failed');
    return null;
  }
}

async function testGetSubscriptions() {
  console.log('\n📋 Testing subscription listing...');
  try {
    const response = await makeRequest('GET', '/subscriptions');
    
    if (response.success && response.subscriptions) {
      console.log(`✅ Retrieved ${response.subscriptions.length} subscriptions`);
      if (response.stats) {
        console.log(`   Total cards: ${response.stats.total_cards}`);
        console.log(`   Active cards: ${response.stats.active_cards}`);
      }
      return response.subscriptions;
    } else {
      console.log('❌ Failed to retrieve subscriptions');
      return [];
    }
  } catch (error) {
    console.log('❌ Failed to retrieve subscriptions');
    return [];
  }
}

async function testSearchByPhone() {
  console.log('\n🔍 Testing search by phone number...');
  try {
    const response = await makeRequest('GET', `/subscriptions/phone/${testClient.phone_number}?active=true`);
    
    if (response.success && response.subscriptions) {
      console.log(`✅ Found ${response.subscriptions.length} active subscription(s) for ${testClient.phone_number}`);
      return response.subscriptions;
    } else {
      console.log('❌ No subscriptions found for phone number');
      return [];
    }
  } catch (error) {
    console.log('❌ Search by phone failed');
    return [];
  }
}

async function testMLCOrderWithSubscription() {
  console.log('\n🚚 Testing MLC order with automatic subscription deduction...');
  try {
    const response = await makeRequest('POST', '/subscriptions/mlc-order', testOrder);
    
    if (response.success && response.order) {
      console.log('✅ MLC order created successfully');
      console.log(`   Order ID: ${response.order.id}`);
      console.log(`   Subscription used: ${response.subscription_used}`);
      
      if (response.subscription_used && response.subscription) {
        console.log(`   Remaining deliveries: ${response.subscription.remaining_deliveries}`);
      }
      
      return response;
    } else {
      console.log('❌ MLC order creation failed');
      return null;
    }
  } catch (error) {
    console.log('❌ MLC order creation failed');
    return null;
  }
}

async function testCardValidity(cardNumber) {
  console.log('\n✅ Testing card validity check...');
  try {
    const response = await makeRequest('GET', `/subscriptions/check/${cardNumber}`);
    
    if (response.success) {
      console.log(`✅ Card ${cardNumber} validity check:`);
      console.log(`   Valid: ${response.valid}`);
      console.log(`   Status: ${response.status}`);
      if (response.subscription) {
        console.log(`   Remaining deliveries: ${response.subscription.remaining_deliveries}`);
      }
      return response;
    } else {
      console.log('❌ Card validity check failed');
      return null;
    }
  } catch (error) {
    console.log('❌ Card validity check failed');
    return null;
  }
}

async function testSubscriptionStats() {
  console.log('\n📊 Testing subscription statistics...');
  try {
    const response = await makeRequest('GET', '/subscriptions/stats');
    
    if (response.success && response.stats) {
      console.log('✅ Subscription statistics:');
      console.log(`   Total cards: ${response.stats.total_cards}`);
      console.log(`   Active cards: ${response.stats.active_cards}`);
      console.log(`   Completed cards: ${response.stats.completed_cards}`);
      console.log(`   Expired cards: ${response.stats.expired_cards}`);
      console.log(`   Total deliveries sold: ${response.stats.total_deliveries_sold}`);
      console.log(`   Total deliveries used: ${response.stats.total_deliveries_used}`);
      console.log(`   Expiring soon: ${response.expiring_count}`);
      return response.stats;
    } else {
      console.log('❌ Failed to retrieve statistics');
      return null;
    }
  } catch (error) {
    console.log('❌ Failed to retrieve statistics');
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting Subscription System Tests');
  console.log('=====================================');

  // Test 1: Login
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('\n❌ Cannot continue tests without authentication');
    return;
  }

  // Test 2: Create subscription
  const subscription = await testCreateSubscription();
  if (!subscription) {
    console.log('\n❌ Cannot continue tests without a subscription');
    return;
  }

  // Test 3: List subscriptions
  await testGetSubscriptions();

  // Test 4: Search by phone
  await testSearchByPhone();

  // Test 5: Check card validity
  await testCardValidity(subscription.card_number);

  // Test 6: Create MLC order with subscription
  await testMLCOrderWithSubscription();

  // Test 7: Check card validity after use
  await testCardValidity(subscription.card_number);

  // Test 8: Get statistics
  await testSubscriptionStats();

  console.log('\n🎉 All tests completed!');
  console.log('=====================================');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests }; 