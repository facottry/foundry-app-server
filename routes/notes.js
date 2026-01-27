const express = require('express');
const router = express.Router();
const FolderNote = require('../models/FolderNote');
const ProductNote = require('../models/ProductNote');
const SavedFolder = require('../models/SavedFolder');
const SavedProduct = require('../models/SavedProduct');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');

// @route   GET /api/notes/folder/:folderId
// @desc    Get note for a folder
// @access  Private
router.get('/folder/:folderId', auth(), asyncHandler(async (req, res) => {
    const { folderId } = req.params;

    // Verify folder ownership
    const folder = await SavedFolder.findOne({ _id: folderId, user_id: req.user.id });
    if (!folder) return sendError(res, 'Folder not found', 404);

    const note = await FolderNote.findOne({ folder_id: folderId });
    sendSuccess(res, { note: note || { content: '' } });
}));

// @route   POST /api/notes/folder
// @desc    Upsert note for a folder
// @access  Private
router.post('/folder', auth(), asyncHandler(async (req, res) => {
    const { folderId, content } = req.body;
    if (!folderId) return sendError(res, 'Folder ID required', 400);

    // Verify folder ownership
    const folder = await SavedFolder.findOne({ _id: folderId, user_id: req.user.id });
    if (!folder) return sendError(res, 'Folder not found', 404);

    const note = await FolderNote.findOneAndUpdate(
        { folder_id: folderId },
        {
            folder_id: folderId,
            user_id: req.user.id,
            content,
            updated_at: Date.now()
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    sendSuccess(res, { note });
}));

// @route   GET /api/notes/product/:productId
// @desc    Get note for a product
// @access  Private
router.get('/product/:productId', auth(), asyncHandler(async (req, res) => {
    const { productId } = req.params;

    // Check if user has saved this product? Or just let them note on any product?
    // Let's allow notes on any product even if not saved, it's personal knowledge.
    // But conceptually, it's usually for saved items.
    // For now, no strict "is saved" check, just user+product ownership of note.

    const note = await ProductNote.findOne({ user_id: req.user.id, product_id: productId });
    sendSuccess(res, { note: note || { content: '' } });
}));

// @route   POST /api/notes/product
// @desc    Upsert note for a product
// @access  Private
router.post('/product', auth(), asyncHandler(async (req, res) => {
    const { productId, content } = req.body;
    if (!productId) return sendError(res, 'Product ID required', 400);

    const note = await ProductNote.findOneAndUpdate(
        { user_id: req.user.id, product_id: productId },
        {
            user_id: req.user.id,
            product_id: productId,
            content,
            updated_at: Date.now()
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    sendSuccess(res, { note });
}));

module.exports = router;
