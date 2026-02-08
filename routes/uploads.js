const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToR2 } = require('../utils/r2');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { sendSuccess, sendError } = require('../utils/response');

// Memory storage for Multer (we process and upload to R2 directly)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 3 * 1024 * 1024, // 3MB limit (matches max screenshot requirement)
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (jpg, png, webp) are allowed'));
        }
    }
});

// @route   POST /api/uploads/image
// @desc    Upload image to R2
// @access  Founder
router.post('/image', auth(['FOUNDER']), upload.single('file'), async (req, res) => {
    if (!req.file) {
        return sendError(res, 'No file uploaded', 400);
    }

    const { type } = req.body;
    if (!['product_logo', 'screenshot', 'team_photo', 'avatar'].includes(type) && !['product_logo', 'screenshot', 'team_photo'].includes(type)) {
        // Added avatar support if needed, though instructions focused on user profile image which might be "avatar"
        // Validating against known types. Strict adherence to instructions.
        // Instructions: "When founder uploads profile pic: users/{userId}/avatar.png"
        // The current code only had product_logo, screenshot, team_photo.
        // I should probably add 'avatar' or 'profile_image' handling if it's new.
        // But let's check if the current frontend calls it 'avatar'.
    }

    // Standardize types based on request:
    // User profile: users/{userId}/avatar.png -> implies type 'avatar' or 'profile' ?
    // Let's allow 'avatar' for profile image.

    const validTypes = ['product_logo', 'screenshot', 'team_photo', 'avatar'];
    if (!validTypes.includes(type)) {
        return sendError(res, 'Invalid upload type', 400);
    }

    try {
        // Enforce specific size limits per type
        const MIN_SIZE = 5 * 1024; // 5KB

        if (req.file.size < MIN_SIZE) {
            return sendError(res, 'File too small. Min 5KB required.', 400);
        }

        if (['product_logo', 'team_photo', 'avatar'].includes(type) && req.file.size > 1 * 1024 * 1024) {
            return sendError(res, 'File too large. Max 1MB for logos/photos.', 400);
        }

        // Generate Key
        const ext = path.extname(req.file.originalname);
        let key;

        if (type === 'avatar') {
            // Fixed path for avatar as per instructions: users/{userId}/avatar.png
            // Using .png? User said "users/{userId}/avatar.png".
            // But we should probably preserve extension or convert. Use extension for now.
            // Actually, the prompt says: "users/{userId}/avatar.png" specifically.
            // But also "Allow only: image/png, image/jpeg, image/webp".
            // If I rename to .png but it's jpeg, that's bad.
            // I'll stick to UUID or standard naming, but user asked for "users/{userId}/avatar.png".
            // Maybe they meant the logical path.
            // "Save returned key into: users.profileImageKey".
            // If I use unique keys, cache busting is easier.
            // "Cache Busting: Append ?ts=updatedAt".
            // So I can reuse the same key?
            // "Ensure DB stores only object key: products/123/logo.png".
            // This implies fixed keys.
            // "users/{userId}/avatar.png" -> This is a fixed key.
            // So overwriting the same file.

            key = `users/${req.user.id}/avatar${ext}`;
        } else if (type === 'product_logo') {
            // User: "products/{productId}/logo.png"
            // But we don't have productId in req.body?
            // Need productId to be passed in.
            // checking req.body.productId
            if (req.body.productId) {
                key = `products/${req.body.productId}/logo${ext}`;
            } else {
                // Fallback if no productId (e.g. creating new product)
                // "Generate Key ... founders/.../uuid" was old behavior.
                // If allow only "minimal additive changes", maybe I should keep uuid for new products?
                // But user strongly requested "products/123/logo.png".
                // If I don't have ID, I can't do that.
                // Frontend "Create Product" -> Upload Logo (no ID yet).
                // In that case, maybe temp location?
                // Or stick to uuid and return it.
                // User said: "Ensure DB stores only object key ... products/123/logo.png".
                // This might be a strict requirement for *stored* products.
                // For now, I'll support both strategies or stick to UUID if ID not present.
                key = `founders/${req.user.id}/${type}/${uuidv4()}${ext}`;
            }
        } else if (type === 'screenshot') {
            // "products/{productId}/screenshots/{uuid}.png"
            if (req.body.productId) {
                key = `products/${req.body.productId}/screenshots/${uuidv4()}${ext}`;
            } else {
                key = `founders/${req.user.id}/${type}/${uuidv4()}${ext}`;
            }
        } else {
            key = `founders/${req.user.id}/${type}/${uuidv4()}${ext}`;
        }

        // Upload to R2
        await uploadToR2(req.file.buffer, key, req.file.mimetype);

        console.log(`Uploaded image ${key} for userId=${req.user.id}`);

        // Construct Public URL
        const { buildPublicR2Url } = require('../utils/r2Url');
        const publicUrl = buildPublicR2Url(key);

        sendSuccess(res, { url: publicUrl, key: key });
    } catch (err) {
        console.error('Upload Route Error:', err);
        // "R2 upload failed: reason"
        console.error(`R2 upload failed: ${err.message}`);
        sendError(res, 'Upload failed', 500);
    }
});

module.exports = router;
