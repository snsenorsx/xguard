from typing import Dict, Any
import numpy as np
import structlog
from datetime import datetime

from src.ml.model_manager import ModelManager
from src.ml.feature_extractor import FeatureExtractor
from src.database import get_redis

logger = structlog.get_logger()


class PredictionService:
    """Service for making bot predictions."""
    
    def __init__(self, model_manager: ModelManager, feature_extractor: FeatureExtractor):
        self.model_manager = model_manager
        self.feature_extractor = feature_extractor
    
    async def predict(self, visitor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Make a bot prediction for visitor data."""
        
        try:
            # Extract features
            features = self.feature_extractor.extract_features(visitor_data)
            
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
            
            # Log prediction for monitoring
            logger.info("Prediction made",
                       fingerprint=visitor_data.get('fingerprintHash'),
                       is_bot=is_bot,
                       confidence=confidence)
            
            return {
                'isBot': bool(is_bot),
                'confidence': float(confidence),
                'features': feature_values,
                'modelVersion': self.model_manager.current_version or 'unknown'
            }
            
        except Exception as e:
            logger.error("Prediction error", error=str(e))
            # Return neutral prediction on error
            return {
                'isBot': False,
                'confidence': 0.5,
                'features': {},
                'modelVersion': 'error'
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