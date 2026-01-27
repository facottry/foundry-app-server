const express = require('express');
const router = express.Router();
const SavedFolder = require('../models/SavedFolder');
const SavedProduct = require('../models/SavedProduct');
const Product = require('../models/Product');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');

// @route   GET /api/saved/folders
// @desc    Get all folders for current user (flat list)
// @access  Private
router.get('/folders', auth(), asyncHandler(async (req, res) => {
    const folders = await SavedFolder.find({ user_id: req.user.id }).sort({ name: 1 });
    sendSuccess(res, { folders });
}));

// @route   POST /api/saved/folders
// @desc    Create a new folder
// @access  Private
router.post('/folders', auth(), asyncHandler(async (req, res) => {
    const { name, parent_folder_id } = req.body;

    if (!name) return sendError(res, 'Folder name is required', 400);

    const folder = new SavedFolder({
        user_id: req.user.id,
        name,
        parent_folder_id: parent_folder_id || null
    });

    await folder.save();
    await folder.save();

    // AI SEGMENTATION
    const User = require('../models/User');
    const UserEvent = require('../models/UserEvent');
    await UserEvent.create({ userId: req.user.id, type: 'CREATE_FOLDER', target: name });
    await User.findByIdAndUpdate(req.user.id, { segment_dirty: true });

    sendSuccess(res, { folder });
}));

// @route   PUT /api/saved/folders/:id
// @desc    Rename or move folder
// @access  Private
router.put('/folders/:id', auth(), asyncHandler(async (req, res) => {
    const { name, parent_folder_id } = req.body;
    const folder = await SavedFolder.findOne({ _id: req.params.id, user_id: req.user.id });

    if (!folder) return sendError(res, 'Folder not found', 404);

    if (name) folder.name = name;
    if (parent_folder_id !== undefined) folder.parent_folder_id = parent_folder_id;

    await folder.save();
    sendSuccess(res, { folder });
}));

// @route   DELETE /api/saved/folders/:id
// @desc    Delete folder and un-save contents (cascade unsave, not delete product)
// @access  Private
router.delete('/folders/:id', auth(), asyncHandler(async (req, res) => {
    // Check ownership
    const folder = await SavedFolder.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!folder) return sendError(res, 'Folder not found', 404);

    // Get all subfolder IDs recursively (simplified: just one level or error? Let's generic cascade delete)
    // For MVP, if it has subfolders, we can cascade down.
    // Let's implement simple recursive find of all children.

    const findAllChildren = async (parentId) => {
        const children = await SavedFolder.find({ parent_folder_id: parentId });
        let ids = children.map(c => c._id);
        for (const child of children) {
            ids = ids.concat(await findAllChildren(child._id));
        }
        return ids;
    };

    const childrenIds = await findAllChildren(folder._id);
    const allIdsToDelete = [folder._id, ...childrenIds];

    // Delete folders
    await SavedFolder.deleteMany({ _id: { $in: allIdsToDelete } });

    // Delete SavedProduct links in these folders
    await SavedProduct.deleteMany({ folder_id: { $in: allIdsToDelete } });

    // Note: FolderNotes should also be deleted
    const FolderNote = require('../models/FolderNote');
    await FolderNote.deleteMany({ folder_id: { $in: allIdsToDelete } });

    sendSuccess(res, { message: 'Folder deleted', deleted_ids: allIdsToDelete });
}));


// @route   GET /api/saved/products
// @desc    Get all saved products (flat list, client can index by folder)
// @access  Private
router.get('/products', auth(), asyncHandler(async (req, res) => {
    const saved = await SavedProduct.find({ user_id: req.user.id })
        .populate('product_id', 'name tagline logo_url avg_rating ratings_count')
        .sort({ created_at: -1 });

    sendSuccess(res, { saved_products: saved });
}));

// @route   POST /api/saved/products
// @desc    Save a product (optionally to a folder)
// @access  Private
router.post('/products', auth(), asyncHandler(async (req, res) => {
    const { product_id, folder_id } = req.body;
    if (!product_id) return sendError(res, 'Product ID required', 400);

    // Check if already saved
    let saved = await SavedProduct.findOne({ user_id: req.user.id, product_id });
    if (saved) {
        // If already saved, maybe move it? Or just error?
        // Let's treat it as "Move/Update" if saved already
        if (folder_id !== undefined) {
            saved.folder_id = folder_id || null;
            await saved.save();
        }
        return sendSuccess(res, { saved_product: saved, message: 'Updated location' });
    }

    // Create new
    saved = new SavedProduct({
        user_id: req.user.id,
        product_id,
        folder_id: folder_id || null
    });
    await saved.save();
    await saved.save();

    // AI SEGMENTATION
    const User = require('../models/User');
    const UserEvent = require('../models/UserEvent');
    await UserEvent.create({ userId: req.user.id, type: 'SAVE_PRODUCT', target: product_id });
    await User.findByIdAndUpdate(req.user.id, { segment_dirty: true });

    sendSuccess(res, { saved_product: saved });
}));

// @route   DELETE /api/saved/products/:id
// @desc    Unsave a product (pass SavedProduct ID, or Product ID?)
// @desc    Let's handle route param as product_id for convenience, or saved_product_id.
//          Standard REST is resource ID. But UX usually implies "Toggle Save for this Product".
//          Let's try to delete by product_id first, if not found, assume ID?
//          Safer: DELETE /api/saved/products/:productId (by product ID)
router.delete('/products/:productId', auth(), asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const result = await SavedProduct.findOneAndDelete({
        user_id: req.user.id,
        product_id: productId
    });

    // If result null, maybe user passed the SavedProduct ID?
    if (!result) {
        // Try by ID
        const byId = await SavedProduct.findOneAndDelete({
            _id: productId,
            user_id: req.user.id
        });

        if (!byId) return sendError(res, 'Saved product not found', 404);
    }

    sendSuccess(res, { message: 'Product removed' });
}));

module.exports = router;
