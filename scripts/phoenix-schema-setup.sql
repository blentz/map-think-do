-- Phoenix Schema Setup for Production
-- This script prepares the PostgreSQL database for Phoenix integration
-- ensuring complete isolation from MCP tables

-- Create Phoenix schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS phoenix;

-- Grant all necessary permissions to mtd_user
GRANT ALL ON SCHEMA phoenix TO mtd_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA phoenix TO mtd_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA phoenix TO mtd_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA phoenix TO mtd_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA phoenix GRANT ALL ON TABLES TO mtd_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA phoenix GRANT ALL ON SEQUENCES TO mtd_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA phoenix GRANT ALL ON FUNCTIONS TO mtd_user;

-- Set Phoenix schema in search path (Phoenix will use this)
-- Note: Phoenix should be configured with PHOENIX_SQL_DATABASE_SCHEMA=phoenix
-- This ensures Phoenix creates all its tables in the phoenix schema

-- Verify setup
SELECT 
    'Phoenix schema ready' as status,
    n.nspname as schema_name,
    pg_catalog.has_schema_privilege('mtd_user', n.nspname, 'CREATE') as can_create_tables
FROM pg_namespace n
WHERE n.nspname = 'phoenix';

-- Show existing MCP tables remain in public schema
SELECT 
    'MCP tables unaffected' as status,
    COUNT(*) as table_count
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('stored_thoughts', 'stored_prompts', 'reasoning_sessions',
                      'pattern_embeddings', 'session_embeddings', 'thought_embeddings');