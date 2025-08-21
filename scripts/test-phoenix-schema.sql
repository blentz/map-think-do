-- Phoenix Schema Isolation Test Script
-- Purpose: Validate that Phoenix and MCP can coexist in the same PostgreSQL database
-- using schema separation without conflicts

-- Current MCP tables in public schema:
-- - pattern_embeddings
-- - reasoning_sessions  
-- - session_embeddings
-- - stored_prompts
-- - stored_thoughts
-- - thought_embeddings

-- Step 1: Create separate schema for Phoenix
CREATE SCHEMA IF NOT EXISTS phoenix;

-- Step 2: Grant permissions to mtd_user for Phoenix schema
GRANT ALL ON SCHEMA phoenix TO mtd_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA phoenix TO mtd_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA phoenix TO mtd_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA phoenix GRANT ALL ON TABLES TO mtd_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA phoenix GRANT ALL ON SEQUENCES TO mtd_user;

-- Step 3: Verify schema isolation
-- MCP tables remain in public schema
SELECT 
    'public' as schema_name,
    tablename,
    'MCP' as system
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('stored_thoughts', 'stored_prompts', 'reasoning_sessions',
                      'pattern_embeddings', 'session_embeddings', 'thought_embeddings')
ORDER BY tablename;

-- Step 4: Test that Phoenix can create tables in its own schema
-- This simulates what Phoenix would do on startup
SET search_path TO phoenix;

-- Create a test table to verify Phoenix schema works
CREATE TABLE IF NOT EXISTS phoenix.test_phoenix_table (
    id SERIAL PRIMARY KEY,
    test_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test data
INSERT INTO phoenix.test_phoenix_table (test_data) 
VALUES ('Phoenix schema isolation test successful');

-- Step 5: Verify complete isolation
-- Reset search path to default
SET search_path TO public;

-- Check that tables are properly isolated
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    CASE 
        WHEN n.nspname = 'public' THEN 'MCP'
        WHEN n.nspname = 'phoenix' THEN 'Phoenix'
        ELSE 'Other'
    END as system
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
    AND n.nspname IN ('public', 'phoenix')
    AND c.relname NOT LIKE 'pg_%'
ORDER BY n.nspname, c.relname;

-- Step 6: Test cross-schema queries work (if needed for integration)
-- This shows both systems can coexist and even interact if necessary
SELECT 
    'Schema Isolation Test Results:' as status,
    COUNT(DISTINCT n.nspname) as schema_count,
    COUNT(*) as total_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
    AND n.nspname IN ('public', 'phoenix')
    AND c.relname NOT LIKE 'pg_%';

-- Step 7: Cleanup test table (optional)
-- DROP TABLE IF EXISTS phoenix.test_phoenix_table;

-- Summary: 
-- Phoenix will use 'phoenix' schema for all its tables
-- MCP continues using 'public' schema
-- No naming conflicts possible due to schema isolation
-- Both systems can coexist in the same database