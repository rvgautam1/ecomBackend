import redisClient from '../config/redis.js';
import sessionService from '../utils/sessionService.js';

/**
 * UNIVERSAL CACHE MIDDLEWARE
 * Works across ALL routes and controllers with intelligent user/session awareness
 * Automatically handles authenticated users, guest sessions, and public data
 */
export const cacheMiddleware = (options = {}) => {
  const {
    ttl = 300,                    // Default cache duration: 5 minutes
    keyPrefix = 'cache',          // Customizable cache key prefix
    excludeParams = ['password', 'token', 'credit_card'], // Sensitive data exclusion
    includeUser = true,           // Include user ID in cache key for personalization
    includeSession = true,        // Include session ID for guest users
    includeQuery = true,          // Cache different results for different query params
    includeBody = false,          // Never cache request bodies (POST/PUT data)
    condition = null              // Custom caching logic (optional)
  } = options;

  return async (req, res, next) => {
    // Step 1: Early exit conditions - skip caching entirely when appropriate
    if (req.method !== 'GET') {
      return next();  // Only cache GET requests
    }

    if (condition && !condition(req)) {
      return next();  // Respect custom skip conditions
    }

    if (!redisClient?.isOpen) {
      return next();  // Graceful degradation if Redis unavailable
    }

    // Step 2: Determine cache identifier (user or session based)
    let identifier = 'anonymous';
    
    if (req.user?.id) {
      // Authenticated user gets personalized cache
      identifier = `user:${req.user.id}`;
    } else if (includeSession) {
      // Guest users get session-specific cache
      const sessionId = sessionService.getOrCreateSessionId(req, res);
      identifier = `session:${sessionId}`;
    }

    // Step 3: Build unique cache key from multiple components
    const keyParts = [keyPrefix, req.originalUrl.split('?')[0]];

    if (includeUser || includeSession) {
      keyParts.push(identifier);  // Personalization segment
    }

    if (includeQuery && req.query && Object.keys(req.query).length > 0) {
      // Filter out sensitive query parameters before caching
      const filteredQuery = { ...req.query };
      excludeParams.forEach(param => delete filteredQuery[param]);
      keyParts.push(JSON.stringify(filteredQuery));
    }

    const cacheKey = keyParts.join(':').replace(/\s+/g, '_');

    // Step 4: Cache lookup - respond immediately if hit
    try {
      const cachedResponse = await redisClient.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`CACHE HIT: ${cacheKey}`);
        
        // Debug headers for monitoring
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-TTL', ttl);
        res.set('X-Identifier', identifier);
        
        return res.json(JSON.parse(cachedResponse));
      }
    } catch (err) {
      console.error(`Cache read error: ${err.message}`);
    }

    console.log(`CACHE MISS: ${cacheKey}`);
    res.set('X-Cache', 'MISS');
    res.set('X-Cache-Key', cacheKey);
    res.set('X-Identifier', identifier);

    // Step 5: Intercept response to cache successful results
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Only cache meaningful successful responses
        if (data && Object.keys(data).length > 0 && !data.error) {
          try {
            // Fire-and-forget cache write (non-blocking)
            redisClient.setEx(cacheKey, ttl, JSON.stringify(data))
              .catch(err => console.error(`Cache write error: ${err.message}`));
            
            console.log(`CACHE SET: ${cacheKey} (${ttl}s)`);
          } catch (err) {
            console.error(`Cache write error: ${err.message}`);
          }
        }
      }
      
      originalJson.call(this, data);
    };

    next();
  };
};

/**
 * CACHE INVALIDATION MIDDLEWARE
 * Smart pattern-based cache clearing after mutations
 * Handles both user-specific and public cache invalidation
 */
export const invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = async function(data) {
      // Only invalidate cache on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        
        if (mutationMethods.includes(req.method)) {
          try {
            const cachePatterns = [];
            
            // Determine scope of invalidation (user, session, or global)
            let identifier = '*';
            if (req.user?.id) {
              identifier = `*user:${req.user.id}*`;
            } else {
              const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
              if (sessionId) {
                identifier = `*session:${sessionId}*`;
              }
            }
            
            // Add any custom patterns provided
            patterns.forEach(pattern => {
              if (typeof pattern === 'function') {
                cachePatterns.push(pattern(req));
              } else {
                cachePatterns.push(pattern);
              }
            });
            
            // Auto-generate common invalidation patterns
            const baseUrl = req.originalUrl.split('?')[0];
            
            // Pattern 1: Invalidate list views
            cachePatterns.push(`cache:${baseUrl}:${identifier}`);
            cachePatterns.push(`cache:${baseUrl}:${identifier}:*`);
            
            // Pattern 2: Invalidate detail views for resource updates
            if (req.params.id) {
              const resourcePath = baseUrl.replace(/\/\d+$/, '');
              cachePatterns.push(`cache:${resourcePath}/${req.params.id}:${identifier}`);
              cachePatterns.push(`cache:${resourcePath}:${identifier}`);
              cachePatterns.push(`cache:${resourcePath}:${identifier}:*`);
            }
            
            // Pattern 3: Invalidate public/anonymous cache too
            if (!req.user?.id) {
              cachePatterns.push(`cache:${baseUrl}:*anonymous*`);
              cachePatterns.push(`cache:${baseUrl}:*anonymous*:*`);
            }
            
            // Execute bulk invalidation
            for (const pattern of cachePatterns) {
              const keys = await redisClient.keys(pattern);
              if (keys.length > 0) {
                await redisClient.del(keys);
                console.log(`Cache invalidated: ${keys.length} keys for pattern ${pattern}`);
              }
            }
          } catch (err) {
            console.error(`Cache invalidation error: ${err.message}`);
          }
        }
      }
      
      originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * AUTO-CACHE - Intelligent defaults based on route patterns
 * Automatically applies optimal caching strategy per endpoint type
 */
