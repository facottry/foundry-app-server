const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// DB Config
const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foundry';
mongoose.set('strictQuery', false);
const PORT = process.env.PORT || 5000;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/products', require('./routes/products'));
app.use('/api/products', require('./routes/productTabs')); // Tab endpoints
app.use('/api/products', require('./routes/tags')); // Tag endpoints
app.use('/api/search', require('./routes/search')); // Search endpoints
app.use('/api/events', require('./routes/events')); // Interaction tracking
app.use('/api/reviews', require('./routes/reviews')); // Reviews API
app.use('/api/saved', require('./routes/saved'));
app.use('/api/notes', require('./routes/notes'));
app.use('/r', require('./routes/redirect')); // Short URL for redirects
app.use('/api/tracks', require('./routes/track')); // Legacy Analytics tracking
app.use('/api/founder', require('./routes/founder'));
app.use('/api/analytics', require('./routes/analytics')); // Product analytics
app.use('/api/categories', require('./routes/categories')); // NEW Category Discovery
app.use('/api/founder/traffic', require('./routes/traffic_analytics')); // NEW Traffic analytics
app.use('/api/boost', require('./routes/boost'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/clicks', require('./routes/clicks'));
app.use('/api/contact', require('./routes/contact')); // Public contact form
app.use('/api/uploads', require('./routes/uploads')); // NEW Image Uploads
app.use('/api/stats', require('./routes/stats')); // View/click tracking
app.use('/api/app', require('./routes/appConfig')); // NEW Config
app.use('/r', require('./routes/redirect'));

// Global Error Handler
app.use(require('./middleware/errorHandler'));

// Start Cron Jobs
require('./cron/segmentation');

// Connect to MongoDB
mongoose.connect(db)
    .then(async () => {
        console.log('MongoDB Connected');

        // Seed Config
        const seedSystemConfig = require('./utils/seedSystemConfig');
        await seedSystemConfig();

        app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

        // Run Segmentation immediately on startup
        const { runSegmentation } = require('./cron/segmentation');
        runSegmentation();
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    });
