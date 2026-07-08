/**
 * AWS S3 client
 * Traceability: REPORT-FR-003 (PDF storage), CON-PRIV-002 (encrypted at rest)
 * SRS §2.4.3: earlymind-reports bucket (private, signed URLs)
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env';

class EarlyMindS3Client {
    private client: S3Client;

    constructor() {
        this.client = new S3Client({
            region: env.AWS_REGION,
            ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
                ? {
                    credentials: {
                        accessKeyId: env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                    },
                }
                : {}),
        });
    }

    async upload(key: string, body: Buffer, contentType: string): Promise<void> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: env.S3_BUCKET_REPORTS,
                Key: key,
                Body: body,
                ContentType: contentType,
                // CON-PRIV-002: AES-256 encryption enforced by bucket default policy
                ServerSideEncryption: 'AES256',
            }),
        );
    }

    /** Generate a pre-signed URL (1-hour expiry) for private report access */
    async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: env.S3_BUCKET_REPORTS,
            Key: key,
        });
        return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    }
}

export const s3Client = new EarlyMindS3Client();
