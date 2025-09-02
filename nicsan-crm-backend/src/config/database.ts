
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'nicsan_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
  // Do not exit; allow the server to run for non-DB routes and retry later
});

// Note: Shutdown handling is now managed by src/utils/shutdown.ts
// This prevents duplicate signal handlers

// Database connectivity test
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    console.log('🧪 Testing database connection...');
    const { rows } = await pool.query('SELECT 1 as ok');
    const isConnected = rows[0]?.ok === 1;
    console.log('🧪 Database connection test:', isConnected ? '✅ SUCCESS' : '❌ FAILED');
    return isConnected;
  } catch (error) {
    console.error('🧪 Database connection test: ❌ FAILED');
    console.error('🧪 Error details:', error);
    return false;
  }
}

export default pool;
