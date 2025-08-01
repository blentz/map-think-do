-- PostgreSQL Schema Extension: Normalized Project Management
-- Adds comprehensive project intelligence to the Sentient AGI Reasoning Server
-- Run order: 06 (after core schema and extensions are initialized)

\echo 'Creating normalized project schema extension...'

-- Enable error reporting
\set ON_ERROR_STOP on

-- =============================================================================
-- NORMALIZED PROJECTS TABLE
-- =============================================================================

\echo 'Creating projects table with comprehensive metadata...'

CREATE TABLE IF NOT EXISTS projects (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core project information
    directory_path TEXT UNIQUE NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT,
    
    -- Technology and metadata
    technology_stack TEXT[], -- ['react', 'typescript', 'nodejs']
    project_type VARCHAR(50), -- 'web-app', 'api', 'library', 'mobile', etc.
    programming_languages TEXT[], -- ['typescript', 'python', 'sql']
    
    -- Project lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Cognitive settings (JSONB for flexibility)
    cognitive_settings JSONB DEFAULT '{}', -- AI preferences, persona settings, etc.
    project_metadata JSONB DEFAULT '{}', -- Custom metadata, tags, etc.
    
    -- Analytics fields
    total_sessions INTEGER DEFAULT 0,
    total_thoughts INTEGER DEFAULT 0,
    total_prompts INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT valid_directory_path CHECK (length(directory_path) > 0),
    CONSTRAINT valid_project_name CHECK (length(project_name) > 0),
    CONSTRAINT valid_project_type CHECK (project_type IS NULL OR length(project_type) > 0),
    CONSTRAINT valid_activity_order CHECK (last_activity_at >= created_at)
);

-- =============================================================================
-- ADD PROJECT FOREIGN KEYS TO CORE TABLES
-- =============================================================================

\echo 'Adding project_id foreign keys to core tables...'

-- Add project_id to reasoning_sessions (nullable for backward compatibility)
ALTER TABLE reasoning_sessions 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add project_id to stored_prompts (nullable for backward compatibility)
ALTER TABLE stored_prompts 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add project_id to stored_thoughts (nullable for backward compatibility)
ALTER TABLE stored_thoughts 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- =============================================================================
-- OPTIMIZED INDEXES FOR PROJECTS TABLE
-- =============================================================================

\echo 'Creating optimized indexes for projects table...'

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_projects_directory_path ON projects(directory_path);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);

-- Filtering indexes
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(is_archived) WHERE is_archived = TRUE;
CREATE INDEX IF NOT EXISTS idx_projects_activity ON projects(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);

-- Technology and type indexes
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type) WHERE project_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_tech_stack ON projects USING GIN (technology_stack) WHERE technology_stack IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_languages ON projects USING GIN (programming_languages) WHERE programming_languages IS NOT NULL;

-- JSONB indexes for metadata queries
CREATE INDEX IF NOT EXISTS idx_projects_cognitive_settings ON projects USING GIN (cognitive_settings) WHERE cognitive_settings != '{}';
CREATE INDEX IF NOT EXISTS idx_projects_metadata ON projects USING GIN (project_metadata) WHERE project_metadata != '{}';

-- =============================================================================
-- FOREIGN KEY INDEXES FOR PERFORMANCE
-- =============================================================================

\echo 'Creating foreign key indexes for enhanced query performance...'

