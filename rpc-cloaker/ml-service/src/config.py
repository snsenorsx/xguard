from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Service
    service_name: str = "rpc-cloaker-ml"
    service_port: int = 5000
    service_host: str = "0.0.0.0"
    debug: bool = False
    
    # API Security
    api_key: str
    
    # Database
    database_url: str
    redis_url: str = "redis://localhost:6379/1"
    
    # Model Configuration
    model_path: str = "/app/models"
    model_version: str = "latest"
    training_batch_size: int = 1000
    training_interval_hours: int = 6
    
    # Feature Engineering
    feature_window_hours: int = 24
    min_samples_for_training: int = 10000
    
    # MLflow
    mlflow_tracking_uri: str = "file:///app/mlruns"
    mlflow_experiment_name: str = "bot_detection"
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"
    
    # Performance
    max_workers: int = 4
    request_timeout: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()