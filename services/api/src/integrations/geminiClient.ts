/**
 * Google Gemini API client
 * Traceability: REPORT-FR-001, SRS §2.4.5 (fallback: pre-generated templates)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler.middleware';

class GeminiClient {
    private client: GoogleGenerativeAI | null = null;

    private getClient(): GoogleGenerativeAI {
        if (!this.client) {
            if (!env.GEMINI_API_KEY) {
                throw new AppError(503, 'GEMINI_NOT_CONFIGURED', 'Gemini API key not configured.');
            }
            this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        }
        return this.client;
    }

    async generateText(prompt: string): Promise<string> {
        const client = this.getClient();
        const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        if (!text || text.trim().length === 0) {
            throw new AppError(502, 'GEMINI_EMPTY_RESPONSE', 'Gemini returned empty response.');
        }

        return text;
    }
}

export const geminiClient = new GeminiClient();
