import cacheManager from './cacheManager.js';

/**
 * Service responsible for cache invalidation
 * Used when data changes and cached responses must be cleared
 */
class InvalidationService {

  /**
   * Invalidate all cached responses for a specific route
   * Useful when route-level data changes (e.g., product list updates)
   */
  async invalidateRoute(path) {
    // Deletes all cache entries matching the route path
    await cacheManager.delByPattern(`cache:${path}:*`);
  }

  /**
   * Invalidate all cached responses related to a specific user
   * Useful after profile updates, permission changes, etc.
   */
  async invalidateUser(userId) {
    // Deletes all cache entries that include this user identifier
    await cacheManager.delByPattern(`cache:*:user:${userId}*`);
  }

  /**
   * Invalidate all cached responses related to a specific session
   * Useful when session-scoped data changes or session expires
   */
  async invalidateSession(sessionId) {
    // Deletes all cache entries that include this session identifier
    await cacheManager.delByPattern(`cache:*:session:${sessionId}*`);
  }

  /**
   * Invalidate cache using a custom pattern
   * Provides flexibility for advanced or bulk invalidation use cases
   */
  async invalidateCustom(pattern) {
    // Deletes all cache entries matching the provided pattern
    await cacheManager.delByPattern(pattern);
  }
}

// Export a single shared instance of the invalidation service
export default new InvalidationService();
