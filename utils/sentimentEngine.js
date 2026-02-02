/**
 * Sentiment Engine (Heuristic)
 * Synchronous analysis of review text.
 */

const analyzeSentiment = (text, rating) => {
    const lowerText = (text || '').toLowerCase();

    // Keywords
    const positiveWords = ['love', 'great', 'awesome', 'excellent', 'good', 'best', 'amazing', 'perfect', 'helpful', 'smooth', 'easy', 'fast', 'clean', 'simple', 'intuitive'];
    const negativeWords = ['hate', 'bad', 'terrible', 'worst', 'worse', 'slow', 'buggy', 'crash', 'awful', 'poor', 'useless', 'broken', 'error', 'lag', 'confusing', 'expensive'];

    let score = 0;

    // Keyword scoring
    positiveWords.forEach(w => { if (lowerText.includes(w)) score += 1; });
    negativeWords.forEach(w => { if (lowerText.includes(w)) score -= 1; });

    // Rating Weight (Strong signal)
    // 5 stars is very likely positive, 1 star very likely negative
    if (rating === 5) score += 2;
    if (rating === 4) score += 1;
    if (rating === 2) score -= 1;
    if (rating === 1) score -= 2;

    // Determine Label and Normalized Score (0-1)
    let sentiment = 'neutral';
    let normalizedScore = 0.5; // Default neutral

    if (score >= 2) {
        sentiment = 'positive';
        // Map score 2..Max to 0.6..1.0
        normalizedScore = Math.min(0.6 + (score * 0.05), 1.0);
    } else if (score <= -2) {
        sentiment = 'negative';
        // Map score -2..Min to 0.4..0.0
        normalizedScore = Math.max(0.4 + (score * 0.05), 0.0);
    } else {
        // Neutral range (-1 to 1)
        normalizedScore = 0.5;
    }

    return { sentiment, sentimentScore: normalizedScore };
};

module.exports = { analyzeSentiment };
