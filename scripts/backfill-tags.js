require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Review = require('../models/Review');
    const reviews = await Review.find({ ai_tags: { $size: 0 } });
    console.log('Found', reviews.length, 'reviews without tags');

    for (const r of reviews) {
        const text = (r.text + ' ' + (r.title || '')).toLowerCase();
        const tags = [];

        if (text.match(/easy|simple|intuitive|user-friendly/)) tags.push('easy-to-use');
        if (text.match(/fast|speed|performance|quick/)) tags.push('performance');
        if (text.match(/bug|crash|error|broken|fail/)) tags.push('buggy');
        if (text.match(/support|help|service|team/)) tags.push('support');
        if (text.match(/price|cost|expensive|cheap|value/)) tags.push('pricing');
        if (text.match(/feature|missing|request|need/)) tags.push('features');
        if (text.match(/best|great|awesome|excellent|amazing/)) tags.push('highly-rated');
        if (text.match(/work|working|expected/)) tags.push('reliable');
        if (text.match(/agent|ai|automation/)) tags.push('ai-powered');

        r.ai_tags = tags;
        await r.save();
        console.log('Tagged review', r._id.toString(), 'with', tags);
    }

    await mongoose.disconnect();
    console.log('Done');
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
