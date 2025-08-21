import os
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any

import structlog
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime

from src.config import settings
from src.database import init_db, close_db
from src.ml.model_manager import ModelManager
from src.ml.feature_extractor import FeatureExtractor
from src.ml.trainer import ModelTrainer
from src.services.prediction_service import PredictionService
from src.services.training_service import TrainingService

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer() if settings.log_format == "json" else structlog.dev.ConsoleRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global instances
model_manager: Optional[ModelManager] = None
prediction_service: Optional[PredictionService] = None
training_service: Optional[TrainingService] = None
scheduler: Optional[AsyncIOScheduler] = None


class VisitorData(BaseModel):
    ip: str
    userAgent: str
    referer: Optional[str] = None
    headers: Dict[str, str]
    fingerprintHash: str
    geo: Optional[Dict] = None
    device: Optional[Dict] = None
    browser: Optional[Dict] = None
    os: Optional[Dict] = None


class DetectionResult(BaseModel):
    isBot: bool
    score: float = Field(ge=0, le=1)
    reason: str
    details: Dict[str, float]


class AnalyzeRequest(BaseModel):
    visitor: VisitorData
    detection: DetectionResult
    targeting: Optional[Dict[str, Any]] = None


class TrainRequest(BaseModel):
    visitor: VisitorData
    decision: Dict
    timestamp: datetime


class PredictionResponse(BaseModel):
    isBot: bool
    confidence: float = Field(ge=0, le=1)
    features: Dict[str, float]
    modelVersion: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global model_manager, prediction_service, training_service, scheduler
    
    logger.info("Starting ML service", port=settings.service_port)
    
    # Initialize database
    await init_db()
    
    # Initialize services
    model_manager = ModelManager(settings.model_path)
    await model_manager.initialize()
    
    feature_extractor = FeatureExtractor()
    prediction_service = PredictionService(model_manager, feature_extractor)
    training_service = TrainingService(model_manager, feature_extractor)
    
    # Initialize scheduler for periodic training
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        training_service.run_training,
        'interval',
        hours=settings.training_interval_hours,
        id='model_training',
        name='Periodic Model Training'
    )
    scheduler.start()
    
    logger.info("ML service initialized successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down ML service")
    scheduler.shutdown()
    await close_db()


# Create FastAPI app
app = FastAPI(
    title="RPC Cloaker ML Service",
    description="Machine Learning service for bot detection",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency for API key validation
async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.service_name,
        "timestamp": datetime.utcnow().isoformat(),
        "model_loaded": model_manager.is_model_loaded() if model_manager else False
    }


@app.post("/analyze", response_model=PredictionResponse)
async def analyze_visitor(
    request: AnalyzeRequest,
    api_key: str = Depends(verify_api_key)
):
    """Analyze visitor data and return bot prediction."""
    if not prediction_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        targeting = request.targeting
        result = await prediction_service.predict(request.visitor.dict(), targeting)
        return result
    except Exception as e:
        logger.error("Prediction error", error=str(e), visitor_id=request.visitor.fingerprintHash)
        raise HTTPException(status_code=500, detail="Prediction failed")


@app.post("/train")
async def submit_training_data(
    request: TrainRequest,
    api_key: str = Depends(verify_api_key)
):
    """Submit visitor data for model training."""
    if not training_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        await training_service.add_training_sample(
            visitor_data=request.visitor.dict(),
            decision=request.decision,
            timestamp=request.timestamp
        )
        return {"status": "accepted", "message": "Training data queued"}
    except Exception as e:
        logger.error("Training data submission error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to submit training data")


@app.post("/train/trigger")
async def trigger_training(api_key: str = Depends(verify_api_key)):
    """Manually trigger model training."""
    if not training_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Run training in background
        asyncio.create_task(training_service.run_training())
        return {"status": "triggered", "message": "Training job started"}
    except Exception as e:
        logger.error("Training trigger error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to trigger training")


@app.get("/model/info")
async def get_model_info(api_key: str = Depends(verify_api_key)):
    """Get current model information."""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return {
        "current_version": model_manager.current_version,
        "loaded_at": model_manager.loaded_at.isoformat() if model_manager.loaded_at else None,
        "model_type": model_manager.model_type,
        "feature_count": len(model_manager.feature_names) if model_manager.feature_names else 0,
        "performance_metrics": model_manager.get_metrics()
    }


@app.get("/model/versions")
async def list_model_versions(api_key: str = Depends(verify_api_key)):
    """List available model versions."""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    versions = await model_manager.list_versions()
    return {"versions": versions}


@app.post("/model/rollback/{version}")
async def rollback_model(version: str, api_key: str = Depends(verify_api_key)):
    """Rollback to a specific model version."""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        await model_manager.load_model(version)
        return {
            "status": "success",
            "message": f"Rolled back to model version {version}",
            "current_version": model_manager.current_version
        }
    except Exception as e:
        logger.error("Model rollback error", error=str(e), version=version)
        raise HTTPException(status_code=500, detail=f"Failed to rollback to version {version}")


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )