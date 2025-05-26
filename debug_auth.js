// Debug script to test authentication
const fetch = require('node-fetch');

async function testAuth() {
  const BACKEND_URL = 'https://matix-livreur-backend.onrender.com';
  
  console.log('🧪 Testing authentication flow...');
  console.log('Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Login
    console.log('\n1️⃣ Testing login...');
    const loginResponse = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'SALIOU',
        password: 'mlc2024'
      }),
      credentials: 'include'
    });
    
    console.log('Login status:', loginResponse.status);
    console.log('Login headers:', Object.fromEntries(loginResponse.headers.entries()));
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    // Extract cookies
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Set-Cookie header:', cookies);
    
    if (loginResponse.ok) {
      console.log('✅ Login successful');
      
      // Test 2: Check auth with cookies
      console.log('\n2️⃣ Testing auth check...');
      const authResponse = await fetch(`${BACKEND_URL}/api/v1/auth/check`, {
        method: 'GET',
        headers: {
          'Cookie': cookies || ''
        },
        credentials: 'include'
      });
      
      console.log('Auth check status:', authResponse.status);
      const authData = await authResponse.json();
      console.log('Auth check response:', authData);
      
      if (authResponse.ok) {
        console.log('✅ Auth check successful');
      } else {
        console.log('❌ Auth check failed');
      }
      
    } else {
      console.log('❌ Login failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuth(); 