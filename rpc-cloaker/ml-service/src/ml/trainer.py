import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import optuna
from typing import Dict, Tuple, List, Any
import structlog

logger = structlog.get_logger()


class ModelTrainer:
    """Train and optimize bot detection models."""
    
    def __init__(self):
        self.best_params: Optional[Dict[str, Any]] = None
        self.scaler = StandardScaler()
    
    def train(
        self, 
        X: np.ndarray, 
        y: np.ndarray,
        feature_names: List[str],
        optimize_hyperparams: bool = True
    ) -> Tuple[Any, Dict[str, float]]:
        """Train a bot detection model."""
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        logger.info("Training data prepared", 
                   train_samples=len(X_train), 
                   test_samples=len(X_test),
                   bot_ratio=y_train.mean())
        
        # Optimize hyperparameters if requested
        if optimize_hyperparams and len(X_train) > 1000:
            self.best_params = self._optimize_hyperparameters(X_train, y_train)
        else:
            self.best_params = self._get_default_params()
        
        # Train final model
        model = xgb.XGBClassifier(**self.best_params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            early_stopping_rounds=50,
            verbose=False
        )
        
        # Evaluate model
        metrics = self._evaluate_model(model, X_test, y_test)
        metrics['training_samples'] = len(X_train)
        
        # Add feature importance
        feature_importance = model.feature_importances_
        top_features = sorted(
            zip(feature_names, feature_importance),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        logger.info("Model trained successfully", 
                   metrics=metrics,
                   top_features=top_features)
        
        return model, metrics
    
    def _optimize_hyperparameters(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        """Optimize model hyperparameters using Optuna."""
        
        def objective(trial):
            params = {
                'n_estimators': trial.suggest_int('n_estimators', 100, 500),
                'max_depth': trial.suggest_int('max_depth', 3, 10),
                'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
                'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
                'subsample': trial.suggest_float('subsample', 0.5, 1.0),
                'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
                'gamma': trial.suggest_float('gamma', 0, 5),
                'reg_alpha': trial.suggest_float('reg_alpha', 0, 2),
                'reg_lambda': trial.suggest_float('reg_lambda', 0, 2),
                'objective': 'binary:logistic',
                'use_label_encoder': False,
                'eval_metric': 'logloss',
                'random_state': 42
            }
            
            model = xgb.XGBClassifier(**params)
            
            # Use cross-validation
            scores = cross_val_score(
                model, X_train, y_train,
                cv=3, scoring='roc_auc',
                n_jobs=-1
            )
            
            return scores.mean()
        
        # Run optimization
        study = optuna.create_study(direction='maximize')
        study.optimize(objective, n_trials=50, n_jobs=1)
        
        best_params = study.best_params
        best_params.update({
            'objective': 'binary:logistic',
            'use_label_encoder': False,
            'eval_metric': 'logloss',
            'random_state': 42
        })
        
        logger.info("Hyperparameter optimization complete", 
                   best_score=study.best_value,
                   best_params=best_params)
        
        return best_params
    
    def _get_default_params(self) -> Dict[str, Any]:
        """Get default XGBoost parameters."""
        return {
            'n_estimators': 200,
            'max_depth': 6,
            'learning_rate': 0.1,
            'min_child_weight': 3,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'gamma': 0.1,
            'reg_alpha': 0.1,
            'reg_lambda': 1.0,
            'objective': 'binary:logistic',
            'use_label_encoder': False,
            'eval_metric': 'logloss',
            'random_state': 42
        }
    
    def _evaluate_model(self, model: Any, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, float]:
        """Evaluate model performance."""
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test)[:, 1]
        
        metrics = {
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred, zero_division=0),
            'recall': recall_score(y_test, y_pred, zero_division=0),
            'f1_score': f1_score(y_test, y_pred, zero_division=0),
            'roc_auc': roc_auc_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.5
        }
        
        # Round metrics
        metrics = {k: round(v, 4) for k, v in metrics.items()}
        
        return metrics
    
    def prepare_training_data(self, 
                            features_list: List[np.ndarray], 
                            labels_list: List[int]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare and balance training data."""
        
        # Combine all data
        X = np.vstack(features_list)
        y = np.array(labels_list)
        
        # Balance classes if needed
        unique, counts = np.unique(y, return_counts=True)
        if len(unique) == 2:
            bot_count = counts[1] if len(counts) > 1 else 0
            human_count = counts[0]
            
            if bot_count > 0 and human_count / bot_count > 3:
                # Downsample majority class
                human_indices = np.where(y == 0)[0]
                bot_indices = np.where(y == 1)[0]
                
                # Keep all bot samples and sample from human
                n_human_samples = min(len(human_indices), len(bot_indices) * 3)
                human_indices_sampled = np.random.choice(
                    human_indices, n_human_samples, replace=False
                )
                
                indices = np.concatenate([human_indices_sampled, bot_indices])
                X = X[indices]
                y = y[indices]
                
                logger.info("Data balanced", 
                          original_human=human_count,
                          original_bot=bot_count,
                          balanced_samples=len(y))
        
        return X, y