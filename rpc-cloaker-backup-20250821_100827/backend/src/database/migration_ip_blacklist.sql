-- Migration: IP Blacklist System
-- Merkezi IP karaliste sistemi için database şeması

CREATE TABLE IF NOT EXISTS ip_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    reason VARCHAR(255) NOT NULL,
    detection_type VARCHAR(100) NOT NULL, -- 'bot', 'suspicious', 'manual'
    confidence_score FLOAT DEFAULT 0.0,
    detection_count INTEGER DEFAULT 1,
    first_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_permanent BOOLEAN DEFAULT FALSE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint on IP address (one entry per IP)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_blacklist_ip ON ip_blacklist(ip_address);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_expires ON ip_blacklist(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_active ON ip_blacklist(ip_address, expires_at) WHERE is_permanent = TRUE OR expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_user ON ip_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_campaign ON ip_blacklist(campaign_id);

-- IP reputation scoring table
CREATE TABLE IF NOT EXISTS ip_reputation (
    ip_address INET PRIMARY KEY,
    reputation_score INTEGER DEFAULT 100, -- 0-100, lower is worse
    total_detections INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    risk_category VARCHAR(50) DEFAULT 'unknown', -- 'low', 'medium', 'high', 'critical'
    data_sources JSONB DEFAULT '[]', -- Sources that flagged this IP
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blacklist events log for analytics
CREATE TABLE IF NOT EXISTS blacklist_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'added', 'removed', 'expired', 'blocked'
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_blacklist_events_ip ON blacklist_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_blacklist_events_time ON blacklist_events(created_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_events_type ON blacklist_events(event_type);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_ip_blacklist_updated_at ON ip_blacklist;
CREATE TRIGGER update_ip_blacklist_updated_at 
    BEFORE UPDATE ON ip_blacklist 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ip_reputation_updated_at ON ip_reputation;
CREATE TRIGGER update_ip_reputation_updated_at 
    BEFORE UPDATE ON ip_reputation 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired blacklist entries
CREATE OR REPLACE FUNCTION clean_expired_blacklist()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired entries
    DELETE FROM ip_blacklist 
    WHERE is_permanent = FALSE 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup event
    INSERT INTO blacklist_events (ip_address, event_type, reason, metadata)
    SELECT '0.0.0.0'::INET, 'cleanup', 'Automatic cleanup of expired entries', 
           jsonb_build_object('deleted_count', deleted_count);
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing
INSERT INTO ip_blacklist (ip_address, reason, detection_type, confidence_score, expires_at) 
VALUES 
    ('192.168.1.100', 'Python bot detected', 'bot', 0.95, NOW() + INTERVAL '24 hours'),
    ('10.0.0.50', 'Suspicious header patterns', 'suspicious', 0.75, NOW() + INTERVAL '12 hours'),
    ('203.0.113.1', 'Manual ban - spam', 'manual', 1.0, NULL)
ON CONFLICT (ip_address) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE ip_blacklist IS 'Merkezi IP karaliste sistemi - tüm kullanıcılar arasında paylaşılan bot IP listesi';
COMMENT ON TABLE ip_reputation IS 'IP itibar puanlama sistemi - IP geçmişi ve risk değerlendirmesi';
COMMENT ON TABLE blacklist_events IS 'Karaliste olayları log tablosu - analitik ve denetim için';