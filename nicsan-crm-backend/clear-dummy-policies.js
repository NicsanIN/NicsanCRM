#!/usr/bin/env node

/**
 * Clear dummy policies from the database
 * This script removes policies with dummy data like TA-607, TA-2221, etc.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/nicsan_crm'
});

async function clearDummyPolicies() {
  try {
    console.log('🔍 Checking for dummy policies...');
    
    // Find policies with dummy data patterns
    const dummyPatterns = [
      "TA-607", "TA-2221", "TA-8876", // Known dummy policy numbers
      "KA01AB356", "KA01AB150", "KA01AB204" // Known dummy vehicle numbers
    ];
    
    for (const pattern of dummyPatterns) {
      const result = await pool.query(
        'SELECT id, policy_number, vehicle_number FROM policies WHERE policy_number = $1 OR vehicle_number = $1',
        [pattern]
      );
      
      if (result.rows.length > 0) {
        console.log(`🗑️  Found ${result.rows.length} dummy policies with pattern: ${pattern}`);
        for (const row of result.rows) {
          console.log(`   - ID: ${row.id}, Policy: ${row.policy_number}, Vehicle: ${row.vehicle_number}`);
        }
      }
    }
    
    // Delete policies with dummy data
    const deleteResult = await pool.query(`
      DELETE FROM policies 
      WHERE policy_number IN ('TA-607', 'TA-2221', 'TA-8876')
         OR vehicle_number IN ('KA01AB356', 'KA01AB150', 'KA01AB204')
    `);
    
    console.log(`✅ Deleted ${deleteResult.rowCount} dummy policies`);
    
    // Show remaining policies count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM policies');
    console.log(`📊 Remaining policies in database: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error clearing dummy policies:', error);
  } finally {
    await pool.end();
  }
}

clearDummyPolicies();
