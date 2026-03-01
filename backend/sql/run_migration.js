const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Lit order-types.json et construit la liste complète des valeurs autorisées
const orderTypesConfig = require('../config/order-types.json');
const allValues = [
  ...orderTypesConfig.coreTypes,
  ...orderTypesConfig.extensions.map(e => e.value)
];

// Longueur max pour le type VARCHAR
const maxLength = Math.max(...allValues.map(v => v.length));
const varcharLength = Math.max(maxLength, 10); // minimum 10

// Génère le CHECK dynamiquement
const valuesSQL = allValues.map(v => `'${v}'`).join(', ');
const constraintSQL = `CHECK (order_type IN (${valuesSQL}))`;

console.log('📋 Types autorisés :', allValues);
console.log('📝 Contrainte SQL  :', constraintSQL);

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ...(isProduction && { ssl: { rejectUnauthorized: false } })
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check');

    await client.query(`
      ALTER TABLE orders
        ALTER COLUMN order_type TYPE VARCHAR(${varcharLength}),
        ADD CONSTRAINT orders_order_type_check ${constraintSQL}
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
