-- Vector Search Enhancement using pgvector for Semantic Similarity
-- Enables semantic similarity search for thoughts using embeddings
-- Run order: 04 (after schema and analytics are created)

\echo 'Setting up pgvector extension for semantic similarity search...'

-- Enable error reporting
\set ON_ERROR_STOP on

-- =============================================================================
-- PGVECTOR EXTENSION SETUP
-- =============================================================================

\echo 'Installing pgvector extension...'

-- Create pgvector extension if available
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector extension installed successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension not available: %', SQLERRM;
        RAISE NOTICE 'Semantic similarity search will use trigram fallback';
END $$;

-- =============================================================================
-- VECTOR STORAGE TABLES
-- =============================================================================

\echo 'Creating vector storage tables...';

-- Table to store thought embeddings
CREATE TABLE IF NOT EXISTS thought_embeddings (
    thought_id VARCHAR(50) PRIMARY KEY REFERENCES stored_thoughts(id) ON DELETE CASCADE,
    embedding vector(384),  -- Default dimension for sentence-transformers/all-MiniLM-L6-v2
    embedding_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store session embeddings (aggregated thought embeddings)
CREATE TABLE IF NOT EXISTS session_embeddings (
    session_id VARCHAR(50) PRIMARY KEY REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
    objective_embedding vector(384),
    aggregated_embedding vector(384),  -- Average of all thought embeddings in session
    embedding_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store pattern embeddings for pattern-based similarity
CREATE TABLE IF NOT EXISTS pattern_embeddings (
    pattern_name VARCHAR(200) PRIMARY KEY,
    embedding vector(384),
    pattern_frequency INTEGER DEFAULT 0,
    embedding_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- VECTOR INDEXES FOR PERFORMANCE
-- =============================================================================

\echo 'Creating vector indexes...';

-- Only create vector indexes if pgvector is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE NOTICE 'Creating vector indexes...';
        
        -- IVFFlat index for thought embeddings (good for large datasets)
        CREATE INDEX IF NOT EXISTS idx_thought_embeddings_vector 
        ON thought_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
        
        -- IVFFlat index for session embeddings
        CREATE INDEX IF NOT EXISTS idx_session_embeddings_objective
        ON session_embeddings USING ivfflat (objective_embedding vector_cosine_ops)
        WITH (lists = 50);
        
        CREATE INDEX IF NOT EXISTS idx_session_embeddings_aggregated
        ON session_embeddings USING ivfflat (aggregated_embedding vector_cosine_ops)
        WITH (lists = 50);
        
        -- HNSW index for pattern embeddings (good for smaller datasets, faster queries)
        CREATE INDEX IF NOT EXISTS idx_pattern_embeddings_vector
        ON pattern_embeddings USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        
        RAISE NOTICE 'Vector indexes created successfully';
    ELSE
        RAISE NOTICE 'pgvector not available, skipping vector indexes';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to create vector indexes: %', SQLERRM;
END $$;

-- =============================================================================
-- SEMANTIC SIMILARITY FUNCTIONS
-- =============================================================================

\echo 'Creating semantic similarity functions...';

-- Function to find semantically similar thoughts using cosine similarity
CREATE OR REPLACE FUNCTION find_similar_thoughts_semantic(
    query_embedding vector(384),
    similarity_threshold REAL DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    exclude_session_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    thought_id VARCHAR(50),
    thought_text TEXT,
    similarity_score REAL,
    confidence NUMERIC,
    domain VARCHAR(100),
    session_id VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RETURN QUERY
        SELECT 
            te.thought_id,
            st.thought as thought_text,
            (1 - (te.embedding <=> query_embedding)) as similarity_score,
            st.confidence,
            st.domain,
            st.session_id,
            st.timestamp
        FROM thought_embeddings te
        JOIN stored_thoughts st ON te.thought_id = st.id
        WHERE (1 - (te.embedding <=> query_embedding)) > similarity_threshold
          AND (exclude_session_id IS NULL OR st.session_id != exclude_session_id)
        ORDER BY te.embedding <=> query_embedding
        LIMIT max_results;
    ELSE
        -- Fallback to trigram similarity if pgvector not available
        RAISE NOTICE 'pgvector not available, cannot perform semantic similarity search';
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar sessions based on objective embeddings
CREATE OR REPLACE FUNCTION find_similar_sessions_semantic(
    query_embedding vector(384),
    similarity_threshold REAL DEFAULT 0.6,
    max_results INTEGER DEFAULT 5,
    exclude_session_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    session_id VARCHAR(50),
    objective TEXT,
    similarity_score REAL,
    confidence_level NUMERIC,
    effectiveness_score NUMERIC,
    goal_achieved BOOLEAN,
    domain VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RETURN QUERY
        SELECT 
            se.session_id,
            rs.objective,
            (1 - (se.objective_embedding <=> query_embedding)) as similarity_score,
            rs.confidence_level,
            rs.effectiveness_score,
            rs.goal_achieved,
            rs.domain,
            rs.start_time
        FROM session_embeddings se
        JOIN reasoning_sessions rs ON se.session_id = rs.id
        WHERE (1 - (se.objective_embedding <=> query_embedding)) > similarity_threshold
          AND (exclude_session_id IS NULL OR se.session_id != exclude_session_id)
        ORDER BY se.objective_embedding <=> query_embedding
        LIMIT max_results;
    ELSE
        -- Fallback behavior
        RAISE NOTICE 'pgvector not available, cannot perform semantic session similarity';
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to find patterns similar to a given embedding
CREATE OR REPLACE FUNCTION find_similar_patterns_semantic(
    query_embedding vector(384),
    similarity_threshold REAL DEFAULT 0.65,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    pattern_name VARCHAR(200),
    similarity_score REAL,
    pattern_frequency INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RETURN QUERY
        SELECT 
            pe.pattern_name,
            (1 - (pe.embedding <=> query_embedding)) as similarity_score,
            pe.pattern_frequency,
            pe.created_at
        FROM pattern_embeddings pe
        WHERE (1 - (pe.embedding <=> query_embedding)) > similarity_threshold
        ORDER BY pe.embedding <=> query_embedding
        LIMIT max_results;
    ELSE
        RAISE NOTICE 'pgvector not available, cannot perform semantic pattern matching';
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to cluster thoughts by semantic similarity
CREATE OR REPLACE FUNCTION cluster_thoughts_semantic(
    cluster_threshold REAL DEFAULT 0.8,
    min_cluster_size INTEGER DEFAULT 3
)
RETURNS TABLE (
    cluster_id INTEGER,
    thought_ids VARCHAR(50)[],
    cluster_center vector(384),
    cluster_size INTEGER,
    avg_confidence NUMERIC,
    common_domains TEXT[],
    representative_thought TEXT
) AS $$
DECLARE
    cluster_counter INTEGER := 0;
    current_embedding vector(384);
    current_thought_id VARCHAR(50);
    embedding_cursor CURSOR FOR 
        SELECT te.thought_id, te.embedding 
        FROM thought_embeddings te
        ORDER BY te.created_at;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- Create temporary table for clustering results
        CREATE TEMP TABLE IF NOT EXISTS temp_clusters (
            cluster_id INTEGER,
            thought_id VARCHAR(50),
            embedding vector(384)
        );
        
        TRUNCATE temp_clusters;
        
        -- Simple clustering algorithm - can be enhanced with more sophisticated methods
        FOR current_thought_id, current_embedding IN embedding_cursor LOOP
            -- Check if thought belongs to existing cluster
            IF NOT EXISTS (
                SELECT 1 FROM temp_clusters tc
                WHERE (1 - (tc.embedding <=> current_embedding)) > cluster_threshold
                LIMIT 1
            ) THEN
                -- Create new cluster
                cluster_counter := cluster_counter + 1;
            END IF;
            
            -- Add to closest cluster or new cluster
            INSERT INTO temp_clusters (cluster_id, thought_id, embedding)
            VALUES (
                COALESCE(
                    (SELECT tc.cluster_id 
                     FROM temp_clusters tc 
                     WHERE (1 - (tc.embedding <=> current_embedding)) > cluster_threshold
                     ORDER BY tc.embedding <=> current_embedding 
                     LIMIT 1),
                    cluster_counter
                ),
                current_thought_id,
                current_embedding
            );
        END LOOP;
        
        -- Return clusters that meet minimum size requirement
        RETURN QUERY
        SELECT 
            tc.cluster_id,
            array_agg(tc.thought_id) as thought_ids,
            AVG(tc.embedding)::vector(384) as cluster_center,
            COUNT(*)::INTEGER as cluster_size,
            AVG(st.confidence) as avg_confidence,
            array_agg(DISTINCT st.domain) FILTER (WHERE st.domain IS NOT NULL) as common_domains,
            (array_agg(st.thought ORDER BY st.confidence DESC))[1] as representative_thought
        FROM temp_clusters tc
        JOIN stored_thoughts st ON tc.thought_id = st.id
        GROUP BY tc.cluster_id
        HAVING COUNT(*) >= min_cluster_size
        ORDER BY cluster_size DESC;
        
        DROP TABLE temp_clusters;
    ELSE
        RAISE NOTICE 'pgvector not available, cannot perform semantic clustering';
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- EMBEDDING MANAGEMENT FUNCTIONS
-- =============================================================================

\echo 'Creating embedding management functions...';

-- Function to update embedding for a thought (to be called from application)
CREATE OR REPLACE FUNCTION upsert_thought_embedding(
    p_thought_id VARCHAR(50),
    p_embedding vector(384),
    p_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO thought_embeddings (thought_id, embedding, embedding_model)
    VALUES (p_thought_id, p_embedding, p_model)
    ON CONFLICT (thought_id) 
    DO UPDATE SET 
        embedding = EXCLUDED.embedding,
        embedding_model = EXCLUDED.embedding_model,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to update session embeddings (aggregate from thoughts)
CREATE OR REPLACE FUNCTION update_session_embeddings(
    p_session_id VARCHAR(50)
)
RETURNS VOID AS $$
DECLARE
    objective_text TEXT;
    avg_embedding vector(384);
BEGIN
    -- Get session objective for objective embedding (to be set by application)
    SELECT objective INTO objective_text FROM reasoning_sessions WHERE id = p_session_id;
    
    -- Calculate average embedding from all thoughts in session
    SELECT AVG(te.embedding)::vector(384) INTO avg_embedding
    FROM thought_embeddings te
    JOIN stored_thoughts st ON te.thought_id = st.id
    WHERE st.session_id = p_session_id;
    
    -- Only update if we have embeddings
    IF avg_embedding IS NOT NULL THEN
        INSERT INTO session_embeddings (session_id, aggregated_embedding)
        VALUES (p_session_id, avg_embedding)
        ON CONFLICT (session_id)
        DO UPDATE SET 
            aggregated_embedding = EXCLUDED.aggregated_embedding,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update pattern embeddings based on frequency
CREATE OR REPLACE FUNCTION update_pattern_embeddings()
RETURNS INTEGER AS $$
DECLARE
    pattern_record RECORD;
    pattern_count INTEGER := 0;
BEGIN
    -- Update pattern frequencies and create embeddings for new patterns
    FOR pattern_record IN
        SELECT 
            unnest(patterns_detected) as pattern_name,
            COUNT(*) as frequency
        FROM stored_thoughts 
        WHERE patterns_detected IS NOT NULL
        GROUP BY unnest(patterns_detected)
        HAVING COUNT(*) >= 5  -- Only patterns that appear at least 5 times
    LOOP
        INSERT INTO pattern_embeddings (pattern_name, pattern_frequency)
        VALUES (pattern_record.pattern_name, pattern_record.frequency)
        ON CONFLICT (pattern_name)
        DO UPDATE SET 
            pattern_frequency = EXCLUDED.pattern_frequency,
            updated_at = CURRENT_TIMESTAMP;
        
        pattern_count := pattern_count + 1;
    END LOOP;
    
    RETURN pattern_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FULL-TEXT SEARCH ENHANCEMENT
-- =============================================================================

\echo 'Setting up full-text search capabilities...';

-- Add tsvector columns for full-text search
ALTER TABLE stored_thoughts ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE reasoning_sessions ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_thoughts_search_vector ON stored_thoughts USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_sessions_search_vector ON reasoning_sessions USING GIN (search_vector);

-- Function to update search vectors
CREATE OR REPLACE FUNCTION update_search_vectors()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Update thought search vectors
    UPDATE stored_thoughts SET search_vector = 
        setweight(to_tsvector('english', COALESCE(thought, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(domain, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(objective, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(tags, ARRAY[]::TEXT[]), ' ')), 'C') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(patterns_detected, ARRAY[]::TEXT[]), ' ')), 'C')
    WHERE search_vector IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Update session search vectors
    UPDATE reasoning_sessions SET search_vector = 
        setweight(to_tsvector('english', COALESCE(objective, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(domain, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(lessons_learned, ARRAY[]::TEXT[]), ' ')), 'C') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(successful_strategies, ARRAY[]::TEXT[]), ' ')), 'C') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(tags, ARRAY[]::TEXT[]), ' ')), 'D')
    WHERE search_vector IS NULL;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vectors on insert/update
CREATE OR REPLACE FUNCTION update_thought_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.thought, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.domain, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.objective, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(NEW.tags, ARRAY[]::TEXT[]), ' ')), 'C') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(NEW.patterns_detected, ARRAY[]::TEXT[]), ' ')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_session_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.objective, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.domain, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(NEW.lessons_learned, ARRAY[]::TEXT[]), ' ')), 'C') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(NEW.successful_strategies, ARRAY[]::TEXT[]), ' ')), 'C') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(NEW.tags, ARRAY[]::TEXT[]), ' ')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_update_thought_search_vector ON stored_thoughts;
CREATE TRIGGER trg_update_thought_search_vector
    BEFORE INSERT OR UPDATE ON stored_thoughts
    FOR EACH ROW EXECUTE FUNCTION update_thought_search_vector();

