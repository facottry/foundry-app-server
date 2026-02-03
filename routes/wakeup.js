const express = require('express');
const router = express.Router();

// @route   GET /api/wakeup
// @desc    Keep-alive endpoint
// @access  Public
router.get('/', (req, res) => {
    res.status(200).send('Wakeup call received');
});

module.exports = router;
