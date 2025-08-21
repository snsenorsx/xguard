-- Migration: Add separate redirect types for money page and safe page
-- This allows different redirect behaviors for bots vs non-bots

-- Add new columns for separate redirect types
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS money_page_redirect_type VARCHAR(50) NOT NULL DEFAULT '302',
ADD COLUMN IF NOT EXISTS safe_page_redirect_type VARCHAR(50) NOT NULL DEFAULT 'direct';

-- Update existing campaigns to use the current redirect_type for money page
UPDATE campaigns 
SET money_page_redirect_type = redirect_type
WHERE money_page_redirect_type = '302';

-- Add check constraints for valid redirect types
ALTER TABLE campaigns 
ADD CONSTRAINT check_money_page_redirect_type 
CHECK (money_page_redirect_type IN ('301', '302', 'js', 'meta', 'direct', 'no_action'));

ALTER TABLE campaigns 
ADD CONSTRAINT check_safe_page_redirect_type 
CHECK (safe_page_redirect_type IN ('301', '302', 'js', 'meta', 'direct', 'no_action'));

-- Add comments for clarity
COMMENT ON COLUMN campaigns.money_page_redirect_type IS 'Redirect type for bots (money page): 301, 302, js, meta, direct, no_action';
COMMENT ON COLUMN campaigns.safe_page_redirect_type IS 'Redirect type for non-bots (safe page): 301, 302, js, meta, direct, no_action';

-- Keep the old redirect_type column for now to maintain backward compatibility
-- It can be removed in a future migration after confirming everything works
COMMENT ON COLUMN campaigns.redirect_type IS 'Legacy redirect type - will be deprecated';