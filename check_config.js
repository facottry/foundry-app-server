const mongoose = require('mongoose');
const SystemConfig = require('./models/SystemConfig');
require('dotenv').config();

const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database';

mongoose.connect(db)
    .then(async () => {
        console.log('Connected to DB');
        const config = await SystemConfig.findOne({ key: 'PROMO_POPUP_CONFIG' });
        console.log('PROMO_POPUP_CONFIG:', config);

        if (config) {
            console.log('Value Type:', typeof config.value);
            console.log('Value:', config.value);
        } else {
            console.log('Config not found!');
        }

        // Check for Admins collection
        try {
            const adminCount = await mongoose.connection.db.collection('admins').countDocuments();
            console.log('Admin Count in Local DB:', adminCount);
        } catch (e) {
            console.log('Error checking admins:', e.message);
        }

        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
