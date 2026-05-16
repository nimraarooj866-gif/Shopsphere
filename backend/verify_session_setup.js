#!/usr/bin/env node
/**
 * Session Persistence Verification Script
 * 
 * Verifies that MySQL session store is properly configured and working
 * Run: node verify_session_setup.js
 */

const mysql = require('mysql2');
const path = require('path');
require('dotenv').config(path.join(__dirname, '.env'));

// Database connection (same as index.js)
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Nimra123",
  database: process.env.DB_NAME || "Shopsphere"
});

const checks = {
  database: false,
  table: false,
  schema: false,
  config: false
};

console.log('\n' + '='.repeat(60));
console.log('  EXPRESS-SESSION MYSQL PERSISTENCE VERIFICATION');
console.log('='.repeat(60) + '\n');

// Check 1: Database Connection
console.log('🔍 Check 1: Database Connection');
db.connect((err) => {
  if (err) {
    console.log('   ❌ FAILED: Cannot connect to MySQL database');
    console.log('   Error:', err.message);
    process.exit(1);
  }
  
  console.log('   ✅ PASSED: Connected to MySQL');
  checks.database = true;
  
  // Check 2: Sessions Table Exists
  console.log('\n🔍 Check 2: Sessions Table');
  db.query("SHOW TABLES LIKE 'sessions'", (err, results) => {
    if (err) {
      console.log('   ❌ FAILED: Error checking for sessions table');
      console.log('   Error:', err.message);
      cleanup();
      return;
    }
    
    if (results.length === 0) {
      console.log('   ⚠️  WARNING: sessions table not found');
      console.log('   ℹ️  It will be auto-created on first server start');
    } else {
      console.log('   ✅ PASSED: sessions table exists');
      checks.table = true;
    }
    
    // Check 3: Table Schema
    if (checks.table) {
      console.log('\n🔍 Check 3: Table Schema');
      db.query("DESCRIBE sessions", (err, results) => {
        if (err) {
          console.log('   ❌ FAILED: Cannot describe sessions table');
          console.log('   Error:', err.message);
          cleanup();
          return;
        }
        
        const columns = results.map(r => r.Field);
        const requiredColumns = ['session_id', 'expires', 'data'];
        const hasAllColumns = requiredColumns.every(col => columns.includes(col));
        
        if (hasAllColumns) {
          console.log('   ✅ PASSED: All required columns present');
          console.log('   Columns:', columns.join(', '));
          checks.schema = true;
        } else {
          console.log('   ❌ FAILED: Missing required columns');
          console.log('   Found:', columns.join(', '));
          console.log('   Required:', requiredColumns.join(', '));
        }
        
        // Check 4: Configuration File
        console.log('\n🔍 Check 4: Session Configuration');
        const configPath = path.join(__dirname, 'config', 'sessionConfig.js');
        try {
          const fs = require('fs');
          const configContent = fs.readFileSync(configPath, 'utf8');
          
          const hasMySQL = configContent.includes('MySQLStore') && configContent.includes('express-mysql-session');
          const hasResave = configContent.includes('resave: false');
          const hasSaveUninitialized = configContent.includes('saveUninitialized: false');
          const hasMaxAge = configContent.includes('maxAge');
          const hasHttpOnly = configContent.includes('httpOnly: true');
          
          if (hasMySQL && hasResave && hasSaveUninitialized && hasMaxAge && hasHttpOnly) {
            console.log('   ✅ PASSED: Session config properly configured');
            console.log('      • MySQLStore: ✅');
            console.log('      • resave: false: ✅');
            console.log('      • saveUninitialized: false: ✅');
            console.log('      • maxAge: ✅');
            console.log('      • httpOnly: true: ✅');
            checks.config = true;
          } else {
            console.log('   ❌ FAILED: Missing configuration settings');
            if (!hasMySQL) console.log('      • MySQLStore: ❌');
            if (!hasResave) console.log('      • resave: false: ❌');
            if (!hasSaveUninitialized) console.log('      • saveUninitialized: false: ❌');
            if (!hasMaxAge) console.log('      • maxAge: ❌');
            if (!hasHttpOnly) console.log('      • httpOnly: true: ❌');
          }
        } catch (err) {
          console.log('   ❌ FAILED: Cannot read configuration file');
          console.log('   Error:', err.message);
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('  VERIFICATION SUMMARY');
        console.log('='.repeat(60));
        
        const allPassed = Object.values(checks).every(v => v);
        
        console.log(`\nDatabase Connection:    ${checks.database ? '✅' : '❌'}`);
        console.log(`Sessions Table:         ${checks.table ? '✅' : '⚠️ '}`);
        console.log(`Table Schema:           ${checks.schema ? '✅' : '❌'}`);
        console.log(`Configuration:          ${checks.config ? '✅' : '❌'}`);
        
        if (checks.database && checks.config) {
          console.log('\n✨ SESSION PERSISTENCE READY!');
          console.log('\n📝 Configuration Details:');
          try {
            const fs = require('fs');
            const configContent = fs.readFileSync(configPath, 'utf8');
            
            // Extract expiration
            const expirationMatch = configContent.match(/SESSION_EXPIRATION_MS = \d+/);
            if (expirationMatch) {
              const ms = expirationMatch[0].match(/\d+/)[0];
              const hours = ms / (60 * 60 * 1000);
              console.log(`   • Default expiration: ${hours} hours`);
            }
            
            console.log(`   • Session ID cookie: shopsphere.sid`);
            console.log(`   • Store type: MySQL (via express-mysql-session)`);
            console.log(`   • Resave: false (prevents session regeneration)`);
            console.log(`   • Save uninitialized: false`);
          } catch (e) {}
        } else {
          console.log('\n⚠️  PLEASE FIX: Session persistence not fully configured');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('\n📚 For more info, see: SESSION_PERSISTENCE_GUIDE.md\n');
        
        cleanup();
      });
    } else {
      cleanup();
    }
  });
});

function cleanup() {
  db.end((err) => {
    if (err) console.error('Database disconnect error:', err);
    process.exit(0);
  });
}
