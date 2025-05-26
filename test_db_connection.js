const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing database connection...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('DB_HOST:', process.env.DB_HOST);
  
  let poolConfig;

  if (process.env.DATABASE_URL) {
    // Use connection string (common for Render)
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
    console.log('📡 Using DATABASE_URL connection string');
  } else {
    // Use individual parameters
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'matix_livreur',
      user: process.env.DB_USER || 'matix_user',
      password: process.env.DB_PASSWORD || 'mlc2024',
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    };
    console.log('🔧 Using individual connection parameters');
  }

  console.log('SSL enabled:', !!poolConfig.ssl);

  const pool = new Pool(poolConfig);

  try {
    console.log('🔄 Attempting to connect...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('📊 Test query result:');
    console.log('  Current time:', result.rows[0].current_time);
    console.log('  PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
    
    // Test if our tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tables in database:');
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach(row => {
        console.log('  -', row.table_name);
      });
    } else {
      console.log('  No tables found. You may need to run the database setup script.');
    }
    
    client.release();
    await pool.end();
    
    console.log('🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.log('\n💡 SSL/TLS Error Solutions:');
      console.log('1. Make sure NODE_ENV=production is set in your environment variables');
      console.log('2. Use the DATABASE_URL connection string from Render');
      console.log('3. Ensure your database allows SSL connections');
    }
    
    await pool.end();
    process.exit(1);
  }
}

testConnection(); 