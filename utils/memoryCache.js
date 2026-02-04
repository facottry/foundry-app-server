/**
 * memoryCache.js
 * 
 * In-process memory store for public API caching.
 * Controlled via Map (Data) and Set (Refresh State).
 */

const cacheStore = new Map();
const refreshingKeys = new Set();

module.exports = {
    /**
     * Retrieve item from cache
     * @param {string} key 
     * @returns {{ data: any, timestamp: number } | undefined}
     */
    get: (key) => cacheStore.get(key),

    /**
     * Store item in cache
     * @param {string} key 
     * @param {any} data 
     */
    set: (key, data) => {
        cacheStore.set(key, {
            data,
            timestamp: Date.now()
        });
    },

    /**
     * Check if key is currently being refreshed
     * @param {string} key 
     * @returns {boolean}
     */
    isRefreshing: (key) => refreshingKeys.has(key),

    /**
     * Mark key as refreshing to prevent stampede
     * @param {string} key 
     */
    markRefreshing: (key) => refreshingKeys.add(key),

    /**
     * Release refresh lock
     * @param {string} key 
     */
    unmarkRefreshing: (key) => refreshingKeys.delete(key),

    /**
     * Optional: Clear cache (for testing/admin)
     */
    clear: () => {
        cacheStore.clear();
        refreshingKeys.clear();
    }
};
