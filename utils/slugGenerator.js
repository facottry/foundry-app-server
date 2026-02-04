/**
 * slugGenerator.js
 * 
 * Shared utility for strict, SEO-friendly slug generation and name cleaning.
 */

const HONORIFICS = new Set([
    'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir', 'madam', 'dame', 'lord', 'lady',
    'rev', 'fr', 'er', 'adv', 'ca', 'phd', 'md', 'founder', 'ceo', 'cto', 'cmo', 'coo',
    'admin', 'user', 'manager', 'director', 'president'
]);

const GENERIC_NAMES = new Set([
    'founder', 'user', 'admin', 'unknown', 'anonymous', 'test', 'tester', 'demo',
    'not specified', 'not publicly listed', 'no name'
]);

const STOP_WORDS = new Set(['the', 'of', 'and', 'at', 'in', 'for']);

const PUBLIC_EMAIL_PROVIDERS = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'
]);

const cleanName = (name) => {
    if (!name) return '';
    // Keep only letters and spaces (strict cleaning)
    let cleaned = name.replace(/[^a-zA-Z\s]/g, '');
    // Collapse multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
};

const capitalize = (str) => str.replace(/\b\w/g, c => c.toUpperCase());

const deriveNameFromEmail = (email) => {
    if (!email) return 'Founder';

    const [local, domain] = email.split('@');
    if (!domain) return local;

    if (PUBLIC_EMAIL_PROVIDERS.has(domain.toLowerCase())) {
        const cleanLocal = local.replace(/[0-9]/g, '');
        return capitalize(cleanLocal.replace(/[._-]/g, ' ')).trim() || 'Founder';
    } else {
        const company = domain.split('.')[0];
        return `${capitalize(company)} Team`;
    }
};

const getEffectiveName = (name, email) => {
    let effectiveName = cleanName(name);
    const normalized = effectiveName.toLowerCase();

    if (!effectiveName || GENERIC_NAMES.has(normalized)) {
        if (email) {
            return deriveNameFromEmail(email);
        }
        // If name is generic and no email, return default
        return 'Founder';
    }
    return effectiveName || 'Founder';
};

const generateBaseSlug = (name) => {
    if (!name) return 'entrepreneur';

    let slug = name.toString();

    // 1. Convert CamelCase (camelCase -> camel-case)
    slug = slug.replace(/([a-z])([A-Z])/g, '$1-$2');

    // 2. Lowercase
    slug = slug.toLowerCase();

    // 3. Remove ALL NUMBERS (Strict Rule)
    slug = slug.replace(/[0-9]/g, '');

    // 4. Special Characters -> Hyphen or Remove
    slug = slug.replace(/\./g, '-');
    slug = slug.replace(/[@#%&*!?,.()\[\]{}"'\/\\\\]/g, '');
    slug = slug.replace(/[^a-z-]/g, '-'); // Only keep letters and hyphens

    // 5. Clean parts
    let parts = slug.split('-');
    parts = parts.filter(p => {
        if (!p) return false;
        if (HONORIFICS.has(p)) return false;
        if (STOP_WORDS.has(p)) return false;
        return true;
    });

    slug = parts.join('-');

    // 6. Deduplicate hyphens
    slug = slug.replace(/-+/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');

    // 7. Fallback if empty
    if (!slug) slug = 'entrepreneur';

    // 8. Truncate
    if (slug.length > 50) {
        slug = slug.substring(0, 50).replace(/-+$/, '');
    }

    return slug;
};

module.exports = { generateBaseSlug, cleanName, deriveNameFromEmail, getEffectiveName };
