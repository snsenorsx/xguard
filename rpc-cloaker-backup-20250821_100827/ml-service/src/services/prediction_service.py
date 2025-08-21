from typing import Dict, Any, Optional
import json
import numpy as np
import structlog
from datetime import datetime

from src.ml.model_manager import ModelManager
from src.ml.feature_extractor import FeatureExtractor
from src.database import get_redis
from src.services.blacklist_service import get_blacklist_service

logger = structlog.get_logger()


class PredictionService:
    """Service for making bot predictions."""
    
    def __init__(self, model_manager: ModelManager, feature_extractor: FeatureExtractor):
        self.model_manager = model_manager
        self.feature_extractor = feature_extractor
    
    async def predict(self, visitor_data: Dict[str, Any], campaign_targeting: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make a bot prediction for visitor data."""
        
        try:
            ip_address = visitor_data.get('ip', '')
            
            # FIRST: Check if IP is already blacklisted
            blacklist_service = await get_blacklist_service()
            is_blacklisted = await blacklist_service.is_blacklisted(ip_address)
            
            if is_blacklisted:
                logger.info("IP found in blacklist, returning bot=True",
                           ip=ip_address,
                           fingerprint=visitor_data.get('fingerprintHash'))
                
                return {
                    'isBot': True,
                    'confidence': 1.0,
                    'features': {'blacklisted': 1.0},
                    'modelVersion': 'blacklist_v1',
                    'targetingAware': bool(campaign_targeting),
                    'blacklisted': True,
                    'reason': 'IP found in blacklist'
                }
            
            # Extract features with campaign targeting context
            features = self.feature_extractor.extract_features(visitor_data, campaign_targeting)
            
            # Get prediction from model
            is_bot, confidence = self.model_manager.predict(features)
            
            # Get feature importance for this prediction
            feature_values = dict(zip(
                self.feature_extractor.feature_names,
                features.tolist()
            ))
            
            # Cache prediction result
            await self._cache_prediction(
                visitor_data.get('fingerprintHash', ''),
                is_bot,
                confidence
            )
            
            # If bot detected with high confidence, add to blacklist
            if is_bot and confidence > 0.7:
                await self._add_to_blacklist_if_bot(ip_address, visitor_data, confidence, campaign_targeting)
            
            # Log prediction for monitoring
            logger.info("Prediction made",
                       fingerprint=visitor_data.get('fingerprintHash'),
                       is_bot=is_bot,
                       confidence=confidence,
                       targeting_context=bool(campaign_targeting))
            
            return {
                'isBot': bool(is_bot),
                'confidence': float(confidence),
                'features': feature_values,
                'modelVersion': self.model_manager.current_version or 'unknown',
                'targetingAware': bool(campaign_targeting),
                'blacklisted': False,
                'reason': self._get_detection_reason(feature_values, confidence)
            }
            
        except Exception as e:
            logger.error("Prediction error", error=str(e))
            # Return neutral prediction on error
            return {
                'isBot': False,
                'confidence': 0.5,
                'features': {},
                'modelVersion': 'error',
                'targetingAware': False
            }
    
    async def _cache_prediction(self, fingerprint: str, is_bot: bool, confidence: float):
        """Cache prediction result for quick lookup."""
        try:
            redis = await get_redis()
            key = f"ml:prediction:{fingerprint}"
            value = {
                'is_bot': is_bot,
                'confidence': confidence,
                'timestamp': datetime.utcnow().isoformat(),
                'model_version': self.model_manager.current_version
            }
            
            # Cache for 1 hour
            await redis.setex(key, 3600, json.dumps(value))
        except Exception as e:
            logger.error("Failed to cache prediction", error=str(e))
    
    async def get_cached_prediction(self, fingerprint: str) -> Optional[Dict[str, Any]]:
        """Get cached prediction if available."""
        try:
            redis = await get_redis()
            key = f"ml:prediction:{fingerprint}"
            
            value = await redis.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error("Failed to get cached prediction", error=str(e))
        
        return None
    
    async def _add_to_blacklist_if_bot(self, ip_address: str, visitor_data: Dict, confidence: float, campaign_targeting: Dict = None):
        """Add detected bot IP to blacklist automatically."""
        try:
            blacklist_service = await get_blacklist_service()
            
            # Determine detection reason based on features
            user_agent = visitor_data.get('userAgent', '').lower()
            reason = self._get_blacklist_reason(user_agent, visitor_data, confidence)
            
            # Determine expiration based on confidence
            expires_hours = self._get_blacklist_duration(confidence)
            
            # Add to blacklist
            success = await blacklist_service.add_to_blacklist(
                ip_address=ip_address,
                reason=reason,
                detection_type="bot",
                confidence_score=confidence,
                expires_hours=expires_hours,
                campaign_id=campaign_targeting.get('campaignId') if campaign_targeting else None
            )
            
            if success:
                logger.info("Bot IP added to blacklist",
                           ip=ip_address,
                           reason=reason,
                           confidence=confidence,
                           expires_hours=expires_hours)
            else:
                logger.warning("Failed to add bot IP to blacklist", ip=ip_address)
                
        except Exception as e:
            logger.error("Error adding bot to blacklist", ip=ip_address, error=str(e))
    
    def _get_blacklist_reason(self, user_agent: str, visitor_data: Dict, confidence: float) -> str:
        """Generate appropriate reason for blacklisting based on detection."""
        reasons = []
        
        if 'python' in user_agent or 'curl' in user_agent or 'wget' in user_agent:
            reasons.append("Automated tool detected")
        
        if 'headless' in user_agent or 'phantom' in user_agent:
            reasons.append("Headless browser detected")
        
        if 'selenium' in user_agent or 'webdriver' in user_agent:
            reasons.append("Web automation detected")
        
        if 'bot' in user_agent or 'crawler' in user_agent or 'spider' in user_agent:
            reasons.append("Bot/crawler detected")
        
        headers = visitor_data.get('headers', {})
        if len(headers) < 5:
            reasons.append("Suspicious header pattern")
        
        if not reasons:
            reasons.append(f"ML model detection (confidence: {confidence:.2f})")
        
        return " | ".join(reasons)
    
    def _get_blacklist_duration(self, confidence: float) -> int:
        """Determine blacklist duration based on confidence."""
        if confidence >= 0.95:
            return 72  # 3 days for very high confidence
        elif confidence >= 0.85:
            return 48  # 2 days for high confidence
        else:
            return 24  # 1 day for medium confidence
    
    def _get_detection_reason(self, features: Dict, confidence: float) -> str:
        """Generate human-readable detection reason."""
        if not features:
            return f"ML detection (confidence: {confidence:.2f})"
        
        reasons = []
        
        # Check key indicators
        if features.get('ua_bot_keyword', 0) > 0.5:
            reasons.append("Bot keywords in user agent")
        
        if features.get('ua_suspicious_pattern', 0) > 0.5:
            reasons.append("Suspicious user agent pattern")
        
        if features.get('is_datacenter_ip', 0) > 0.5:
            reasons.append("Datacenter IP address")
        
        if features.get('header_anomaly_score', 0) > 0.7:
            reasons.append("Abnormal HTTP headers")
        
        if features.get('country_risk_score', 0) > 0.6:
            reasons.append("High-risk country")
        
        if features.get('device_browser_mismatch', 0) > 0.5:
            reasons.append("Device/browser mismatch")
        
        if not reasons:
            reasons.append(f"ML pattern analysis (confidence: {confidence:.2f})")
        
        return " | ".join(reasons)