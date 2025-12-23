#!/usr/bin/env node
/**
 * Migration script for Test Supabase Database
 *
 * Usage: TEST_DATABASE_URL=<connection_string> node scripts/migrate-test-db.js
 *
 * This script runs all migrations against the test Supabase instance.
 * It uses the direct PostgreSQL connection for DDL operations.
 *
 * IMPORTANT: Never hardcode database credentials - use environment variables!
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database URL from environment variable (required)
const TEST_DB_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DB_URL) {
  console.error('❌ TEST_DATABASE_URL environment variable is required');
  console.error('Usage: TEST_DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/migrate-test-db.js');
  process.exit(1);
}

// Migration files in order
const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_learned_facts_function.sql',
  '005_error_logs.sql',
  '006_multi_bot_platform.sql',
  '007_feedback_system.sql',
  '008_workspaces_foundation.sql',
  '009_add_workspace_id.sql',
  '010_rls_policies.sql',
  '011_subscriptions.sql',
  '012_usage_tracking.sql',
  '013_enforce_workspace_isolation.sql',
  '014_platform_admin.sql',
  '015_bot_health.sql',
  '016_document_tags.sql',
];

async function runMigrations() {
  const client = new pg.Client({
    connectionString: TEST_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to test database...');
    await client.connect();
    console.log('Connected!');

    // Check current tables
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`\nCurrent tables: ${tables.length}`);
    if (tables.length > 0) {
      console.log(tables.map(t => t.table_name).join(', '));
    }

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

    for (const file of MIGRATION_FILES) {
      const filePath = path.join(migrationsDir, file);

      if (!fs.existsSync(filePath)) {
        console.log(`\n⚠️ Skipping ${file} (not found)`);
        continue;
      }

      console.log(`\n📦 Running ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✅ ${file} completed`);
      } catch (error) {
        // Some migrations may fail if already applied (e.g., table already exists)
        if (error.code === '42P07') { // duplicate_table
          console.log(`⏭️ ${file} - tables already exist, skipping`);
        } else if (error.code === '42710') { // duplicate_object
          console.log(`⏭️ ${file} - objects already exist, skipping`);
        } else if (error.code === '42701') { // duplicate_column
          console.log(`⏭️ ${file} - columns already exist, skipping`);
        } else {
          console.error(`❌ ${file} failed:`, error.message);
        }
      }
    }

    // Verify final state
    const { rows: finalTables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`\n✅ Migration complete! Tables: ${finalTables.length}`);
    console.log(finalTables.map(t => t.table_name).join(', '));

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
