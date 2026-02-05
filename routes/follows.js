const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');

// Toggle Follow Product
// Toggle Follow Product
router.post('/product/:id', auth, async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Initialize follows if missing
        if (!user.follows) user.follows = { productIds: [], categoryIds: [] };
        if (!user.follows.productIds) user.follows.productIds = [];

        const index = user.follows.productIds.indexOf(productId);
        let isFollowing = false;

        if (index === -1) {
            // Follow
            user.follows.productIds.push(productId);
            // Optional: Increment follower count on Product if needed, but safe to just track user side here
            await Product.findByIdAndUpdate(productId, { $inc: { follower_count: 1 } });
            isFollowing = true;
        } else {
            // Unfollow
            user.follows.productIds.splice(index, 1);
            await Product.findByIdAndUpdate(productId, { $inc: { follower_count: -1 } });
            isFollowing = false;
        }

        await user.save();
        res.json({ success: true, isFollowing, productIds: user.follows.productIds });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Toggle Follow Category
router.post('/category/:id', auth, async (req, res) => {
    try {
        const categoryId = req.params.id; // Slug or ID
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Initialize follows if missing
        if (!user.follows) user.follows = { productIds: [], categoryIds: [] };
        if (!user.follows.categoryIds) user.follows.categoryIds = [];

        const index = user.follows.categoryIds.indexOf(categoryId);
        let isFollowing = false;

        if (index === -1) {
            // Follow
            user.follows.categoryIds.push(categoryId);
            isFollowing = true;
        } else {
            // Unfollow
            user.follows.categoryIds.splice(index, 1);
            isFollowing = false;
        }

        await user.save();
        res.json({ success: true, isFollowing, categoryIds: user.follows.categoryIds });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get User Follows
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('follows');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        res.json({
            follows: user.follows || { productIds: [], categoryIds: [] }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Check Product Follow State
router.get('/product/:id/state', auth, async (req, res) => {
    try {
        const productId = req.params.id;
        const user = await User.findById(req.user.id).select('follows');

        if (!user) return res.status(404).json({ msg: 'User not found' });

        const isFollowing = user.follows && user.follows.productIds && user.follows.productIds.includes(productId);
        res.json({ isFollowing });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Check Category Follow State
router.get('/category/:id/state', auth, async (req, res) => {
    try {
        const categoryId = req.params.id;
        const user = await User.findById(req.user.id).select('follows');

        if (!user) return res.status(404).json({ msg: 'User not found' });

        const isFollowing = user.follows && user.follows.categoryIds && user.follows.categoryIds.includes(categoryId);
        res.json({ isFollowing });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
