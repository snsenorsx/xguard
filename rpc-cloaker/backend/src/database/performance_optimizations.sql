-- Database Performance Optimizations for RPC Cloaker
-- High-performance indexes, queries, and database tuning for massive scale

-- =====================================================
-- ADVANCED INDEXING STRATEGY
-- =====================================================

-- Composite indexes for hot query paths
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traffic_logs_campaign_decision_time 
ON traffic_logs(campaign_id, decision, created_at DESC) 
WHERE created_at > CURRENT_DATE - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traffic_logs_ip_bot_time 
ON traffic_logs(ip_address, is_bot, created_at DESC) 
WHERE created_at > CURRENT_DATE - INTERVAL '24 hours';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traffic_logs_fingerprint_time 
ON traffic_logs(visitor_id, created_at DESC) 
WHERE created_at > CURRENT_DATE - INTERVAL '1 hour';

-- Partial indexes for active campaigns only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_active_user 
ON campaigns(user_id, created_at DESC) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_active_campaign 
ON streams(campaign_id, weight DESC) 
WHERE is_active = true;

-- GIN indexes for JSONB bot detection details
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_detection_details_gin 
ON bot_detection_results USING GIN(details);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_training_features_gin 
ON ml_training_data USING GIN(features);

-- Targeting rules optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_targeting_rules_stream_type 
ON targeting_rules(stream_id, rule_type, is_include);

-- Hash index for exact lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_token_hash 
ON user_sessions USING HASH(token_hash);

-- =====================================================
-- PARTITIONING ENHANCEMENTS  
-- =====================================================

-- Create function to auto-create future partitions
CREATE OR REPLACE FUNCTION create_traffic_log_partitions()
RETURNS void AS $$
DECLARE
    start_date date := CURRENT_DATE;
    end_date date := CURRENT_DATE + INTERVAL '60 days';
    partition_date date;
    partition_name text;
BEGIN
    partition_date := start_date;
    
    WHILE partition_date < end_date LOOP
        partition_name := 'traffic_logs_' || to_char(partition_date, 'YYYY_MM_DD');
        
        -- Check if partition already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class 
            WHERE relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF traffic_logs
                FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                partition_date,
                partition_date + INTERVAL '1 day'
            );
            
            -- Add indexes to new partition
            EXECUTE format(
                'CREATE INDEX %I ON %I(campaign_id, created_at DESC)',
                partition_name || '_campaign_time',
                partition_name
            );
            
            EXECUTE format(
                'CREATE INDEX %I ON %I(ip_address, is_bot)',
                partition_name || '_ip_bot',
                partition_name
            );
            
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
        
        partition_date := partition_date + INTERVAL '1 day';
    END LOOP;
END $$;

-- Schedule partition creation (would be run by cron)
-- SELECT create_traffic_log_partitions();

-- Drop old partitions function
CREATE OR REPLACE FUNCTION drop_old_traffic_partitions(retention_days integer DEFAULT 30)
RETURNS void AS $$
DECLARE
    cutoff_date date := CURRENT_DATE - retention_days;
    partition_name text;
    partition_record record;
BEGIN
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'traffic_logs_%'
        AND tablename != 'traffic_logs'
    LOOP
        -- Extract date from partition name
        partition_name := partition_record.tablename;
        
        IF substring(partition_name from '(\d{4}_\d{2}_\d{2})$') IS NOT NULL THEN
            DECLARE
                partition_date date;
            BEGIN
                partition_date := to_date(
                    substring(partition_name from '(\d{4}_\d{2}_\d{2})$'), 
                    'YYYY_MM_DD'
                );
                
                IF partition_date < cutoff_date THEN
                    EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
                    RAISE NOTICE 'Dropped old partition: %', partition_name;
                END IF;
            EXCEPTION 
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not parse date from partition: %', partition_name;
            END;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- =====================================================