export const autoCache = () => {
  return (req, res, next) => {
    const path = req.path;
    let cacheOptions = {};
    
    // Strategy 1: Static public data (long cache life)
    if (path.includes('/categories') || 
        path.includes('/products/public')) {
      cacheOptions = {
        ttl: 3600,        // 1 hour
        includeUser: false,
        includeSession: false,
        keyPrefix: 'public'
      };
    }
    
    // Strategy 2: Personalized user data (medium cache)
    else if (path.includes('/cart') || 
             path.includes('/wishlist') || 
             path.includes('/orders') ||
             path.includes('/profile') ||
             path.includes('/addresses') ||
             path.includes('/payment-methods')) {
      cacheOptions = {
        ttl: 300,         // 5 minutes
        includeUser: true,
        includeSession: true,  // Critical for guest carts
        keyPrefix: 'user'
      };
    }
    
    // Strategy 3: Guest checkout flows
    else if (path.includes('/guest') || 
             path.includes('/session') ||
             path.includes('/checkout/guest')) {
      cacheOptions = {
        ttl: 300,
        includeUser: false,
        includeSession: true,
        keyPrefix: 'guest'
      };
    }
    
    // Strategy 4: Admin dashboards (short cache)
    else if (path.includes('/admin') || 
             path.includes('/dashboard')) {
      cacheOptions = {
        ttl: 60,          // 1 minute
        includeUser: true,
        includeSession: false,
        keyPrefix: 'admin'
      };
    }
    
    // Strategy 5: Analytics (very short cache)
    else if (path.includes('/analytics') || 
             path.includes('/reports') ||
             path.includes('/stats')) {
      cacheOptions = {
        ttl: 30,          // 30 seconds
        includeUser: true,
        includeSession: false,
        keyPrefix: 'analytics'
      };
    }
    
    // Strategy 6: Search results (query-dependent)
    else if (path.includes('/search') || 
             path.includes('/filter') ||
             path.includes('/explore')) {
      cacheOptions = {
        ttl: 120,         // 2 minutes
        includeUser: false,
        includeSession: false,
        includeQuery: true,
        keyPrefix: 'search'
      };
    }
    
    // Strategy 7: API docs (long cache)
    else if (path.includes('/api-docs') || 
             path.includes('/swagger') ||
             path.includes('/docs')) {
      cacheOptions = {
        ttl: 86400,       // 1 day
        includeUser: false,
        includeSession: false,
        keyPrefix: 'docs'
      };
    }
    
    // Strategy 8: Conservative default
    else {
      cacheOptions = {
        ttl: 120,
        includeUser: true,
        includeSession: true,
        keyPrefix: 'cache'
      };
    }
    
    // Apply detected strategy
    return cacheMiddleware(cacheOptions)(req, res, next);
  };
};

/**
 * SESSION CACHE HELPER
 * Manual caching utility for controllers needing explicit session-aware caching
 */
export const cacheWithSession = async (req, res, data, ttl = 300) => {
  try {
    const sessionId = sessionService.getOrCreateSessionId(req, res);
    const cacheKey = `session:${sessionId}:${req.originalUrl}`;
    
    await redisClient.setEx(cacheKey, ttl, JSON.stringify(data));
    console.log(`Session cache set: ${cacheKey}`);
    
    return true;
  } catch (err) {
    console.error(`Session cache error: ${err.message}`);
    return false;
  }
};

/**
 * CLEAR SESSION CACHE
 * Bulk cleanup for all session-related cache when user logs in
 */
export const clearSessionCache = async (req, res) => {
  try {
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    
    if (sessionId) {
      const pattern = `*session:${sessionId}*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Cleared ${keys.length} cache keys for session ${sessionId}`);
      }
      
      sessionService.clearSession(res);
    }
  } catch (err) {
    console.error(`Clear session cache error: ${err.message}`);
  }
};
