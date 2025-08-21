import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
import numpy as np
import asyncpg
import structlog

from src.ml.model_manager import ModelManager
from src.ml.feature_extractor import FeatureExtractor
from src.ml.trainer import ModelTrainer
from src.database import get_pg_connection, get_redis
from src.config import settings

logger = structlog.get_logger()


class TrainingService:
    """Service for managing model training."""
    
    def __init__(self, model_manager: ModelManager, feature_extractor: FeatureExtractor):
        self.model_manager = model_manager
        self.feature_extractor = feature_extractor
        self.trainer = ModelTrainer()
        self.is_training = False
    
    async def add_training_sample(self, visitor_data: Dict[str, Any], decision: Dict, timestamp: datetime):
        """Add a new training sample to the queue."""
        try:
            # Extract features
            features = self.feature_extractor.extract_features(visitor_data)
            
            # Determine label (1 for bot, 0 for human)
            label = 1 if decision.get('decision') == 'safe' else 0
            
            # Store in database
            conn = await get_pg_connection()
            try:
                await conn.execute(
                    """INSERT INTO ml_training_data 
                       (visitor_fingerprint, features, label, confidence, created_at)
                       VALUES ($1, $2, $3, $4, $5)""",
                    visitor_data.get('fingerprintHash', ''),
                    json.dumps({
                        'features': features.tolist(),
                        'visitor_data': visitor_data
                    }),
                    'bot' if label == 1 else 'human',
                    decision.get('botScore', 0.5),
                    timestamp
                )
            finally:
                await conn.close()
            
            # Update training queue size in Redis
            redis = await get_redis()
            await redis.incr('ml:training_queue_size')
            
        except Exception as e:
            logger.error("Failed to add training sample", error=str(e))
    
    async def run_training(self):
        """Run model training process."""
        if self.is_training:
            logger.warning("Training already in progress, skipping")
            return
        
        self.is_training = True
        
        try:
            logger.info("Starting model training")
            
            # Check if we have enough samples
            sample_count = await self._get_training_sample_count()
            if sample_count < settings.min_samples_for_training:
                logger.info("Not enough samples for training", 
                           current=sample_count, 
                           required=settings.min_samples_for_training)
                return
            
            # Load training data
            X, y, sample_ids = await self._load_training_data()
            
            if len(X) == 0:
                logger.warning("No valid training data found")
                return
            
            logger.info("Training data loaded", samples=len(X), bot_ratio=y.mean())
            
            # Train model
            model, metrics = self.trainer.train(
                X, y,
                self.feature_extractor.feature_names,
                optimize_hyperparams=True
            )
            
            # Save new model
            version = self.model_manager.save_model(
                model,
                self.feature_extractor.feature_names,
                metrics
            )
            
            # Evaluate if new model is better
            if await self._should_deploy_model(metrics):
                # Deploy new model
                await self.model_manager.load_model(version)
                logger.info("New model deployed", version=version, metrics=metrics)
                
                # Clean up old models
                self.model_manager.cleanup_old_versions(keep_versions=5)
            else:
                logger.info("New model not deployed (performance not improved)", 
                           version=version, metrics=metrics)
            
            # Mark samples as used
            await self._mark_samples_as_used(sample_ids)
            
            # Update Redis metrics
            await self._update_training_metrics(metrics)
            
        except Exception as e:
            logger.error("Training failed", error=str(e))
        finally:
            self.is_training = False
    
    async def _get_training_sample_count(self) -> int:
        """Get count of available training samples."""
        conn = await get_pg_connection()
        try:
            result = await conn.fetchval(
                """SELECT COUNT(*) FROM ml_training_data 
                   WHERE created_at > NOW() - INTERVAL '%s hours'""",
                settings.feature_window_hours
            )
            return result or 0
        finally:
            await conn.close()
    
    async def _load_training_data(self) -> tuple[np.ndarray, np.ndarray, List[str]]:
        """Load training data from database."""
        conn = await get_pg_connection()
        try:
            # Get recent training samples
            rows = await conn.fetch(
                """SELECT id, features, label 
                   FROM ml_training_data 
                   WHERE created_at > NOW() - INTERVAL '%s hours'
                   ORDER BY created_at DESC
                   LIMIT %s""",
                settings.feature_window_hours,
                settings.training_batch_size * 10  # Get more for balancing
            )
            
            if not rows:
                return np.array([]), np.array([]), []
            
            # Extract features and labels
            features_list = []
            labels_list = []
            sample_ids = []
            
            for row in rows:
                try:
                    feature_data = json.loads(row['features'])
                    features = np.array(feature_data['features'])
                    
                    features_list.append(features)
                    labels_list.append(1 if row['label'] == 'bot' else 0)
                    sample_ids.append(row['id'])
                except Exception as e:
                    logger.error("Failed to parse training sample", 
                               sample_id=row['id'], error=str(e))
            
            if not features_list:
                return np.array([]), np.array([]), []
            
            # Prepare balanced training data
            X, y = self.trainer.prepare_training_data(features_list, labels_list)
            
            return X, y, sample_ids
            
        finally:
            await conn.close()
    
    async def _should_deploy_model(self, new_metrics: Dict[str, float]) -> bool:
        """Determine if new model should be deployed."""
        current_metrics = self.model_manager.get_metrics()
        
        if not current_metrics:
            return True  # No current model, deploy new one
        
        # Compare key metrics
        key_metrics = ['f1_score', 'roc_auc']
        
        for metric in key_metrics:
            current_value = current_metrics.get(metric, 0)
            new_value = new_metrics.get(metric, 0)
            
            # Require at least 2% improvement
            if new_value > current_value * 1.02:
                return True
        
        return False
    
    async def _mark_samples_as_used(self, sample_ids: List[str]):
        """Mark training samples as used."""
        # In a production system, you might want to track which samples
        # were used for which model version
        pass
    
    async def _update_training_metrics(self, metrics: Dict[str, float]):
        """Update training metrics in Redis for monitoring."""
        try:
            redis = await get_redis()
            key = "ml:latest_training_metrics"
            
            value = {
                'metrics': metrics,
                'timestamp': datetime.utcnow().isoformat(),
                'model_version': self.model_manager.current_version
            }
            
            await redis.set(key, json.dumps(value))
            
            # Reset training queue size
            await redis.set('ml:training_queue_size', 0)
            
        except Exception as e:
            logger.error("Failed to update training metrics", error=str(e))