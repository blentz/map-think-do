-- PostgreSQL Schema for Sentient AGI Reasoning Server Memory Store
-- Simplified schema matching the actual application code expectations
-- Run order: 02 (after extensions are initialized)

\echo 'Creating Sentient AGI Reasoning Server database schema...'

-- Enable error reporting
\set ON_ERROR_STOP on

-- =============================================================================
-- CORE TABLES MATCHING APPLICATION CODE
-- =============================================================================

-- 1. REASONING SESSIONS TABLE
\echo 'Creating reasoning_sessions table...'

CREATE TABLE IF NOT EXISTS reasoning_sessions (
    -- Primary identification
    id VARCHAR(50) PRIMARY KEY,
    
    -- Temporal information
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    
    -- Session context
    objective TEXT NOT NULL,
    domain VARCHAR(100),
    initial_complexity DECIMAL(3,1) CHECK (initial_complexity >= 1.0 AND initial_complexity <= 10.0),
    final_complexity DECIMAL(3,1) CHECK (final_complexity >= 1.0 AND final_complexity <= 10.0),
    
    -- Session outcomes
    goal_achieved BOOLEAN NOT NULL DEFAULT FALSE,
    confidence_level DECIMAL(3,2) CHECK (confidence_level >= 0.0 AND confidence_level <= 1.0),
    effectiveness_score DECIMAL(3,2) CHECK (effectiveness_score >= 0.0 AND effectiveness_score <= 1.0),
    
    -- Session statistics
    total_thoughts INTEGER NOT NULL DEFAULT 0,
    revision_count INTEGER NOT NULL DEFAULT 0,
    branch_count INTEGER NOT NULL DEFAULT 0,
    
    -- Cognitive patterns (TEXT ARRAYS - matching application code)
    cognitive_roles_used TEXT[],
    metacognitive_interventions INTEGER DEFAULT 0,
    
    -- Learning insights (TEXT ARRAYS - matching application code)
    lessons_learned TEXT[],
    successful_strategies TEXT[],
    failed_approaches TEXT[],
    
    -- Tagging and categorization (TEXT ARRAY - matching application code)
    tags TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. STORED THOUGHTS TABLE  
\echo 'Creating stored_thoughts table...'

CREATE TABLE IF NOT EXISTS stored_thoughts (
    -- Primary identification
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
    
    -- Core thought content
    thought TEXT NOT NULL,
    thought_number INTEGER NOT NULL CHECK (thought_number > 0),
    total_thoughts INTEGER NOT NULL CHECK (total_thoughts > 0),
    next_thought_needed BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Branching and revision metadata
    is_revision BOOLEAN DEFAULT FALSE,
    revises_thought INTEGER,
    branch_from_thought INTEGER,
    branch_id VARCHAR(100),
    needs_more_thoughts BOOLEAN,
    
    -- Temporal and contextual metadata
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confidence DECIMAL(3,2) CHECK (confidence >= 0.0 AND confidence <= 1.0),
    domain VARCHAR(100),
    objective TEXT,
    complexity DECIMAL(4,1) CHECK (complexity >= 1.0 AND complexity <= 10.0),
    
    -- Outcome tracking
    success BOOLEAN,
    effectiveness_score DECIMAL(3,2) CHECK (effectiveness_score >= 0.0 AND effectiveness_score <= 1.0),
    user_feedback TEXT,
    outcome_quality VARCHAR(20) CHECK (outcome_quality IN ('excellent', 'good', 'fair', 'poor')),
    
    -- Rich metadata (JSONB for context, TEXT ARRAYS for lists)
    context JSONB,
    tags TEXT[],
    patterns_detected TEXT[],
    similar_thoughts TEXT[],
    
    -- Output and tracing
    output TEXT,
    context_trace TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_thought_number CHECK (thought_number <= total_thoughts)
);

-- =============================================================================
-- BASIC INDEXES FOR PERFORMANCE
-- =============================================================================

\echo 'Creating basic performance indexes...'

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_thoughts_session_time ON stored_thoughts(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_thoughts_timestamp ON stored_thoughts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_thoughts_domain ON stored_thoughts(domain) WHERE domain IS NOT NULL;

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON reasoning_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_domain ON reasoning_sessions(domain) WHERE domain IS NOT NULL;

-- Array indexes for tags and patterns
CREATE INDEX IF NOT EXISTS idx_thoughts_tags ON stored_thoughts USING GIN (tags) WHERE tags IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thoughts_patterns ON stored_thoughts USING GIN (patterns_detected) WHERE patterns_detected IS NOT NULL;

-- JSONB index for context
CREATE INDEX IF NOT EXISTS idx_thoughts_context ON stored_thoughts USING GIN (context) WHERE context IS NOT NULL;

-- =============================================================================
-- TIMESCALEDB SETUP (IF AVAILABLE)
-- =============================================================================

\echo 'Setting up TimescaleDB hypertables (if TimescaleDB is available)...'

-- Convert to hypertables only if TimescaleDB extension exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'TimescaleDB detected, creating hypertables...';
        
        -- Convert stored_thoughts to hypertable
        PERFORM create_hypertable('stored_thoughts', 'timestamp', 
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE
        );
        
        -- Convert reasoning_sessions to hypertable  
        PERFORM create_hypertable('reasoning_sessions', 'start_time',
            chunk_time_interval => INTERVAL '7 days', 
            if_not_exists => TRUE
        );
        
        RAISE NOTICE 'TimescaleDB hypertables created successfully';
    ELSE
        RAISE NOTICE 'TimescaleDB not available, using regular PostgreSQL tables';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB setup failed, continuing with regular tables: %', SQLERRM;
END $$;

-- =============================================================================
-- SAMPLE DATA FOR VERIFICATION
-- =============================================================================

\echo 'Inserting sample data for verification...'

-- Insert sample session
INSERT INTO reasoning_sessions (
    id, objective, domain, goal_achieved, confidence_level, 
    effectiveness_score, cognitive_roles_used, lessons_learned, 
    successful_strategies, tags
) VALUES (
    'sample_session_init',
    'Verify database schema initialization',
    'database',
    true,
    0.85,
    0.90,
    ARRAY['Engineer', 'Analyst'],
    ARRAY['Schema validation is critical', 'Test data helps verification'],
    ARRAY['Step-by-step validation', 'Error handling'],
    ARRAY['schema', 'initialization', 'test']
) ON CONFLICT (id) DO NOTHING;

-- Insert sample thought
INSERT INTO stored_thoughts (
    id, session_id, thought, thought_number, total_thoughts,
    confidence, domain, complexity, effectiveness_score,
    context, tags, patterns_detected, context_trace
) VALUES (
    'sample_thought_init',
    'sample_session_init',
    'This is a sample thought to verify that the PostgreSQL schema is working correctly with all expected data types and constraints.',
    1,
    1,
    0.87,
    'database', 
    6.5,
    0.88,
    '{"cognitive_load": 0.6, "problem_type": "schema_validation", "tools_available": ["postgresql", "timescaledb"]}'::jsonb,
    ARRAY['test', 'verification', 'sample'],
    ARRAY['schema_validation', 'database_testing'],
    ARRAY['initialization', 'verification']
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

\echo 'Running schema verification...'

-- Verify tables exist
SELECT 
    'Tables Created' as status,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_name IN ('reasoning_sessions', 'stored_thoughts')
  AND table_schema = 'public';

-- Verify sample data
SELECT 
    'Sample Data' as status,
    (SELECT COUNT(*) FROM reasoning_sessions WHERE id = 'sample_session_init') as sessions,
    (SELECT COUNT(*) FROM stored_thoughts WHERE id = 'sample_thought_init') as thoughts;

-- Verify constraints
SELECT 
    'Constraints' as status,
    COUNT(*) as constraint_count
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%_check';

-- Verify indexes
SELECT 
    'Indexes' as status,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename IN ('reasoning_sessions', 'stored_thoughts');

\echo 'Schema initialization completed successfully!';
\echo '';
\echo 'Available features:';
\echo '  ✓ Core tables (reasoning_sessions, stored_thoughts)';
\echo '  ✓ Proper data types matching application code';
\echo '  ✓ Basic performance indexes'; 
\echo '  ✓ TimescaleDB integration (if available)';
\echo '  ✓ Sample data for verification';
\echo '  ✓ Data integrity constraints';
\echo '';
\echo 'Database is ready for cognitive workloads!';