"""
ML Service configuration
Traceability: Section 8 (ML Model Specifications), SRS §9.3
"""
import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Service
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Model
    # Section 8.2: 200+ features, 6 output conditions
    feature_dim: int = 200
    num_conditions: int = 6
    # Section 8.2: LSTM encoder
    lstm_hidden_size: int = 128
    lstm_num_layers: int = 2
    # Section 8.2: Transformer encoder
    transformer_d_model: int = 128
    transformer_nhead: int = 8
    transformer_num_layers: int = 2
    # Section 8.2: Monte Carlo dropout uncertainty quantification
    dropout_rate: float = 0.3
    mc_dropout_samples: int = 20  # passes for uncertainty estimation

    # Inference (PERF-NFR-003: <5s)
    inference_timeout_s: int = 5

    # AWS / Model storage (Section 8.3: versioned in S3)
    s3_bucket_models: str = Field(default="earlymind-models", env="S3_BUCKET_MODELS")
    aws_region: str = Field(default="us-east-1", env="AWS_REGION")
    model_version: str = Field(default="v0.1.0", env="MODEL_VERSION")
    model_s3_key_prefix: str = "models"

    # Local model cache
    model_cache_dir: str = "/tmp/earlymind_models"

    class Config:
        env_file = ".env"


settings = Settings()

# Section 8.2: The 6 LD conditions — order matters (sigmoid output indices)
CONDITIONS = [
    "dyslexia",
    "dyscalculia",
    "adhd_inattentive",
    "adhd_hyperactive_impulsive",
    "working_memory_deficit",
    "processing_speed_deficit",
]