-- Foreign key indexes for efficient JOINs
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON reasoning_sessions(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_project_id ON stored_prompts(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thoughts_project_id ON stored_thoughts(project_id) WHERE project_id IS NOT NULL;

-- =============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =============================================================================

\echo 'Creating composite indexes for project-aware queries...'

-- Project + domain queries
CREATE INDEX IF NOT EXISTS idx_sessions_project_domain ON reasoning_sessions(project_id, domain) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_project_type ON stored_prompts(project_id, prompt_type) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thoughts_project_session ON stored_thoughts(project_id, session_id) WHERE project_id IS NOT NULL;

-- Project + time-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_project_time ON reasoning_sessions(project_id, start_time DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_project_time ON stored_prompts(project_id, received_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thoughts_project_time ON stored_thoughts(project_id, timestamp DESC) WHERE project_id IS NOT NULL;

-- Project + success/quality metrics
CREATE INDEX IF NOT EXISTS idx_sessions_project_success ON reasoning_sessions(project_id, goal_achieved) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thoughts_project_success ON stored_thoughts(project_id, success) WHERE project_id IS NOT NULL AND success IS NOT NULL;

-- =============================================================================
-- TIMESCALEDB INTEGRATION FOR PROJECTS
-- =============================================================================

\echo 'Integrating projects with TimescaleDB (if available)...'

-- Extend TimescaleDB support for projects table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'TimescaleDB detected, creating projects hypertable...';
        
        -- Convert projects to hypertable for time-series analytics
        PERFORM create_hypertable('projects', 'created_at', 
            chunk_time_interval => INTERVAL '30 days',
            if_not_exists => TRUE
        );
        
        RAISE NOTICE 'Projects hypertable created successfully';
    ELSE
        RAISE NOTICE 'TimescaleDB not available, using regular PostgreSQL tables for projects';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB setup for projects failed, continuing with regular tables: %', SQLERRM;
END $$;

-- =============================================================================
-- ADVANCED SEARCH FUNCTIONS
-- =============================================================================

\echo 'Creating advanced search functions for project intelligence...'

-- Function to find projects by technology stack
CREATE OR REPLACE FUNCTION find_projects_by_technology(tech_list TEXT[])
RETURNS TABLE(project_id UUID, project_name TEXT, directory_path TEXT, match_count INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.project_name,
        p.directory_path,
        array_length(p.technology_stack & tech_list, 1) as match_count
    FROM projects p
    WHERE p.technology_stack && tech_list
    ORDER BY match_count DESC, p.last_activity_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get project activity summary
CREATE OR REPLACE FUNCTION get_project_activity_summary(project_uuid UUID)
RETURNS TABLE(
    total_sessions BIGINT,
    total_thoughts BIGINT,
    total_prompts BIGINT,
    avg_session_length NUMERIC,
    success_rate NUMERIC,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT rs.id) as total_sessions,
        COUNT(st.id) as total_thoughts,
        COUNT(DISTINCT sp.id) as total_prompts,
        AVG(rs.total_thoughts)::NUMERIC as avg_session_length,
        (COUNT(*) FILTER (WHERE rs.goal_achieved = TRUE)::NUMERIC / NULLIF(COUNT(DISTINCT rs.id), 0))::NUMERIC as success_rate,
        MAX(GREATEST(rs.start_time, st.timestamp, sp.received_at)) as last_activity
    FROM projects p
    LEFT JOIN reasoning_sessions rs ON p.id = rs.project_id
    LEFT JOIN stored_thoughts st ON p.id = st.project_id
    LEFT JOIN stored_prompts sp ON p.id = sp.project_id
    WHERE p.id = project_uuid
    GROUP BY p.id;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar projects by technology stack
CREATE OR REPLACE FUNCTION find_similar_projects(target_project_uuid UUID, similarity_threshold NUMERIC DEFAULT 0.3)
RETURNS TABLE(
    project_id UUID,
    project_name TEXT,
    directory_path TEXT,
    technology_overlap TEXT[],
    similarity_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH target_project AS (
        SELECT technology_stack
        FROM projects
        WHERE id = target_project_uuid
    )
    SELECT 
        p.id,
        p.project_name,
        p.directory_path,
        p.technology_stack & tp.technology_stack as technology_overlap,
        (array_length(p.technology_stack & tp.technology_stack, 1)::NUMERIC / 
         GREATEST(array_length(p.technology_stack, 1), array_length(tp.technology_stack, 1), 1))::NUMERIC as similarity_score
    FROM projects p, target_project tp
    WHERE p.id != target_project_uuid
      AND p.technology_stack && tp.technology_stack
      AND (array_length(p.technology_stack & tp.technology_stack, 1)::NUMERIC / 
           GREATEST(array_length(p.technology_stack, 1), array_length(tp.technology_stack, 1), 1)) >= similarity_threshold
    ORDER BY similarity_score DESC, p.last_activity_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- UPDATE TRIGGERS FOR PROJECT ACTIVITY TRACKING
-- =============================================================================

\echo 'Creating triggers for automatic project activity tracking...'

-- Function to update project activity
CREATE OR REPLACE FUNCTION update_project_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_activity_at for the associated project
    IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL THEN
        UPDATE projects 
        SET last_activity_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.project_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for activity tracking
DROP TRIGGER IF EXISTS trigger_session_project_activity ON reasoning_sessions;
CREATE TRIGGER trigger_session_project_activity
    AFTER INSERT ON reasoning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_project_activity();

DROP TRIGGER IF EXISTS trigger_prompt_project_activity ON stored_prompts;
CREATE TRIGGER trigger_prompt_project_activity
    AFTER INSERT ON stored_prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_project_activity();

DROP TRIGGER IF EXISTS trigger_thought_project_activity ON stored_thoughts;
CREATE TRIGGER trigger_thought_project_activity
    AFTER INSERT ON stored_thoughts
    FOR EACH ROW
    EXECUTE FUNCTION update_project_activity();

-- Function to update project statistics
CREATE OR REPLACE FUNCTION update_project_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update project statistics when sessions/thoughts/prompts are added
    IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL THEN
        UPDATE projects 
        SET total_sessions = (
                SELECT COUNT(*) FROM reasoning_sessions WHERE project_id = NEW.project_id
            ),
            total_thoughts = (
                SELECT COUNT(*) FROM stored_thoughts WHERE project_id = NEW.project_id
            ),
            total_prompts = (
                SELECT COUNT(*) FROM stored_prompts WHERE project_id = NEW.project_id
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.project_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for statistics tracking (run after activity triggers)
DROP TRIGGER IF EXISTS trigger_session_project_stats ON reasoning_sessions;
CREATE TRIGGER trigger_session_project_stats
    AFTER INSERT ON reasoning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_project_statistics();

DROP TRIGGER IF EXISTS trigger_prompt_project_stats ON stored_prompts;
CREATE TRIGGER trigger_prompt_project_stats
    AFTER INSERT ON stored_prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_project_statistics();

DROP TRIGGER IF EXISTS trigger_thought_project_stats ON stored_thoughts;
CREATE TRIGGER trigger_thought_project_stats
    AFTER INSERT ON stored_thoughts
    FOR EACH ROW
    EXECUTE FUNCTION update_project_statistics();

-- =============================================================================
-- SAMPLE PROJECT DATA FOR VERIFICATION
-- =============================================================================

\echo 'Inserting sample project data for verification...'

-- Insert sample project
INSERT INTO projects (
    id,
    directory_path,
    project_name,
    description,
    technology_stack,
    project_type,
    programming_languages,
    cognitive_settings,
    project_metadata
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    '/home/user/sample-project',
    'Sample AGI Project',
    'A sample project demonstrating normalized project schema capabilities',
    ARRAY['typescript', 'nodejs', 'postgresql', 'ai'],
    'ai-system',
    ARRAY['typescript', 'sql'],
    '{"preferred_persona": "Engineer", "complexity_preference": "medium", "learning_mode": "adaptive"}'::jsonb,
    '{"priority": "high", "stage": "development", "tags": ["sample", "demo", "ai-reasoning"]}'::jsonb
) ON CONFLICT (directory_path) DO NOTHING;

-- Link existing sample session to the project
UPDATE reasoning_sessions 
SET project_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE id = 'sample_session_init';

-- Link existing sample thought to the project  
UPDATE stored_thoughts
SET project_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE id = 'sample_thought_init';

-- =============================================================================
-- SCHEMA VERIFICATION
-- =============================================================================

\echo 'Running project schema verification...'

-- Verify projects table structure
SELECT 
    'Projects Table' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND table_schema = 'public';

-- Verify foreign key relationships
SELECT 
    'Foreign Keys' as status,
    COUNT(*) as fk_count
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'project_id'
  AND tc.table_schema = 'public';

-- Verify project indexes
SELECT 
    'Project Indexes' as status,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'projects'
  AND schemaname = 'public';

-- Verify sample project data
SELECT 
    'Sample Project' as status,
    COUNT(*) as project_count,
    (SELECT COUNT(*) FROM reasoning_sessions WHERE project_id IS NOT NULL) as linked_sessions,
    (SELECT COUNT(*) FROM stored_thoughts WHERE project_id IS NOT NULL) as linked_thoughts
FROM projects 
WHERE directory_path = '/home/user/sample-project';

-- Verify search functions
SELECT 
    'Search Functions' as status,
    COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%project%';

-- Verify triggers
SELECT 
    'Project Triggers' as status,
    COUNT(*) as trigger_count
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('reasoning_sessions', 'stored_prompts', 'stored_thoughts')
  AND t.tgname LIKE '%project%';

\echo 'Normalized project schema extension completed successfully!';
\echo '';
\echo 'Enhanced features added:';
\echo '  ✓ Normalized projects table with comprehensive metadata';
\echo '  ✓ Foreign key relationships across all core tables';
\echo '  ✓ Technology stack and programming language tracking';
\echo '  ✓ Project lifecycle management (active, archived)';
\echo '  ✓ Cognitive settings per project';
\echo '  ✓ Advanced search functions and similarity matching';
\echo '  ✓ Automatic activity and statistics tracking';
\echo '  ✓ Performance-optimized indexes';
\echo '  ✓ TimescaleDB integration for time-series analytics';
\echo '  ✓ Backward compatibility with nullable foreign keys';
\echo '';
\echo 'Project-aware cognitive intelligence is now available!';