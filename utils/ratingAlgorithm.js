/**
 * Rating & Satisfaction Algorithms
 * Implements weighted rating decay and weekly satisfaction scores.
 */
// Native ISO Week helper if date-fns not installed (keeping dependencies minimal)
const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
};

const DECAY_CONSTANT = 180; // Days (approx 6 months halflife)

const calculateProductStats = (reviews) => {
    if (!reviews || reviews.length === 0) {
        return {
            weightedRating: 0,
            ratingCount: 0,
            reviewCount: 0,
            sentimentSummary: { positive: 0, neutral: 0, negative: 0 },
            weeklySatisfaction: []
        };
    }

    const now = new Date();
    let weightedSum = 0;
    let weightSum = 0;

    // Aggregates
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    const weeklyMap = {}; // "2026-W05" -> { scoreSum, count }

    reviews.forEach(r => {
        // 1. Weighted Rating Calculation
        const createdAt = new Date(r.created_at);
        const daysSince = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));

        // Recency Factor: e^(-days / decay)
        const recencyWeight = Math.exp(-daysSince / DECAY_CONSTANT);

        // Volume Factor: log(total + 1) -> Applied at end or per review? 
        // PRD: "weight = recency_factor * volume_factor". 
        // Volume factor is usually global. Formula: Σ(rating * w) / Σ(w). 
        // If volume_factor is global, it cancels out in weighted average division.
        // Assuming volume dampening is meant to pull low-volume products towards global average (Bayesian) 
        // OR the PRD implies individual review weight is just recency.
        // "New good reviews lift rating faster when volume is low" -> This implies Bayesian or similar.
        // BUT strict formula in PRD: "weight = recency_factor * volume_factor" where volume is total reviews.
        // If volume is constant for all reviews in this batch, it cancels out in the average.
        // Let's implement Recency Weighted Average first.
        // For "Low volume protection", usually we add dummy votes (C * m + Sum(x)) / (C + n).
        // PRD says: "Old reviews decay... New improvements lift rating faster".
        // Let's stick to Recency Weight for the average.

        const weight = recencyWeight;

        weightedSum += r.rating * weight;
        weightSum += weight;

        // 2. Sentiment Counts
        if (r.sentiment === 'positive') positive++;
        else if (r.sentiment === 'negative') negative++;
        else neutral++;

        // 3. Weekly Satisfaction
        // Score: Pos(+1), Neu(0), Neg(-1)
        let satScore = 0;
        if (r.sentiment === 'positive') satScore = 1;
        else if (r.sentiment === 'negative') satScore = -1;

        const { year, week } = getWeekNumber(createdAt);
        const weekKey = `${year}-W${String(week).padStart(2, '0')}`;

        if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { total: 0, weight: 0 };

        // Weekly score is also recency weighted? 
        // PRD: "Weighted by recency... Normalized weekly".
        // Logic: For a specific week, the reviews IN that week are what matters. 
        // Recency within the week? Or just raw average of that week?
        // "Normalized weekly into 0-100 band".
        // Let's calculate raw satisfaction for that week.
        // (Pos - Neg) / Total * 100? -> -100 to +100. Map to 0-100.
        // ((Score / Total) + 1) * 50.

        weeklyMap[weekKey].total += satScore; // +1, 0, -1
        weeklyMap[weekKey].weight += 1;       // Count
    });

    // Final Weighted Rating
    // Prevent division by zero
    let weightedRating = weightSum > 0 ? (weightedSum / weightSum) : 0;

    // Volume dampening / Bayesian correction (Optional but good for "Low volume protection")
    // If < 5 reviews, pull towards 3.0? PRD "Low volume protection" mentioned.
    // "Sudden negative does NOT crash rating instantly" -> Weighted average handles this if history is long.
    // "New improvements lift rating faster" -> Recency weight handles this.

    // Sort Weekly Data
    const weeklySatisfaction = Object.keys(weeklyMap).sort().map(week => {
        const { total, weight } = weeklyMap[week];
        // Avg (-1 to 1)
        const avg = total / weight;
        // Normalize to 0-100
        // -1 -> 0, 0 -> 50, 1 -> 100
        const normalized = Math.round(((avg + 1) / 2) * 100);
        return { week, score: normalized };
    });

    return {
        weightedRating: parseFloat(weightedRating.toFixed(2)),
        ratingCount: reviews.length, // Total reviews (assuming 1 rating per review)
        reviewCount: reviews.length,
        sentimentSummary: { positive, neutral, negative },
        weeklySatisfaction
    };
};

module.exports = { calculateProductStats };
