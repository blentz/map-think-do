-- PostgreSQL Extension Initialization for Sentient AGI Reasoning Server
-- This script initializes required extensions for cognitive capabilities
-- Run order: 01 (first initialization script)

\echo 'Starting extension initialization for Sentient AGI Reasoning Server...'

-- Enable verbose error reporting during initialization
\set ON_ERROR_STOP off
\set VERBOSITY verbose

-- Create extensions in correct dependency order
\echo 'Creating core PostgreSQL extensions...'

-- 1. Enable basic extensions first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" 
    SCHEMA public 
    VERSION '1.1';

CREATE EXTENSION IF NOT EXISTS "pg_trgm" 
    SCHEMA public;

CREATE EXTENSION IF NOT EXISTS "btree_gin" 
    SCHEMA public;

CREATE EXTENSION IF NOT EXISTS "btree_gist" 
    SCHEMA public;

-- 2. Statistics and monitoring extensions
\echo 'Creating monitoring extensions...'

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" 
    SCHEMA public;

-- 3. TimescaleDB - Time-series data support for cognitive analytics
\echo 'Creating TimescaleDB extension for time-series cognitive analytics...'

CREATE EXTENSION IF NOT EXISTS "timescaledb" 
    SCHEMA public;

-- 4. Additional useful extensions for cognitive workloads
\echo 'Creating additional cognitive workload extensions...'

-- Full-text search enhancements
CREATE EXTENSION IF NOT EXISTS "unaccent" 
    SCHEMA public;

-- 5. Verify core extensions are properly installed
\echo 'Verifying extension installation...'

SELECT 
    extname as "Extension",
    extversion as "Version",
    nspname as "Schema"
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname IN (
    'uuid-ossp',
    'pg_trgm', 
    'btree_gin',
    'btree_gist',
    'pg_stat_statements',
    'timescaledb',
    'unaccent'
)
ORDER BY extname;

-- 6. Configure TimescaleDB settings
\echo 'Configuring TimescaleDB for cognitive workloads...'

-- Set TimescaleDB configuration for cognitive analytics
SELECT timescaledb_pre_restore();

-- Configure background workers for cognitive data processing
SELECT set_config('timescaledb.max_background_workers', '8', false);

-- 7. Performance and monitoring setup
\echo 'Setting up performance monitoring...'

-- Configure pg_stat_statements for query analysis
SELECT pg_stat_statements_reset();

-- 8. Set up extension-specific schemas and permissions
\echo 'Setting up schemas and permissions...'

-- Ensure proper permissions for cognitive operations
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mtd_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mtd_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO mtd_user;

-- 9. Performance optimization settings for extensions
\echo 'Applying performance optimizations for cognitive extensions...'

-- Configure GIN indexing for JSONB cognitive metadata
SET gin_fuzzy_search_limit = 0;
SET gin_pending_list_limit = '16MB';

-- Optimize for time-series queries (TimescaleDB)
SET timescaledb.max_background_workers = 8;

-- Memory settings for complex cognitive queries
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';

\echo 'Core extension initialization completed successfully!'
\echo 'Available cognitive capabilities:'
\echo '  - Time-series analytics (TimescaleDB)'
\echo '  - Full-text and trigram search (pg_trgm)'
\echo '  - UUID generation (uuid-ossp)'
\echo '  - Performance monitoring (pg_stat_statements)'

-- Final check: List all available extensions
\echo 'Currently installed extensions:'
SELECT extname, extversion FROM pg_extension ORDER BY extname;

\echo 'Database is ready for cognitive workloads!'