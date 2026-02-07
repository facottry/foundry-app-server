/**
 * cacheFirst.js
 * 
 * Implements Stale-While-Revalidate strategy.
 * Use for Public, User-Agnostic APIs only.
 */

const memoryCache = require('./memoryCache');

const ENABLE_CACHE = process.env.ENABLE_LOCAL_CACHE === 'true';
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || '3600000', 10); // 1 Hour

/**
 * Execute Cache-First Strategy
 * @param {Object} options
 * @param {string} options.key - Unique cache key
 * @param {number} [options.ttlMs] - Time to live in ms (default: 1 hour)
 * @param {Function} options.fetcher - Promise-returning function to fetch data
 * @returns {Promise<any>}
 */
const cacheFirst = async ({ key, ttlMs = DEFAULT_TTL, fetcher, res }) => {
    // 1. If Cache Disabled, fetch directly
    if (!ENABLE_CACHE) {
        if (res) res.set('X-Cache', 'DISABLED');
        return fetcher();
    }

    try {
        const cached = memoryCache.get(key);
        const now = Date.now();

        // 2. Cache HIT
        if (cached) {
            if (res) res.set('X-Cache', 'HIT');
            const isStale = (now - cached.timestamp) > ttlMs;

            // If stale and NOT already refreshing, trigger background refresh
            if (isStale) {
                if (!memoryCache.isRefreshing(key)) {
                    memoryCache.markRefreshing(key);

                    // Background Refresh (Fire & Forget)
                    // We do NOT await this.
                    fetcher()
                        .then((freshData) => {
                            memoryCache.set(key, freshData);
                        })
                        .catch((err) => {
                            console.error(`[Cache] Background refresh failed for ${key}:`, err.message);
                            // Do NOTHING else. Stale data remains valid until next success.
                        })
                        .finally(() => {
                            memoryCache.unmarkRefreshing(key);
                        });
                }
            }

            // Return cached data immediately (Fresh or Stale)
            return cached.data;
        }

        // 3. Cache MISS - Fetch synchronously (Blocking)
        // We use the same refreshing lock to prevent stampede on initial fetch if multiple requests come in at once.
        // However, for simplicity and robustness, we will just fetch.
        // If we wanted to prevent stampede on MISS, we would need a pending promise map.
        // For now, simple fetch is acceptable as per "eventual consistency" goal.

        if (res) res.set('X-Cache', 'MISS');
        const data = await fetcher();
        memoryCache.set(key, data);
        return data;

    } catch (err) {
        console.error(`[Cache] Error in cacheFirst for ${key}:`, err.message);
        // If everything fails, throw.
        throw err;
    }
};

module.exports = cacheFirst;
