const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Initialize S3 Client for Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
    },
});

/**
 * Upload file to R2
 * @param {Buffer} fileBuffer - File content
 * @param {string} key - Storage key (path)
 * @param {string} contentType - Mime type
 */
const uploadToR2 = async (fileBuffer, key, contentType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
            // ACL: 'public-read' // R2 buckets are usually private/public via domain binding, ACL not always needed/supported same way
        });

        await s3Client.send(command);
        return true;
    } catch (error) {
        console.error('R2 Upload Error:', error);
        throw error;
    }
};

module.exports = { s3Client, uploadToR2 };
