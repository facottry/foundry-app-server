const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { version } = require('./package.json');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Add API_VERSION header to all responses
app.use((req, res, next) => {
    res.setHeader('X-API-VERSION', version);
    next();
});

// Source Validation Middleware (TOTP) - Protects integrity
app.use(require('./middleware/validateSource'));

// DB Status Middleware (Protect All Routes)
app.use((req, res, next) => {
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    // Allow health checks or specific routes if needed, but here we protect everything.
    // If DB is critical for Auth, allow nothing.
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Database connection is down. Please try again later.',
            details: 'The server is running but cannot reach the database.'
        });
    }
    next();
});

// DB Config
const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database';
mongoose.set('strictQuery', false);
const PORT = process.env.PORT || 5000;

// Routes
app.get('/', (req, res) => res.send('API Running'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth/sso', require('./routes/sso')); // New Unified SSO routes

app.use('/api/profile', require('./routes/profile'));
app.use('/api/follows', require('./routes/follows'));
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
app.use('/api/collections', require('./routes/collections')); // NEW Collections Discovery
app.use('/api/founder/traffic', require('./routes/traffic_analytics')); // NEW Traffic analytics
app.use('/api/boost', require('./routes/boost'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/clicks', require('./routes/clicks'));
app.use('/api/contact', require('./routes/contact')); // Public contact form
app.use('/api/uploads', require('./routes/uploads')); // NEW Image Uploads
app.use('/api/stats', require('./routes/stats')); // View/click tracking
app.use('/api/app', require('./routes/appConfig')); // NEW Config
app.use('/r', require('./routes/redirect'));
app.use('/api/subscribe', require('./routes/subscription'));
app.use('/api/newsletters', require('./routes/newsletters')); // Public Archive
app.use('/api/founder/botvas', require('./routes/botvas')); // Bot VAS
app.use('/api/wakeup', require('./routes/wakeup')); // Wakeup API
app.use('/api/feedback', require('./routes/feedback')); // Feedback API


// Global Error Handler
app.use(require('./middleware/errorHandler'));

// Start Cron Jobs
require('./cron/segmentation');
const { initBotVASCron } = require('./cron/botvasCron');
initBotVASCron();

// Connect to MongoDB (Non-blocking)
const connectDB = async () => {
    try {
        await mongoose.connect(db, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('MongoDB Connected');

        // Seed Config (Only if connected)
        try {
            const seedSystemConfig = require('./utils/seedSystemConfig');
            await seedSystemConfig();
        } catch (e) {
            console.error('Seeding Error:', e.message);
        }

        // Run Segmentation immediately on startup
        try {
            const { runSegmentation } = require('./cron/segmentation');
            runSegmentation();
        } catch (e) { console.error('Segmentation Error:', e.message); }

    } catch (err) {
        console.error('MongoDB Connection Failed (Will Retry):', err.message);
        // Do NOT exit process.
        // Optional: Retry logic could be added here or rely on Mongoose's auto-reconnect if it was once connected.
        // But for initial failure, Mongoose gives up. We can retry manually if we want, 
        // but user just said "Server Should up".
        setTimeout(connectDB, 10000); // Retry every 10 seconds
    }
};

connectDB();

// Start Server Immediately
app.listen(PORT, () => console.log(`Server started on port ${PORT} (DB Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'})`));
