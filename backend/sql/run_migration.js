const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check');
    await client.query(`
      ALTER TABLE orders
        ALTER COLUMN order_type TYPE VARCHAR(10),
        ADD CONSTRAINT orders_order_type_check
          CHECK (order_type IN ('MATA','MLC','YANGO','KEUR_BALLI','AUTRE'))
    `);
    await client.query('COMMIT');
    console.log('✅ Migration réussie : contrainte order_type mise à jour');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur migration:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
