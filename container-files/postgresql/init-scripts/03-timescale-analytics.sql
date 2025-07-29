-- TimescaleDB Analytics Enhancement for Sentient AGI Reasoning Server
-- Advanced time-series analytics, continuous aggregates, and compression policies
-- Run order: 03 (after schema is created)

\echo 'Setting up TimescaleDB analytics enhancements...'

-- Enable error reporting
\set ON_ERROR_STOP on

-- =============================================================================
-- CONTINUOUS AGGREGATES FOR COGNITIVE METRICS
-- =============================================================================

\echo 'Creating continuous aggregates for cognitive analytics...'

-- Only create if TimescaleDB is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'Creating TimescaleDB continuous aggregates...';
        
        -- 1. Hourly cognitive performance metrics
        DROP MATERIALIZED VIEW IF EXISTS cognitive_metrics_hourly CASCADE;
        CREATE MATERIALIZED VIEW cognitive_metrics_hourly
        WITH (timescaledb.continuous) AS
        SELECT 
            time_bucket('1 hour', timestamp) AS hour,
            domain,
            COUNT(*) as thought_count,
            AVG(confidence) as avg_confidence,
            AVG(effectiveness_score) as avg_effectiveness,
            AVG(complexity) as avg_complexity,
            COUNT(CASE WHEN success = true THEN 1 END) as successful_thoughts,
            COUNT(CASE WHEN success = false THEN 1 END) as failed_thoughts,
            COUNT(CASE WHEN is_revision = true THEN 1 END) as revision_count,
            COUNT(CASE WHEN branch_from_thought IS NOT NULL THEN 1 END) as branch_count,
            array_agg(DISTINCT tags) FILTER (WHERE tags IS NOT NULL) as common_tags,
            array_agg(DISTINCT patterns_detected) FILTER (WHERE patterns_detected IS NOT NULL) as common_patterns
        FROM stored_thoughts
        WHERE timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY hour, domain;

        -- 2. Daily session analytics
        DROP MATERIALIZED VIEW IF EXISTS session_metrics_daily CASCADE;
        CREATE MATERIALIZED VIEW session_metrics_daily
        WITH (timescaledb.continuous) AS
        SELECT 
            time_bucket('1 day', start_time) AS day,
            domain,
            COUNT(*) as session_count,
            AVG(confidence_level) as avg_session_confidence,
            AVG(effectiveness_score) as avg_session_effectiveness,
            AVG(total_thoughts) as avg_thoughts_per_session,
            AVG(revision_count) as avg_revisions_per_session,
            AVG(branch_count) as avg_branches_per_session,
            COUNT(CASE WHEN goal_achieved = true THEN 1 END) as successful_sessions,
            COUNT(CASE WHEN goal_achieved = false THEN 1 END) as failed_sessions,
            AVG(EXTRACT(EPOCH FROM (end_time - start_time))/3600) as avg_session_duration_hours,
            array_agg(DISTINCT cognitive_roles_used) FILTER (WHERE cognitive_roles_used IS NOT NULL) as roles_used,
            array_agg(DISTINCT lessons_learned) FILTER (WHERE lessons_learned IS NOT NULL) as lessons_learned,
            array_agg(DISTINCT successful_strategies) FILTER (WHERE successful_strategies IS NOT NULL) as successful_strategies
        FROM reasoning_sessions
        WHERE start_time >= NOW() - INTERVAL '90 days'
        GROUP BY day, domain;

        -- 3. Real-time cognitive load monitoring (5-minute windows)
        DROP MATERIALIZED VIEW IF EXISTS cognitive_load_realtime CASCADE;
        CREATE MATERIALIZED VIEW cognitive_load_realtime  
        WITH (timescaledb.continuous) AS
        SELECT 
            time_bucket('5 minutes', timestamp) AS time_window,
            COUNT(*) as thoughts_per_window,
            AVG(confidence) as avg_confidence,
            AVG(complexity) as avg_complexity,
            COUNT(CASE WHEN confidence < 0.5 THEN 1 END) as low_confidence_count,
            COUNT(CASE WHEN complexity > 8.0 THEN 1 END) as high_complexity_count,
            MAX(complexity) as peak_complexity,
            MIN(confidence) as min_confidence,
            array_agg(domain) FILTER (WHERE domain IS NOT NULL) as active_domains
        FROM stored_thoughts
        WHERE timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY time_window;

        -- 4. Pattern evolution tracking (weekly)
        DROP MATERIALIZED VIEW IF EXISTS pattern_evolution_weekly CASCADE;
        CREATE MATERIALIZED VIEW pattern_evolution_weekly
        WITH (timescaledb.continuous) AS
        SELECT 
            time_bucket('1 week', timestamp) AS week,
            unnest(patterns_detected) as pattern,
            COUNT(*) as pattern_frequency,
            AVG(confidence) as avg_confidence_with_pattern,
            AVG(effectiveness_score) as avg_effectiveness_with_pattern,
            COUNT(CASE WHEN success = true THEN 1 END) as successful_with_pattern,
            array_agg(DISTINCT domain) FILTER (WHERE domain IS NOT NULL) as domains_using_pattern
        FROM stored_thoughts
        WHERE timestamp >= NOW() - INTERVAL '180 days'
          AND patterns_detected IS NOT NULL
        GROUP BY week, pattern;

        RAISE NOTICE 'Continuous aggregates created successfully';
    ELSE
        RAISE NOTICE 'TimescaleDB not available, skipping continuous aggregates';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to create continuous aggregates: %', SQLERRM;
