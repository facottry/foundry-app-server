import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY,
    R2_SECRET_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_BASE_URL
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error("R2 env variables missing");
}

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY
    }
});

/**
 * Upload buffer to R2
 */
export async function uploadImageToR2({
    buffer,
    contentType,
    folder = "images"
}) {
    const fileKey = `${folder}/${crypto.randomUUID()}`;

    await r2.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileKey,
            Body: buffer,
            ContentType: contentType,
            CacheControl: "public, max-age=31536000"
        })
    );

    return `${R2_PUBLIC_BASE_URL}/${fileKey}`;
}
