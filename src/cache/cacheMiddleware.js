import cacheManager from "./cacheManager.js";
import lockService from "./lockService.js";
import { cacheKeys } from "./cacheKeys.js";
import sessionService from "../utils/sessionService.js";

/**
 * Cache middleware for GET requests
 * Caches successful responses and serves them from cache on subsequent requests
 */
export const cacheMiddleware = (options = {}) => {
  // Configuration options with defaults
  const {
    ttl = 300, // Time-to-live for cache in seconds
    keyPrefix = "cache", // Prefix for all cache keys
    includeUser = true, // Whether to include user ID in cache key
    includeSession = true, // Whether to include session ID in cache key
    includeQuery = true, // Whether to include query params in cache key
    condition = null, // Optional function to decide if caching should run
  } = options;

  // Actual Express middleware function
  return async (req, res, next) => {
    
    // Cache only GET requests
    if (req.method !== "GET") return next();

    // If a condition function exists and it returns false, skip caching
    if (condition && !condition(req)) return next();

    // Default identifier when user/session is not available
    let identifier = "anonymous";

    // Prefer authenticated user ID if available
    if (req.user?.id && includeUser) {
      identifier = `user:${req.user.id}`;
    }
    // Otherwise, fall back to session-based caching
    else if (includeSession) {
      const sessionId = await sessionService.getOrCreateSessionId(req, res);
      identifier = `session:${sessionId}`;
    }

    // Include query parameters in cache key if enabled
    const queryPart =
      includeQuery && Object.keys(req.query).length ? req.query : null;

    // Generate a unique cache key for this request
    const cacheKey = cacheKeys.route(
      keyPrefix,
      req.path,
      identifier,
      queryPart,
    );

    try {
      // Try to fetch data from cache
      const cached = await cacheManager.get(cacheKey);

      // If cache exists, return it immediately
      if (cached) {
        console.log(`CACHE HIT: ${cacheKey}`);

        // Helpful response headers for debugging
        res.set("X-Cache", "HIT");
        res.set("X-Cache-Key", cacheKey);
        res.set("X-Cache-TTL", ttl);

        return res.json(cached);
      }

      // Cache miss scenario
      console.log(`CACHE MISS: ${cacheKey}`);

      res.set("X-Cache", "MISS");
      res.set("X-Cache-Key", cacheKey);

      // Create a lock key to prevent multiple writes for same cache key
      const lockKey = cacheKeys.lock(cacheKey);

      // Acquire lock before proceeding
      const lock = await lockService.acquire(lockKey);

      // Store original res.json method
      const originalJson = res.json;

      // Override res.json to intercept response data
      res.json = async function (data) {
        // Cache only successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (lock) {
            // Save response to cache
            await cacheManager.set(cacheKey, data, ttl);

            // Release the lock after caching
            await lockService.release(lockKey);

            console.log(`CACHE SET: ${cacheKey} (${ttl}s)`);
          }
        }

        // Send response to client
        originalJson.call(this, data);
      };

      // Continue to controller
      next();
    } catch (err) {
      // Fail-safe: do not block request if cache fails
      console.error("Cache middleware error:", err.message);
      next();
    }
  };
};
