-- PostgreSQL Schema Extension for Thought Analysis
-- Extends the existing Sentient AGI Reasoning Server schema with thought analysis capabilities
-- Run order: 05 (after core schema and analytics are initialized)

\echo 'Creating Thought Analysis extension tables...'

-- Enable error reporting
\set ON_ERROR_STOP on

-- =============================================================================
-- THOUGHT ANALYSIS TABLE
-- =============================================================================

\echo 'Creating thought_analysis table...'

CREATE TABLE IF NOT EXISTS thought_analysis (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
    thought_chain_ids TEXT[] NOT NULL,
    analysis_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Tier 1 Metrics: Technical Quality (Infrastructure)
    parameter_adherence DECIMAL(4,3) CHECK (parameter_adherence >= 0.0 AND parameter_adherence <= 1.0),
    sequential_integrity DECIMAL(4,3) CHECK (sequential_integrity >= 0.0 AND sequential_integrity <= 1.0),
    branching_effectiveness DECIMAL(4,3) CHECK (branching_effectiveness >= 0.0 AND branching_effectiveness <= 1.0),
    revision_improvement DECIMAL(4,3) CHECK (revision_improvement >= 0.0 AND revision_improvement <= 1.0),
    
    -- Tier 2 Metrics: Cognitive Quality (AI Components)
    logical_coherence DECIMAL(4,3) CHECK (logical_coherence >= 0.0 AND logical_coherence <= 1.0),
    depth_progression DECIMAL(4,3) CHECK (depth_progression >= 0.0 AND depth_progression <= 1.0),
    metacognitive_awareness DECIMAL(4,3) CHECK (metacognitive_awareness >= 0.0 AND metacognitive_awareness <= 1.0),
    creative_synthesis DECIMAL(4,3) CHECK (creative_synthesis >= 0.0 AND creative_synthesis <= 1.0),
    
    -- Tier 3 Metrics: Learning Quality (Advanced Capabilities)
    pattern_recognition DECIMAL(4,3) CHECK (pattern_recognition >= 0.0 AND pattern_recognition <= 1.0),
    cross_session_transfer DECIMAL(4,3) CHECK (cross_session_transfer >= 0.0 AND cross_session_transfer <= 1.0),
    failure_mode_avoidance DECIMAL(4,3) CHECK (failure_mode_avoidance >= 0.0 AND failure_mode_avoidance <= 1.0),
    adaptation_speed DECIMAL(4,3) CHECK (adaptation_speed >= 0.0 AND adaptation_speed <= 1.0),
    
    -- Analysis Metadata
    analysis_confidence DECIMAL(4,3) CHECK (analysis_confidence >= 0.0 AND analysis_confidence <= 1.0),
    processing_time_ms INTEGER CHECK (processing_time_ms >= 0),
    analysis_version VARCHAR(20) DEFAULT '1.0.0',
    
    -- Additional contextual data
    thought_chain_length INTEGER NOT NULL CHECK (thought_chain_length > 0),
    revision_count INTEGER DEFAULT 0 CHECK (revision_count >= 0),
    branch_count INTEGER DEFAULT 0 CHECK (branch_count >= 0),
    
    -- Quality scores by tier (aggregated)
    tier1_score DECIMAL(4,3) CHECK (tier1_score >= 0.0 AND tier1_score <= 1.0),
    tier2_score DECIMAL(4,3) CHECK (tier2_score >= 0.0 AND tier2_score <= 1.0),
    tier3_score DECIMAL(4,3) CHECK (tier3_score >= 0.0 AND tier3_score <= 1.0),
    overall_score DECIMAL(4,3) CHECK (overall_score >= 0.0 AND overall_score <= 1.0),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- THOUGHT ANALYSIS INDEXES
-- =============================================================================

\echo 'Creating thought analysis indexes...'

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_thought_analysis_session ON thought_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_thought_analysis_timestamp ON thought_analysis(analysis_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_thought_analysis_overall_score ON thought_analysis(overall_score DESC);

-- Performance and filtering indexes
CREATE INDEX IF NOT EXISTS idx_thought_analysis_confidence ON thought_analysis(analysis_confidence) WHERE analysis_confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thought_analysis_processing_time ON thought_analysis(processing_time_ms) WHERE processing_time_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thought_analysis_chain_length ON thought_analysis(thought_chain_length);

-- Tier-specific indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_thought_analysis_tier1 ON thought_analysis(tier1_score DESC) WHERE tier1_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thought_analysis_tier2 ON thought_analysis(tier2_score DESC) WHERE tier2_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thought_analysis_tier3 ON thought_analysis(tier3_score DESC) WHERE tier3_score IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_thought_analysis_session_time ON thought_analysis(session_id, analysis_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_thought_analysis_version_time ON thought_analysis(analysis_version, analysis_timestamp DESC);

-- GIN index for thought_chain_ids array
CREATE INDEX IF NOT EXISTS idx_thought_analysis_chain_ids ON thought_analysis USING GIN (thought_chain_ids);

-- =============================================================================
-- TIMESCALEDB SETUP FOR THOUGHT ANALYSIS (IF AVAILABLE)
-- =============================================================================

\echo 'Setting up TimescaleDB for thought_analysis (if available)...'

-- Convert to hypertable only if TimescaleDB extension exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'TimescaleDB detected, creating thought_analysis hypertable...';
        
        -- Convert thought_analysis to hypertable
        PERFORM create_hypertable('thought_analysis', 'analysis_timestamp', 
            chunk_time_interval => INTERVAL '7 days',
            if_not_exists => TRUE
        );
        
        RAISE NOTICE 'TimescaleDB hypertable for thought_analysis created successfully';
    ELSE
        RAISE NOTICE 'TimescaleDB not available, using regular PostgreSQL table for thought_analysis';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB setup failed for thought_analysis, continuing with regular table: %', SQLERRM;
END $$;

-- =============================================================================
-- SAMPLE ANALYSIS DATA FOR VERIFICATION
-- =============================================================================

\echo 'Inserting sample thought analysis data for verification...';

-- Insert sample thought analysis record
INSERT INTO thought_analysis (
    session_id,
    thought_chain_ids,
    thought_chain_length,
    revision_count,
    branch_count,
    
    -- Tier 1 metrics
    parameter_adherence,
    sequential_integrity,
    branching_effectiveness,
    revision_improvement,
    
    -- Tier 2 metrics
    logical_coherence,
    depth_progression,
    metacognitive_awareness,
    creative_synthesis,
    
    -- Tier 3 metrics
    pattern_recognition,
    cross_session_transfer,
    failure_mode_avoidance,
    adaptation_speed,
    
    -- Metadata
    analysis_confidence,
    processing_time_ms,
    analysis_version,
    
    -- Tier scores
    tier1_score,
    tier2_score,
    tier3_score,
    overall_score
) VALUES (
    'sample_session_init',
    ARRAY['sample_thought_init'],
    1,
    0,
    0,
    
    -- Tier 1: High technical quality for sample
    0.995,  -- parameter_adherence
    1.000,  -- sequential_integrity  
    0.850,  -- branching_effectiveness
    0.750,  -- revision_improvement
    
    -- Tier 2: Good cognitive quality for sample
    0.820,  -- logical_coherence
    0.750,  -- depth_progression
    0.800,  -- metacognitive_awareness
    0.600,  -- creative_synthesis
    
    -- Tier 3: Moderate learning effectiveness for sample
    0.700,  -- pattern_recognition
    0.650,  -- cross_session_transfer
    0.800,  -- failure_mode_avoidance
    0.550,  -- adaptation_speed
    
    -- Metadata
    0.875,  -- analysis_confidence
    250,    -- processing_time_ms
    '1.0.0', -- analysis_version
    
    -- Calculated tier scores
    0.899,  -- tier1_score (avg of tier 1 metrics)
    0.743,  -- tier2_score (avg of tier 2 metrics)
    0.675,  -- tier3_score (avg of tier 3 metrics)
    0.772   -- overall_score (weighted average)
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

\echo 'Running thought analysis schema verification...';

-- Verify table creation
SELECT 
    'Thought Analysis Table' as status,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'thought_analysis') as created;

-- Verify sample data insertion
SELECT 
    'Sample Analysis Data' as status,
    COUNT(*) as analysis_records
FROM thought_analysis 
WHERE session_id = 'sample_session_init';

-- Verify constraints
SELECT 
    'Analysis Constraints' as status,
    COUNT(*) as constraint_count
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%thought_analysis%';

-- Verify indexes
SELECT 
    'Analysis Indexes' as status,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'thought_analysis';

-- Verify metric ranges (all should be within 0-1)
SELECT 
    'Metric Validation' as status,
    CASE 
        WHEN MIN(parameter_adherence) >= 0 AND MAX(parameter_adherence) <= 1 
             AND MIN(overall_score) >= 0 AND MAX(overall_score) <= 1
        THEN 'Valid'
        ELSE 'Invalid'
    END as metric_ranges
FROM thought_analysis;

\echo 'Thought Analysis schema extension completed successfully!';
\echo '';
\echo 'Added features:';
\echo '  ✓ thought_analysis table with 12 quality metrics';
\echo '  ✓ 3-tier analysis structure (Infrastructure, AI Components, Advanced Capabilities)';
\echo '  ✓ Comprehensive indexing for performance';
\echo '  ✓ TimescaleDB integration (if available)';
\echo '  ✓ Data integrity constraints and validation';
\echo '  ✓ Sample analysis data for verification';
\echo '';
\echo 'Ready for thought chain analysis workloads!';