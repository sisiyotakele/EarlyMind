/**
 * ML Service client — calls internal /internal/ml/predict endpoint
 * Traceability: SRS §9.3 (ML Inference API)
 *
 * "Internal endpoint POST /internal/ml/predict accepts a feature vector
 *  and returns per-condition risk scores, confidence, and SHAP values.
 *  Target latency <5s. Not exposed publicly — accessible only from the
 *  backend within the VPC."
 */

import type { MlInferenceRequest, MlInferenceResponse } from '@earlymind/shared-types';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler.middleware';

const ML_PREDICT_ENDPOINT = `${env.ML_SERVICE_URL}/internal/ml/predict`;
const ML_TIMEOUT_MS = 5_000; // PERF-NFR-003: <5s

class MlServiceClient {
    /**
     * Submit a feature vector for multi-label LD classification.
     * SRS §9.3: POST /internal/ml/predict
     */
    async predict(request: MlInferenceRequest): Promise<MlInferenceResponse> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

        try {
            const response = await fetch(ML_PREDICT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new AppError(
                    502,
                    'ML_SERVICE_ERROR',
                    `ML service returned ${response.status}`,
                );
            }

            return (await response.json()) as MlInferenceResponse;
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                throw new AppError(504, 'ML_TIMEOUT', 'ML inference timed out (>5s).');
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }
}

export const mlServiceClient = new MlServiceClient();