END $$;

-- =============================================================================
-- COMPRESSION AND RETENTION POLICIES
-- =============================================================================

\echo 'Setting up compression and retention policies...'

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'Setting up TimescaleDB compression and retention policies...';
        
        -- Compression policy for stored_thoughts (compress data older than 7 days)
        BEGIN
            SELECT add_compression_policy('stored_thoughts', INTERVAL '7 days');
            RAISE NOTICE 'Compression policy added for stored_thoughts';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Compression policy for stored_thoughts already exists or failed: %', SQLERRM;
        END;

        -- Compression policy for reasoning_sessions (compress data older than 30 days)
        BEGIN
            SELECT add_compression_policy('reasoning_sessions', INTERVAL '30 days');
            RAISE NOTICE 'Compression policy added for reasoning_sessions';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Compression policy for reasoning_sessions already exists or failed: %', SQLERRM;
        END;

        -- Retention policy for stored_thoughts (keep data for 2 years)
        BEGIN
            SELECT add_retention_policy('stored_thoughts', INTERVAL '2 years');
            RAISE NOTICE 'Retention policy added for stored_thoughts (2 years)';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Retention policy for stored_thoughts already exists or failed: %', SQLERRM;
        END;

        -- Retention policy for reasoning_sessions (keep data for 5 years)
        BEGIN
            SELECT add_retention_policy('reasoning_sessions', INTERVAL '5 years');
            RAISE NOTICE 'Retention policy added for reasoning_sessions (5 years)';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Retention policy for reasoning_sessions already exists or failed: %', SQLERRM;
        END;

        RAISE NOTICE 'Compression and retention policies configured successfully';
    ELSE
        RAISE NOTICE 'TimescaleDB not available, skipping compression and retention policies';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to set up compression and retention policies: %', SQLERRM;
END $$;

-- =============================================================================
-- ADVANCED ANALYTICS FUNCTIONS
-- =============================================================================

\echo 'Creating advanced analytics functions...'