-- Real-time campaign performance view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_campaign_performance AS
SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c.user_id,
    COUNT(tl.id) as total_requests,
    COUNT(CASE WHEN tl.decision = 'money' THEN 1 END) as money_page_views,
    COUNT(CASE WHEN tl.decision = 'safe' THEN 1 END) as safe_page_views,
    COUNT(CASE WHEN tl.is_bot = true THEN 1 END) as bot_requests,
    COUNT(DISTINCT tl.ip_address) as unique_ips,
    COUNT(DISTINCT tl.visitor_id) as unique_visitors,
    AVG(tl.response_time_ms) as avg_response_time,
    COUNT(CASE WHEN tl.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as requests_24h,
    COUNT(CASE WHEN tl.created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as requests_1h,
    MAX(tl.created_at) as last_activity
FROM campaigns c
LEFT JOIN traffic_logs tl ON c.id = tl.campaign_id 
    AND tl.created_at > NOW() - INTERVAL '7 days'
WHERE c.status = 'active'
GROUP BY c.id, c.name, c.user_id;

CREATE UNIQUE INDEX idx_mv_campaign_performance_campaign_id 
ON mv_campaign_performance(campaign_id);

-- Bot detection analytics view  
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_bot_analytics AS
SELECT 
    DATE_TRUNC('hour', tl.created_at) as hour_bucket,
    tl.campaign_id,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN tl.is_bot = true THEN 1 END) as bot_requests,
    AVG(tl.bot_score) as avg_bot_score,
    COUNT(DISTINCT CASE WHEN tl.is_bot = true THEN tl.ip_address END) as unique_bot_ips,
    COUNT(DISTINCT tl.country_code) as unique_countries,
    array_agg(DISTINCT tl.device_type) as device_types,
    COUNT(CASE WHEN bdr.detection_method = 'headless' THEN 1 END) as headless_detections,
    COUNT(CASE WHEN bdr.detection_method = 'fingerprint' THEN 1 END) as fingerprint_detections
FROM traffic_logs tl
LEFT JOIN bot_detection_results bdr ON tl.id = bdr.traffic_log_id
WHERE tl.created_at > NOW() - INTERVAL '48 hours'
GROUP BY DATE_TRUNC('hour', tl.created_at), tl.campaign_id;

CREATE INDEX idx_mv_bot_analytics_hour_campaign 
ON mv_bot_analytics(hour_bucket DESC, campaign_id);

-- IP reputation view for blacklist performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ip_reputation AS
SELECT 
    ip_address,
    COUNT(*) as request_count,
    COUNT(CASE WHEN is_bot = true THEN 1 END) as bot_count,
    AVG(bot_score) as avg_bot_score,
    COUNT(DISTINCT campaign_id) as campaigns_targeted,
    array_agg(DISTINCT country_code) as countries,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen,
    CASE 
        WHEN COUNT(CASE WHEN is_bot = true THEN 1 END)::float / COUNT(*) > 0.8 THEN 'high_risk'
        WHEN COUNT(CASE WHEN is_bot = true THEN 1 END)::float / COUNT(*) > 0.5 THEN 'medium_risk'
        ELSE 'low_risk'
    END as risk_level
FROM traffic_logs 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY ip_address
HAVING COUNT(*) >= 3;

CREATE UNIQUE INDEX idx_mv_ip_reputation_ip ON mv_ip_reputation(ip_address);
CREATE INDEX idx_mv_ip_reputation_risk ON mv_ip_reputation(risk_level, bot_count DESC);

-- =====================================================
-- PERFORMANCE TUNING FUNCTIONS
-- =====================================================

-- Analyze query performance
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(
    query text,
    calls bigint,
    total_time double precision,
    avg_time double precision,
    rows_per_call double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        regexp_replace(pgs.query, '\s+', ' ', 'g') as query,
        pgs.calls,
        pgs.total_exec_time,
        pgs.mean_exec_time,
        pgs.rows / NULLIF(pgs.calls, 0) as rows_per_call
    FROM pg_stat_statements pgs
    WHERE pgs.query ILIKE '%traffic_logs%' 
       OR pgs.query ILIKE '%campaigns%'
       OR pgs.query ILIKE '%bot_detection%'
    ORDER BY pgs.total_exec_time DESC
    LIMIT 20;
END $$;

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bot_analytics;  
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ip_reputation;
    
    RAISE NOTICE 'Analytics views refreshed at %', NOW();
END $$;

-- Database maintenance function
CREATE OR REPLACE FUNCTION maintain_database()
RETURNS void AS $$
BEGIN
    -- Update table statistics
    ANALYZE traffic_logs;
    ANALYZE bot_detection_results;
    ANALYZE campaigns;
    ANALYZE streams;
    
    -- Refresh analytics
    PERFORM refresh_analytics_views();
    
    -- Create future partitions
    PERFORM create_traffic_log_partitions();
    
    -- Clean old data if needed
    -- PERFORM drop_old_traffic_partitions(30);
    
    RAISE NOTICE 'Database maintenance completed at %', NOW();
END $$;

-- =====================================================
-- MONITORING AND ALERTING
-- =====================================================

-- Performance monitoring view
CREATE OR REPLACE VIEW v_performance_metrics AS
SELECT 
    'database_size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    NOW() as measured_at
UNION ALL
SELECT 
    'traffic_logs_count' as metric,
    COUNT(*)::text as value,
    NOW() as measured_at
FROM traffic_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'active_connections' as metric,
    COUNT(*)::text as value,
    NOW() as measured_at
FROM pg_stat_activity 
WHERE state = 'active'
UNION ALL  
SELECT 
    'cache_hit_ratio' as metric,
    ROUND(
        (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) * 100)::numeric, 
        2
    )::text || '%' as value,
    NOW() as measured_at
FROM pg_statio_user_tables;

-- Index usage monitoring
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- =====================================================
-- OPTIMIZED QUERIES FOR COMMON OPERATIONS
-- =====================================================

-- Fast campaign lookup with caching hint
CREATE OR REPLACE FUNCTION get_active_campaign(campaign_slug text)
RETURNS TABLE(
    id uuid,
    name text,
    money_page_url text,
    safe_page_url text,
    redirect_type text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.money_page_url,
        c.safe_page_url,
        c.redirect_type
    FROM campaigns c
    WHERE c.name = campaign_slug 
      AND c.status = 'active'
    LIMIT 1;
END $$ LANGUAGE plpgsql;

-- Fast bot detection lookup
CREATE OR REPLACE FUNCTION check_ip_reputation(ip_addr inet)
RETURNS TABLE(
    is_suspicious boolean,
    risk_score numeric,
    last_bot_detection timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN mvir.risk_level IN ('high_risk', 'medium_risk') THEN true ELSE false END,
        (mvir.bot_count::numeric / NULLIF(mvir.request_count, 0)) * 100,
        mvir.last_seen
    FROM mv_ip_reputation mvir
    WHERE mvir.ip_address = ip_addr
    LIMIT 1;
END $$ LANGUAGE plpgsql;

-- =====================================================
-- POSTGRESQL CONFIGURATION RECOMMENDATIONS
-- =====================================================

-- These settings should be applied to postgresql.conf:
/*
# Memory settings (adjust based on available RAM)
shared_buffers = 2GB                    # 25% of RAM
effective_cache_size = 6GB              # 75% of RAM  
work_mem = 64MB                         # Per connection
maintenance_work_mem = 512MB

# Connection settings
max_connections = 200
max_prepared_transactions = 200

# Write-ahead logging
wal_level = replica
wal_buffers = 64MB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# Query planner
random_page_cost = 1.1                  # SSD optimized
effective_io_concurrency = 200          # SSD optimized

# Logging (for monitoring)
log_min_duration_statement = 1000       # Log slow queries
log_checkpoints = on
log_connections = on
log_disconnections = on

# Autovacuum tuning
autovacuum_max_workers = 4
autovacuum_naptime = 30s
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05
*/