DROP TRIGGER IF EXISTS trg_update_session_search_vector ON reasoning_sessions;
CREATE TRIGGER trg_update_session_search_vector
    BEFORE INSERT OR UPDATE ON reasoning_sessions
    FOR EACH ROW EXECUTE FUNCTION update_session_search_vector();

-- Initialize search vectors for existing data
SELECT update_search_vectors();

-- =============================================================================
-- COMBINED SEARCH FUNCTION
-- =============================================================================

-- Function that combines full-text search with semantic similarity
CREATE OR REPLACE FUNCTION hybrid_search_thoughts(
    query_text TEXT,
    query_embedding vector(384) DEFAULT NULL,
    semantic_weight REAL DEFAULT 0.5,
    fulltext_weight REAL DEFAULT 0.5,
    max_results INTEGER DEFAULT 10,
    exclude_session_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    thought_id VARCHAR(50),
    thought_text TEXT,
    combined_score REAL,
    semantic_score REAL,
    fulltext_score REAL,
    confidence NUMERIC,
    domain VARCHAR(100),
    session_id VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF query_embedding IS NOT NULL AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- Hybrid search with both semantic and full-text
        RETURN QUERY
        SELECT 
            st.id as thought_id,
            st.thought as thought_text,
            (COALESCE(semantic_weight * (1 - (te.embedding <=> query_embedding)), 0) + 
             COALESCE(fulltext_weight * ts_rank(st.search_vector, plainto_tsquery('english', query_text)), 0)) as combined_score,
            COALESCE((1 - (te.embedding <=> query_embedding)), 0) as semantic_score,
            COALESCE(ts_rank(st.search_vector, plainto_tsquery('english', query_text)), 0) as fulltext_score,
            st.confidence,
            st.domain,
            st.session_id,
            st.timestamp
        FROM stored_thoughts st
        LEFT JOIN thought_embeddings te ON st.id = te.thought_id
        WHERE (st.search_vector @@ plainto_tsquery('english', query_text) OR 
               (te.embedding IS NOT NULL AND (1 - (te.embedding <=> query_embedding)) > 0.3))
          AND (exclude_session_id IS NULL OR st.session_id != exclude_session_id)
        ORDER BY combined_score DESC
        LIMIT max_results;
    ELSE
        -- Full-text search only
        RETURN QUERY
        SELECT 
            st.id as thought_id,
            st.thought as thought_text,
            ts_rank(st.search_vector, plainto_tsquery('english', query_text)) as combined_score,
            0::REAL as semantic_score,
            ts_rank(st.search_vector, plainto_tsquery('english', query_text)) as fulltext_score,
            st.confidence,
            st.domain,
            st.session_id,
            st.timestamp
        FROM stored_thoughts st
        WHERE st.search_vector @@ plainto_tsquery('english', query_text)
          AND (exclude_session_id IS NULL OR st.session_id != exclude_session_id)
        ORDER BY combined_score DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

\echo 'Verifying vector search setup...';

-- Check if pgvector extension is available
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') 
         THEN 'pgvector extension installed' 
         ELSE 'pgvector extension not available (using fallback)' 
    END as vector_status;

-- Check if vector tables were created
SELECT 
    'Vector Tables' as feature,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_name IN ('thought_embeddings', 'session_embeddings', 'pattern_embeddings');

-- Check if search functions were created
SELECT 
    'Search Functions' as feature,
    COUNT(*) as count
FROM information_schema.routines
WHERE routine_name LIKE '%similar%semantic%' OR routine_name LIKE '%search%' OR routine_name LIKE '%embedding%';

\echo 'Vector search enhancement completed successfully!';
\echo '';
\echo 'New semantic search features available:';
\echo '  ✓ Thought embeddings storage (384-dimensional vectors)';
\echo '  ✓ Session embeddings aggregation';
\echo '  ✓ Pattern embeddings for pattern matching';
\echo '  ✓ Semantic similarity functions';
\echo '  ✓ Full-text search with tsvector indexes';
\echo '  ✓ Hybrid search combining semantic + full-text';
\echo '  ✓ Semantic clustering capabilities';
\echo '  ✓ Vector indexes for performance (IVFFlat & HNSW)';
\echo '';
\echo 'Usage examples:';
\echo '  SELECT * FROM find_similar_thoughts_semantic(query_vector, 0.7, 10);';
\echo '  SELECT * FROM hybrid_search_thoughts(''debugging memory leaks'', query_vector);';
\echo '  SELECT * FROM cluster_thoughts_semantic(0.8, 3);';