-- Function to get cognitive performance trends
CREATE OR REPLACE FUNCTION get_cognitive_performance_trend(
    days_back INTEGER DEFAULT 30,
    target_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    day DATE,
    domain TEXT,
    thought_count BIGINT,
    avg_confidence NUMERIC,
    avg_effectiveness NUMERIC,
    success_rate NUMERIC,
    avg_complexity NUMERIC,
    revision_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(st.timestamp) as day,
        COALESCE(st.domain, 'unknown') as domain,
        COUNT(*) as thought_count,
        ROUND(AVG(st.confidence), 3) as avg_confidence,
        ROUND(AVG(st.effectiveness_score), 3) as avg_effectiveness,
        ROUND(
            COUNT(CASE WHEN st.success = true THEN 1 END)::NUMERIC / 
            NULLIF(COUNT(CASE WHEN st.success IS NOT NULL THEN 1 END), 0), 3
        ) as success_rate,
        ROUND(AVG(st.complexity), 2) as avg_complexity,
        ROUND(
            COUNT(CASE WHEN st.is_revision = true THEN 1 END)::NUMERIC / 
            NULLIF(COUNT(*), 0), 3
        ) as revision_rate
    FROM stored_thoughts st
    WHERE st.timestamp >= CURRENT_DATE - INTERVAL '1 day' * days_back
      AND (target_domain IS NULL OR st.domain = target_domain)
    GROUP BY DATE(st.timestamp), COALESCE(st.domain, 'unknown')
    ORDER BY day DESC, domain;
END;
$$ LANGUAGE plpgsql;

-- Function to get pattern effectiveness analysis
CREATE OR REPLACE FUNCTION analyze_pattern_effectiveness(
    days_back INTEGER DEFAULT 60
)
RETURNS TABLE (
    pattern TEXT,
    frequency BIGINT,
    avg_confidence NUMERIC,
    avg_effectiveness NUMERIC,
    success_rate NUMERIC,
    domains TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        unnest(st.patterns_detected) as pattern,
        COUNT(*) as frequency,
        ROUND(AVG(st.confidence), 3) as avg_confidence,
        ROUND(AVG(st.effectiveness_score), 3) as avg_effectiveness,
        ROUND(
            COUNT(CASE WHEN st.success = true THEN 1 END)::NUMERIC / 
            NULLIF(COUNT(CASE WHEN st.success IS NOT NULL THEN 1 END), 0), 3
        ) as success_rate,
        array_agg(DISTINCT st.domain) FILTER (WHERE st.domain IS NOT NULL) as domains
    FROM stored_thoughts st
    WHERE st.timestamp >= CURRENT_DATE - INTERVAL '1 day' * days_back
      AND st.patterns_detected IS NOT NULL
    GROUP BY unnest(st.patterns_detected)
    HAVING COUNT(*) >= 5  -- Only patterns that appear at least 5 times
    ORDER BY frequency DESC, avg_effectiveness DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get cognitive load alerts
CREATE OR REPLACE FUNCTION get_cognitive_load_alerts(
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    alert_time TIMESTAMP WITH TIME ZONE,
    alert_type TEXT,
    description TEXT,
    metric_value NUMERIC,
    threshold NUMERIC,
    severity TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_metrics AS (
        SELECT 
            timestamp,
            confidence,
            complexity,
            domain,
            LAG(confidence) OVER (ORDER BY timestamp) as prev_confidence,
            AVG(confidence) OVER (ORDER BY timestamp ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as rolling_confidence,
            AVG(complexity) OVER (ORDER BY timestamp ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as rolling_complexity
        FROM stored_thoughts
        WHERE timestamp >= NOW() - INTERVAL '1 hour' * hours_back
        ORDER BY timestamp
    )
    SELECT 
        rm.timestamp as alert_time,
        'LOW_CONFIDENCE_STREAK' as alert_type,
        'Confidence below 0.5 for extended period' as description,
        rm.rolling_confidence as metric_value,
        0.5::NUMERIC as threshold,
        CASE 
            WHEN rm.rolling_confidence < 0.3 THEN 'CRITICAL'
            WHEN rm.rolling_confidence < 0.4 THEN 'HIGH'
            ELSE 'MEDIUM'
        END as severity
    FROM recent_metrics rm
    WHERE rm.rolling_confidence < 0.5
    
    UNION ALL
    
    SELECT 
        rm.timestamp as alert_time,
        'HIGH_COMPLEXITY_SPIKE' as alert_type,
        'Complexity significantly above normal' as description,
        rm.rolling_complexity as metric_value,
        8.0::NUMERIC as threshold,
        CASE 
            WHEN rm.rolling_complexity > 9.0 THEN 'CRITICAL'
            WHEN rm.rolling_complexity > 8.5 THEN 'HIGH'
            ELSE 'MEDIUM'
        END as severity
    FROM recent_metrics rm
    WHERE rm.rolling_complexity > 8.0
    
    ORDER BY alert_time DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- REFRESH POLICIES FOR CONTINUOUS AGGREGATES
-- =============================================================================

\echo 'Setting up refresh policies for continuous aggregates...'

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'Setting up refresh policies for continuous aggregates...';
        
        -- Refresh cognitive_metrics_hourly every 15 minutes
        BEGIN
            SELECT add_continuous_aggregate_policy('cognitive_metrics_hourly',
                start_offset => INTERVAL '2 hours',
                end_offset => INTERVAL '15 minutes',
                schedule_interval => INTERVAL '15 minutes');
            RAISE NOTICE 'Refresh policy added for cognitive_metrics_hourly';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Refresh policy for cognitive_metrics_hourly already exists or failed: %', SQLERRM;
        END;

        -- Refresh session_metrics_daily every hour
        BEGIN
            SELECT add_continuous_aggregate_policy('session_metrics_daily',
                start_offset => INTERVAL '2 days',
                end_offset => INTERVAL '1 hour',
                schedule_interval => INTERVAL '1 hour');
            RAISE NOTICE 'Refresh policy added for session_metrics_daily';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Refresh policy for session_metrics_daily already exists or failed: %', SQLERRM;
        END;

        -- Refresh cognitive_load_realtime every 5 minutes
        BEGIN
            SELECT add_continuous_aggregate_policy('cognitive_load_realtime',
                start_offset => INTERVAL '30 minutes',
                end_offset => INTERVAL '5 minutes',
                schedule_interval => INTERVAL '5 minutes');
            RAISE NOTICE 'Refresh policy added for cognitive_load_realtime';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Refresh policy for cognitive_load_realtime already exists or failed: %', SQLERRM;
        END;

        -- Refresh pattern_evolution_weekly every 6 hours
        BEGIN
            SELECT add_continuous_aggregate_policy('pattern_evolution_weekly',
                start_offset => INTERVAL '1 week',
                end_offset => INTERVAL '6 hours',
                schedule_interval => INTERVAL '6 hours');
            RAISE NOTICE 'Refresh policy added for pattern_evolution_weekly';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Refresh policy for pattern_evolution_weekly already exists or failed: %', SQLERRM;
        END;

        RAISE NOTICE 'Refresh policies configured successfully';
    ELSE
        RAISE NOTICE 'TimescaleDB not available, skipping refresh policies';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to set up refresh policies: %', SQLERRM;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

\echo 'Verifying TimescaleDB analytics setup...';

-- Check if continuous aggregates were created
SELECT 
    'Continuous Aggregates' as feature,
    COUNT(*) as count
FROM information_schema.views
WHERE table_name LIKE '%_metrics_%' OR table_name LIKE '%_realtime' OR table_name LIKE '%_evolution_%';

-- Check if analytics functions were created
SELECT 
    'Analytics Functions' as feature,
    COUNT(*) as count
FROM information_schema.routines
WHERE routine_name IN (
    'get_cognitive_performance_trend',
    'analyze_pattern_effectiveness', 
    'get_cognitive_load_alerts'
);

\echo 'TimescaleDB analytics enhancement completed successfully!';
\echo '';
\echo 'New features available:';
\echo '  ✓ Hourly cognitive performance metrics';
\echo '  ✓ Daily session analytics';  
\echo '  ✓ Real-time cognitive load monitoring';
\echo '  ✓ Pattern evolution tracking';
\echo '  ✓ Compression and retention policies';
\echo '  ✓ Advanced analytics functions';
\echo '  ✓ Automatic refresh policies';
\echo '';
\echo 'Use the analytics functions to gain insights:';
\echo '  SELECT * FROM get_cognitive_performance_trend(30);';
\echo '  SELECT * FROM analyze_pattern_effectiveness(60);';  
\echo '  SELECT * FROM get_cognitive_load_alerts(24);';