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

    try {
        const { type } = req.body; // product_logo, screenshot, team_photo
        if (!['product_logo', 'screenshot', 'team_photo'].includes(type)) {
            return sendError(res, 'Invalid upload type', 400);
        }

        // Enforce specific size limits per type
        if (['product_logo', 'team_photo'].includes(type) && req.file.size > 1 * 1024 * 1024) {
            return sendError(res, 'File too large. Max 1MB for logos/photos.', 400);
        }

        // Generate Key
        const ext = path.extname(req.file.originalname);
        const key = `founders/${req.user.id}/${type}/${uuidv4()}${ext}`;

        // Upload to R2
        await uploadToR2(req.file.buffer, key, req.file.mimetype);

        // Construct Public URL
        const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;

        sendSuccess(res, { url: publicUrl });
    } catch (err) {
        console.error('Upload Route Error:', err);
        sendError(res, 'Upload failed', 500);
    }
});

module.exports = router;
