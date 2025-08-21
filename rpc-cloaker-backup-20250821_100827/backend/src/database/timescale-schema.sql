-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Real-time metrics table
CREATE TABLE IF NOT EXISTS metrics (
    time TIMESTAMPTZ NOT NULL,
    campaign_id UUID NOT NULL,
    stream_id UUID,
    metric_type VARCHAR(50) NOT NULL,
    value FLOAT NOT NULL,
    tags JSONB DEFAULT '{}'::jsonb
);

-- Convert to hypertable
SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX idx_metrics_campaign_time ON metrics(campaign_id, time DESC);
CREATE INDEX idx_metrics_type_time ON metrics(metric_type, time DESC);

-- Aggregated stats (1 minute intervals)
CREATE TABLE IF NOT EXISTS stats_1m (
    time TIMESTAMPTZ NOT NULL,
    campaign_id UUID NOT NULL,
    stream_id UUID,
    total_requests INTEGER DEFAULT 0,
    bot_requests INTEGER DEFAULT 0,
    human_requests INTEGER DEFAULT 0,
    money_page_shown INTEGER DEFAULT 0,
    safe_page_shown INTEGER DEFAULT 0,
    avg_response_time_ms FLOAT,
    unique_visitors INTEGER DEFAULT 0,
    countries JSONB DEFAULT '{}'::jsonb,
    devices JSONB DEFAULT '{}'::jsonb,
    browsers JSONB DEFAULT '{}'::jsonb
);

SELECT create_hypertable('stats_1m', 'time', if_not_exists => TRUE);

-- Aggregated stats (1 hour intervals)
CREATE TABLE IF NOT EXISTS stats_1h (
    time TIMESTAMPTZ NOT NULL,
    campaign_id UUID NOT NULL,
    stream_id UUID,
    total_requests INTEGER DEFAULT 0,
    bot_requests INTEGER DEFAULT 0,
    human_requests INTEGER DEFAULT 0,
    money_page_shown INTEGER DEFAULT 0,
    safe_page_shown INTEGER DEFAULT 0,
    avg_response_time_ms FLOAT,
    unique_visitors INTEGER DEFAULT 0,
    countries JSONB DEFAULT '{}'::jsonb,
    devices JSONB DEFAULT '{}'::jsonb,
    browsers JSONB DEFAULT '{}'::jsonb
);

SELECT create_hypertable('stats_1h', 'time', if_not_exists => TRUE);

-- Aggregated stats (1 day intervals)
CREATE TABLE IF NOT EXISTS stats_1d (
    time TIMESTAMPTZ NOT NULL,
    campaign_id UUID NOT NULL,
    stream_id UUID,
    total_requests INTEGER DEFAULT 0,
    bot_requests INTEGER DEFAULT 0,
    human_requests INTEGER DEFAULT 0,
    money_page_shown INTEGER DEFAULT 0,
    safe_page_shown INTEGER DEFAULT 0,
    avg_response_time_ms FLOAT,
    unique_visitors INTEGER DEFAULT 0,
    countries JSONB DEFAULT '{}'::jsonb,
    devices JSONB DEFAULT '{}'::jsonb,
    browsers JSONB DEFAULT '{}'::jsonb
);

SELECT create_hypertable('stats_1d', 'time', if_not_exists => TRUE);

-- Continuous aggregates for automatic rollups
CREATE MATERIALIZED VIEW stats_1m_view
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS time,
    campaign_id,
    stream_id,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE tags->>'is_bot' = 'true') as bot_requests,
    COUNT(*) FILTER (WHERE tags->>'is_bot' = 'false') as human_requests,
    COUNT(*) FILTER (WHERE tags->>'page_shown' = 'money') as money_page_shown,
    COUNT(*) FILTER (WHERE tags->>'page_shown' = 'safe') as safe_page_shown,
    AVG((tags->>'response_time_ms')::float) as avg_response_time_ms
FROM metrics
WHERE metric_type = 'page_view'
GROUP BY time_bucket('1 minute', time), campaign_id, stream_id
WITH NO DATA;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('stats_1m_view',
    start_offset => INTERVAL '5 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- Retention policies
SELECT add_retention_policy('metrics', INTERVAL '7 days');
SELECT add_retention_policy('stats_1m', INTERVAL '30 days');
SELECT add_retention_policy('stats_1h', INTERVAL '90 days');
SELECT add_retention_policy('stats_1d', INTERVAL '365 days');

-- Compression policies
SELECT add_compression_policy('metrics', INTERVAL '1 day');
SELECT add_compression_policy('stats_1m', INTERVAL '7 days');
SELECT add_compression_policy('stats_1h', INTERVAL '30 days');
SELECT add_compression_policy('stats_1d', INTERVAL '90 days');