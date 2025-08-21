import os
import pickle
import json
from datetime import datetime
from typing import Optional, Dict, List, Any
import numpy as np
import mlflow
import mlflow.sklearn
import xgboost as xgb
from pathlib import Path
import structlog
from .rule_based_model import RuleBasedBotDetector

logger = structlog.get_logger()


class ModelManager:
    """Manage ML model lifecycle including loading, saving, and versioning."""
    
    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model_path.mkdir(parents=True, exist_ok=True)
        
        self.current_model: Optional[Any] = None
        self.current_version: Optional[str] = None
        self.loaded_at: Optional[datetime] = None
        self.model_type: str = "xgboost"
        self.feature_names: Optional[List[str]] = None
        self.model_metadata: Dict[str, Any] = {}
        
        # MLflow setup
        mlflow.set_tracking_uri(f"file://{self.model_path}/mlruns")
        mlflow.set_experiment("bot_detection")
    
    async def initialize(self):
        """Initialize model manager and load latest model."""
        try:
            await self.load_latest_model()
        except Exception as e:
            logger.warning("Failed to load model, will use default", error=str(e))
            self._create_default_model()
    
    async def load_latest_model(self):
        """Load the latest model version."""
        model_files = list(self.model_path.glob("model_v*.pkl"))
        if not model_files:
            raise FileNotFoundError("No model files found")
        
        # Sort by version number
        model_files.sort(key=lambda x: int(x.stem.split('_v')[1]))
        latest_model = model_files[-1]
        
        await self.load_model(latest_model.stem.split('_v')[1])
    
    async def load_model(self, version: str):
        """Load a specific model version."""
        model_file = self.model_path / f"model_v{version}.pkl"
        metadata_file = self.model_path / f"metadata_v{version}.json"
        
        if not model_file.exists():
            raise FileNotFoundError(f"Model version {version} not found")
        
        # Load model
        with open(model_file, 'rb') as f:
            model_data = pickle.load(f)
        
        self.current_model = model_data['model']
        self.feature_names = model_data.get('feature_names', [])
        self.current_version = version
        self.loaded_at = datetime.utcnow()
        
        # Load metadata if exists
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                self.model_metadata = json.load(f)
        
        logger.info("Model loaded", version=version, features=len(self.feature_names))
    
    def save_model(self, model: Any, feature_names: List[str], metrics: Dict[str, float]) -> str:
        """Save a new model version."""
        # Generate new version number
        existing_versions = [
            int(f.stem.split('_v')[1]) 
            for f in self.model_path.glob("model_v*.pkl")
        ]
        new_version = str(max(existing_versions, default=0) + 1)
        
        # Save model
        model_file = self.model_path / f"model_v{new_version}.pkl"
        model_data = {
            'model': model,
            'feature_names': feature_names,
            'created_at': datetime.utcnow().isoformat(),
            'model_type': self.model_type
        }
        
        with open(model_file, 'wb') as f:
            pickle.dump(model_data, f)
        
        # Save metadata
        metadata = {
            'version': new_version,
            'created_at': datetime.utcnow().isoformat(),
            'metrics': metrics,
            'feature_count': len(feature_names),
            'model_type': self.model_type,
            'training_samples': metrics.get('training_samples', 0)
        }
        
        metadata_file = self.model_path / f"metadata_v{new_version}.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Log to MLflow
        with mlflow.start_run():
            mlflow.log_params({
                'model_type': self.model_type,
                'n_features': len(feature_names),
                'version': new_version
            })
            mlflow.log_metrics(metrics)
            mlflow.sklearn.log_model(model, "model")
        
        logger.info("Model saved", version=new_version, metrics=metrics)
        return new_version
    
    def predict(self, features: np.ndarray) -> tuple[float, float]:
        """Make prediction with current model."""
        if self.current_model is None:
            raise RuntimeError("No model loaded")
        
        # Ensure features is 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Get prediction probability
        try:
            probabilities = self.current_model.predict_proba(features)[0]
            bot_probability = probabilities[1]  # Assuming class 1 is bot
            
            # Binary prediction
            is_bot = bot_probability > 0.5
            
            return float(is_bot), float(bot_probability)
        except Exception as e:
            logger.error("Prediction error", error=str(e))
            # Fallback to simple prediction
            prediction = self.current_model.predict(features)[0]
            return float(prediction), 0.5
    
    def _create_default_model(self):
        """Create a default rule-based model for initial deployment."""
        # Use rule-based model as fallback
        self.current_model = RuleBasedBotDetector()
        
        self.current_version = "rule_based_v1"
        self.loaded_at = datetime.utcnow()
        self.feature_names = self.current_model.feature_names
        
        logger.info("Default rule-based model created")
    
    def is_model_loaded(self) -> bool:
        """Check if a model is currently loaded."""
        return self.current_model is not None
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current model metrics."""
        return self.model_metadata.get('metrics', {})
    
    async def list_versions(self) -> List[Dict[str, Any]]:
        """List all available model versions."""
        versions = []
        
        for metadata_file in self.model_path.glob("metadata_v*.json"):
            try:
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                versions.append(metadata)
            except Exception as e:
                logger.error("Failed to read metadata", file=str(metadata_file), error=str(e))
        
        # Sort by version number descending
        versions.sort(key=lambda x: int(x['version']), reverse=True)
        
        return versions
    
    def cleanup_old_versions(self, keep_versions: int = 5):
        """Remove old model versions, keeping the most recent ones."""
        model_files = list(self.model_path.glob("model_v*.pkl"))
        model_files.sort(key=lambda x: int(x.stem.split('_v')[1]), reverse=True)
        
        # Keep the most recent versions
        for model_file in model_files[keep_versions:]:
            version = model_file.stem.split('_v')[1]
            
            # Don't delete current version
            if version == self.current_version:
                continue
            
            # Delete model and metadata files
            model_file.unlink()
            metadata_file = self.model_path / f"metadata_v{version}.json"
            if metadata_file.exists():
                metadata_file.unlink()
            
            logger.info("Deleted old model version", version=version)