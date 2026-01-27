const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const ProductEvent = require('../models/ProductEvent');
const OutboundClick = require('../models/OutboundClick');
const crypto = require('crypto');
require('dotenv').config({ path: '../.env' });

// --- CONFIG ---
const FOUNDER_COUNT = 20;
const CUSTOMER_COUNT = 30;
const PRODUCTS_PER_FOUNDER = 3;
const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foundry';
const DEFAULT_PASSWORD = 'password123';

// --- DATA POOLS ---
const FIRST_NAMES = ['Alex', 'Jordan', 'Casey', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Parker', 'Quinn', 'Rowan', 'Arjun', 'Priya', 'Rahul', 'Sneha', 'Liam', 'Noah', 'Oliver', 'Emma', 'Ava', 'Sophia', 'Lucas', 'Mia', 'Isabella', 'Ethan', 'Siya', 'Vihaan', 'Aditya', 'Fatima', 'Zain', 'Sarah', 'David', 'Marie', 'Pierre', 'Hans', 'Greta'];
const LAST_NAMES = ['Chen', 'Smith', 'Patel', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Gupta', 'Sharma', 'Singh', 'Khan', 'Ali', 'Muller', 'Schmidt', 'Dubois', 'Laurent'];
const CITIES = ['San Francisco', 'New York', 'Bangalore', 'London', 'Berlin', 'Toronto', 'Austin', 'Tel Aviv', 'Singapore', 'Sydney', 'Mumbai', 'Delhi', 'Paris', 'Munich', 'Chicago', 'Boston'];
const TITLES = ['Founder', 'Co-Founder', 'Indie Hacker', 'Solo Dev', 'CTO', 'Product Lead', 'Builder'];

const PRODUCT_PREFIXES = ['Flow', 'Mail', 'Snap', 'Task', 'Deploy', 'Pixel', 'Hire', 'Video', 'Code', 'Data', 'Cloud', 'Cyber', 'Auto', 'Smart', 'Quick', 'Zen', 'Base', 'Core', 'Net', 'Sky'];
const PRODUCT_SUFFIXES = ['Desk', 'Pilot', 'Resume', 'Zen', 'Fast', 'Craft', 'Lens', 'Forge', 'Hub', 'Lab', 'Box', 'Sync', 'Stream', 'Flow', 'Scale', 'Base', 'ly', 'ify', 'io', 'app'];

const CATEGORIES = ['AI', 'DevTools', 'Design', 'Marketing', 'EdTech', 'Productivity', 'NoCode', 'Analytics', 'Finance', 'HR', 'Video', 'SEO', 'Automation'];

const TAGLINES = [
    'The all-in-one platform for creators',
    'Build better software, faster',
    'Simplify your daily workflow',
    'Automate your busy work instantly',
    'The smartest way to manage data',
    'Design beautiful interfaces in minutes',
    'Scale your business with ease',
    'Your personal productivity assistant',
    'Transform your content workflow',
    'Connect with your customers seamlessly'
];

const REVIEW_DATA = [
    { rating: 5, title: 'Amazing tool!', body: 'This helped me save so much time. Highly recommended.' },
    { rating: 5, title: 'Game changer', body: 'I cannot imagine my workflow without this anymore.' },
    { rating: 4, title: 'Solid product', body: 'Works well, but could use a few more integrations.' },
    { rating: 4, title: 'Great value', body: 'For the price, this is unbeatable.' },
    { rating: 5, title: 'Best in class', body: 'I have tried many alternatives, but this one wins.' },
    { rating: 3, title: 'Good start', body: 'Promising, but needs some UI polish.' },
    { rating: 4, title: 'Very useful', body: 'Simple and effective. Does exactly what it says.' },
    { rating: 5, title: 'Love it', body: 'The support team is also fantastic.' },
    { rating: 2, title: 'Not for me', body: 'A bit too complex for my needs.' },
    { rating: 4, title: 'Impressive', body: 'The AI features are surprisingly good.' }
];

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge'];
const OS_LIST = ['Windows', 'Mac', 'iOS', 'Android', 'Linux'];
const GEO_LOCATIONS = [
    { country: 'US', cities: ['New York', 'San Francisco', 'Chicago', 'Austin'] },
    { country: 'IN', cities: ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'] },
    { country: 'GB', cities: ['London', 'Manchester', 'Bristol'] },
    { country: 'DE', cities: ['Berlin', 'Munich', 'Hamburg'] },
    { country: 'CA', cities: ['Toronto', 'Vancouver', 'Montreal'] }
];

// --- HELPERS ---
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomDate = (daysBack) => {
    const date = new Date();
    date.setDate(date.getDate() - getRandomInt(0, daysBack));
    // Add random time
    date.setHours(getRandomInt(0, 23), getRandomInt(0, 59));
    return date;
};

// --- MAIN ---
const seed = async () => {
    console.log('🌱 Starting Extended Seed Process...');

    try {
        await mongoose.connect(DB_URI);
        console.log('✅ MongoDB Connected');

        // Clean slate
        console.log('⚠️  Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Product.deleteMany({}),
            Review.deleteMany({}),
            ProductEvent.deleteMany({}),
            OutboundClick.deleteMany({})
        ]);
        console.log('✅ Data Cleared.');

        // Create Password Hash
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);

        const foundersToCreate = [];
        const customersToCreate = [];
        const usedProductNames = new Set();
        const usedEmails = new Set();

        // 1. Generate Founders
        console.log(`Generating ${FOUNDER_COUNT} Founders...`);
        for (let i = 0; i < FOUNDER_COUNT; i++) {
            const firstName = getRandom(FIRST_NAMES);
            const lastName = getRandom(LAST_NAMES);
            let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.f${i}@foundry.test`;

            const user = {
                name: `${firstName} ${lastName}`,
                email,
                password_hash: passwordHash,
                role: 'FOUNDER',
                credits_balance: 1000,
                email_verified: true,
                created_at: getRandomDate(60),
                role_title: getRandom(TITLES),
                location: getRandom(CITIES),
                bio: `Building cool things in ${getRandom(CATEGORIES)}.`,
                onboarding_completed: true,
                segments: [{ label: 'Founder', confidence: 1.0 }]
            };
            foundersToCreate.push(user);
        }
        const createdFounders = await User.insertMany(foundersToCreate);
        console.log(`✅ ${createdFounders.length} Founders Created.`);

        // 2. Generate Customers
        console.log(`Generating ${CUSTOMER_COUNT} Customers...`);
        for (let i = 0; i < CUSTOMER_COUNT; i++) {
            const firstName = getRandom(FIRST_NAMES);
            const lastName = getRandom(LAST_NAMES);
            let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.c${i}@foundry.test`;

            const customer = {
                name: `${firstName} ${lastName}`,
                email,
                password_hash: passwordHash,
                role: 'CUSTOMER',
                credits_balance: 0,
                email_verified: true,
                created_at: getRandomDate(30),
                onboarding_completed: true,
                segments: [{ label: getRandom(['Developer', 'Product Manager', 'Marketer', 'Student']), confidence: 0.8 }]
            };
            customersToCreate.push(customer);
        }
        const createdCustomers = await User.insertMany(customersToCreate);
        console.log(`✅ ${createdCustomers.length} Customers Created.`);

        // 3. Generate Products
        console.log(`Generating ${FOUNDER_COUNT * PRODUCTS_PER_FOUNDER} Products...`);
        const productsToCreate = [];

        for (const founder of createdFounders) {
            for (let j = 0; j < PRODUCTS_PER_FOUNDER; j++) {
                let pName;
                let attempts = 0;
                do {
                    pName = getRandom(PRODUCT_PREFIXES) + getRandom(PRODUCT_SUFFIXES);
                    attempts++;
                } while (usedProductNames.has(pName) && attempts < 50);
                if (usedProductNames.has(pName)) pName += ` ${j}`;
                usedProductNames.add(pName);

                const category = getRandom(CATEGORIES);
                const product = {
                    owner_user_id: founder._id,
                    name: pName,
                    tagline: getRandom(TAGLINES),
                    description: `${pName} is a revolutionary tool for ${category}. It helps you ${getRandom(['automate', 'scale', 'build', 'design'])} your projects with ${getRandom(['AI', 'ease', 'speed'])}. Trusted by thousands of users worldwide.`,
                    website_url: `https://${pName.toLowerCase()}.com`,
                    logo_url: `https://ui-avatars.com/api/?name=${pName}&background=random&color=fff&size=128`,
                    screenshots: [
                        `https://placehold.co/800x600/EEE/31343C?text=${pName}+Dashboard`,
                        `https://placehold.co/800x600/EEE/31343C?text=${pName}+Features`
                    ],
                    categories: [category, getRandom(CATEGORIES)],
                    tags: [category.toLowerCase(), 'saas', 'tool'],
                    status: 'approved',
                    traffic_enabled: true,
                    created_at: getRandomDate(60),
                    avg_rating: 0,
                    ratings_count: 0
                };
                productsToCreate.push(product);
            }
        }
        const createdProducts = await Product.insertMany(productsToCreate);
        console.log(`✅ ${createdProducts.length} Products Created.`);

        // 4. Generate Reviews
        console.log('Generating Reviews...');
        const reviewsToCreate = [];

        for (const customer of createdCustomers) {
            const reviewCount = getRandomInt(2, 4);
            for (let k = 0; k < reviewCount; k++) {
                const product = getRandom(createdProducts);
                const content = getRandom(REVIEW_DATA);

                reviewsToCreate.push({
                    product_id: product._id,
                    user_id: customer._id,
                    rating: content.rating,
                    text: content.body, // Schema uses 'text'
                    created_at: getRandomDate(30),
                    session_id: crypto.randomBytes(8).toString('hex')
                });
            }
        }
        await Review.insertMany(reviewsToCreate);
        console.log(`✅ ${reviewsToCreate.length} Reviews Created.`);

        // Update Product Ratings
        console.log('Updating Product Ratings...');
        for (const product of createdProducts) {
            const productReviews = reviewsToCreate.filter(r => r.product_id === product._id);
            if (productReviews.length > 0) {
                const avg = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
                await Product.findByIdAndUpdate(product._id, {
                    avg_rating: parseFloat(avg.toFixed(1)),
                    ratings_count: productReviews.length
                });
            }
        }

        // 5. Generate Analytics Events (Views -> Clicks -> Confirmed)
        console.log('Generatign Analytics Events (Views/Clicks/Confirms)...');
        const eventsToCreate = [];
        const clicksToCreate = [];

        // Helper for Geo/Device
        const generateMeta = () => {
            const geo = getRandom(GEO_LOCATIONS);
            const city = getRandom(geo.cities);
            return {
                country: geo.country,
                city,
                device_type: getRandom(DEVICE_TYPES),
                browser: getRandom(BROWSERS),
                os: getRandom(OS_LIST)
            };
        };

        for (const product of createdProducts) {
            const viewCount = getRandomInt(40, 100);
            const clickCount = Math.floor(viewCount * (getRandomInt(10, 40) / 100));
            const confirmCount = Math.floor(clickCount * (getRandomInt(30, 70) / 100));

            // Views
            for (let v = 0; v < viewCount; v++) {
                const meta = generateMeta();
                const date = getRandomDate(30);
                eventsToCreate.push({
                    product_id: product._id,
                    event_type: 'VIEW',
                    user_id: Math.random() > 0.7 ? getRandom(createdCustomers)._id : null,
                    session_id: crypto.randomBytes(8).toString('hex'),
                    ip_hash: crypto.randomBytes(16).toString('hex'),
                    ...meta,
                    created_at: date
                });
            }

            // Clicks
            for (let c = 0; c < clickCount; c++) {
                const meta = generateMeta();
                const date = getRandomDate(30);
                eventsToCreate.push({
                    product_id: product._id,
                    event_type: 'CLICK',
                    user_id: Math.random() > 0.7 ? getRandom(createdCustomers)._id : null,
                    session_id: crypto.randomBytes(8).toString('hex'),
                    ip_hash: crypto.randomBytes(16).toString('hex'),
                    ...meta,
                    created_at: date
                });
            }

            // Confirmed Clicks (OutboundClick)
            for (let cc = 0; cc < confirmCount; cc++) {
                const date = getRandomDate(30);
                clicksToCreate.push({
                    product_id: product._id,
                    confirmed: true,
                    confirmed_at: date,
                    click_id: crypto.randomUUID(), // ADDED THIS
                    cost: 1,
                    ip_address: '127.0.0.1',
                    user_agent: 'SeedScript/1.0',
                    created_at: date
                });
            }
        }

        if (eventsToCreate.length > 0) await ProductEvent.insertMany(eventsToCreate);
        if (clicksToCreate.length > 0) await OutboundClick.insertMany(clicksToCreate);

        console.log(`✅ ${eventsToCreate.length} Events & ${clicksToCreate.length} Confirmed Clicks Created.`);

    } catch (err) {
        console.error('❌ SEED ERROR:', err);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Connection Closed');
        process.exit();
    }
};

seed();
