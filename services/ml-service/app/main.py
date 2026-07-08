"""
ML Service — FastAPI application
Traceability: ML-API-001, SRS §9.3, PERF-NFR-003 (<5s inference)

"Not exposed publicly — accessible only from the backend within the VPC."
"""
import os
import logging
import numpy as np
import torch
import boto3
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .config import settings, CONDITIONS
from .models.architecture import create_model
from .api.predict import router as predict_router, set_model

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ── Model loading ─────────────────────────────────────────────────────────────

def load_model_from_s3() -> tuple:
    """
    Download model weights and medians from S3.
    Traceability: SRS §8.3 (versioned model in S3)
    Returns (model, medians) or (None, None) if unavailable.
    """
    try:
        os.makedirs(settings.model_cache_dir, exist_ok=True)
        s3 = boto3.client("s3", region_name=settings.aws_region)
        prefix = f"{settings.model_s3_key_prefix}/{settings.model_version}"

        weights_path = os.path.join(settings.model_cache_dir, "model.pt")
        medians_path = os.path.join(settings.model_cache_dir, "medians.npy")

        s3.download_file(settings.s3_bucket_models, f"{prefix}/model.pt", weights_path)
        s3.download_file(settings.s3_bucket_models, f"{prefix}/medians.npy", medians_path)

        model = create_model()
        model.load_state_dict(torch.load(weights_path, map_location="cpu"))
        model.train()  # Keep in train mode for MC dropout
        medians = np.load(medians_path)

        log.info(f"Model {settings.model_version} loaded from S3")
        return model, medians

    except Exception as e:
        log.warning(f"Could not load model from S3: {e}")
        return None, None


def load_model_local() -> tuple:
    """Load model from local cache (fallback or development)."""
    weights_path = os.path.join(settings.model_cache_dir, "model.pt")
    medians_path = os.path.join(settings.model_cache_dir, "medians.npy")

    if not os.path.exists(weights_path):
        log.warning("No local model found — using untrained model (for development only)")
        model = create_model()
        model.train()
        medians = np.zeros(settings.feature_dim, dtype=np.float32)
        return model, medians

    model = create_model()
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    model.train()
    medians = np.load(medians_path) if os.path.exists(medians_path) else np.zeros(settings.feature_dim)
    log.info("Model loaded from local cache")
    return model, medians


# ── FastAPI lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model on startup
    model, medians = load_model_from_s3()
    if model is None:
        model, medians = load_model_local()

    set_model(model, medians)
    log.info(f"ML service ready — model version: {settings.model_version}")

    yield

    log.info("ML service shutting down")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="EarlyMind ML Service",
    description="Internal ML inference service — not public (SRS §9.3)",
    version=settings.model_version,
    # VPC-internal: disable external docs in production
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(predict_router)


@app.get("/health")
async def health():
    """Health check (SRS §11.3 monitoring)."""
    return {
        "status": "ok",
        "model_version": settings.model_version,
        "conditions": CONDITIONS,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    log.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
