/**
 * Extracts the root domain from a URL or Email string.
 * @param {string} urlOrEmail 
 * @returns {string|null} normalized domain (e.g. 'edutainverse.com') or null if invalid
 */
const extractDomain = (input) => {
    if (!input) return null;

    let domain = input.toLowerCase().trim();

    // If it's an email (contains @), take the part after @
    if (domain.includes('@')) {
        domain = domain.split('@')[1];
    }
    // If it's a URL, use URL API
    else {
        try {
            // Add protocol if missing for URL parsing
            if (!domain.startsWith('http')) {
                domain = 'http://' + domain;
            }
            const urlObj = new URL(domain);
            domain = urlObj.hostname;
        } catch (e) {
            return null;
        }
    }

    // Normalize: remove www.
    if (domain.startsWith('www.')) {
        domain = domain.substring(4);
    }

    return domain;
};

module.exports = { extractDomain };
