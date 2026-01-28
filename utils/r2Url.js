const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

/**
 * Build public R2 URL from key
 * @param {string} key - Storage key
 * @returns {string} Public URL
 */
const buildPublicR2Url = (key) => {
    if (!key) return null;
    if (key.startsWith('http')) return key;

    // Ensure R2_PUBLIC_BASE_URL is defined
    if (!R2_PUBLIC_BASE_URL) {
        console.warn('R2_PUBLIC_BASE_URL is not defined');
        return key; // Fallback to key if base url missing, though ideally should be fixed
    }

    // Remove leading slash from key if present to avoid double slashes
    const cleanKey = key.startsWith('/') ? key.slice(1) : key;

    // Remove trailing slash from base url if present
    const cleanBase = R2_PUBLIC_BASE_URL.endsWith('/') ? R2_PUBLIC_BASE_URL.slice(0, -1) : R2_PUBLIC_BASE_URL;

    return `${cleanBase}/${cleanKey}`;
};

module.exports = { buildPublicR2Url };
