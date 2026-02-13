import crypto from 'crypto';
import redisClient from '../config/redis.js';

class SessionService {
  // ============ CORE SESSION MANAGEMENT ============
  
  generateSessionId() {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `sess_${timestamp}_${randomString}`;
  }

  getOrCreateSessionId(req, res) {
    let sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    
    if (!sessionId) {
      sessionId = this.generateSessionId();
      console.log(`🆕 New session: ${sessionId}`);
      
      this.trackSession(sessionId, req);
      
      res.cookie('sessionId', sessionId, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
    } else {
      this.refreshSession(sessionId);
    }
    
    req.sessionId = sessionId;
    return sessionId;
  }

  async trackSession(sessionId, req) {
    try {
      const sessionKey = `session:${sessionId}:meta`;
      const sessionData = {
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        referer: req.headers['referer'] || req.headers['referrer']
      };
      
      await redisClient.setEx(sessionKey, 7 * 24 * 60 * 60, JSON.stringify(sessionData));
    } catch (err) {
      console.error(`Session tracking error: ${err.message}`);
    }
  }

  async refreshSession(sessionId) {
    try {
      const sessionKey = `session:${sessionId}:meta`;
      await redisClient.expire(sessionKey, 7 * 24 * 60 * 60);
      
      const sessionData = await redisClient.get(sessionKey);
      if (sessionData) {
        const data = JSON.parse(sessionData);
        data.lastActive = new Date().toISOString();
        await redisClient.setEx(sessionKey, 7 * 24 * 60 * 60, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`Session refresh error: ${err.message}`);
    }
  }

  // ============ GENERIC DATA STORAGE - FOR ANY SERVICE ============
  
  /**
   * Store ANY data for a session
   * @param {string} sessionId - Session ID
   * @param {string} namespace - Service name (cart, wishlist, orders, etc.)
   * @param {string} key - Unique key within namespace
   * @param {any} data - Data to store
   * @param {number} ttl - Time to live in seconds (default: 7 days)
   */
  async setData(sessionId, namespace, key, data, ttl = 7 * 24 * 60 * 60) {
    try {
      const redisKey = `session:${sessionId}:${namespace}:${key}`;
      await redisClient.setEx(redisKey, ttl, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error(`Session set error: ${err.message}`);
      return false;
    }
  }

  /**
   * Get ANY data for a session
   */
  async getData(sessionId, namespace, key) {
    try {
      const redisKey = `session:${sessionId}:${namespace}:${key}`;
      const data = await redisClient.get(redisKey);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`Session get error: ${err.message}`);
      return null;
    }
  }

  /**
   * Delete specific session data
   */
  async deleteData(sessionId, namespace, key) {
    try {
      const redisKey = `session:${sessionId}:${namespace}:${key}`;
      await redisClient.del(redisKey);
      return true;
    } catch (err) {
      console.error(`Session delete error: ${err.message}`);
      return false;
    }
  }

  /**
   * Get ALL data for a namespace (entire cart, wishlist, etc.)
   */
  async getNamespace(sessionId, namespace) {
    try {
      const pattern = `session:${sessionId}:${namespace}:*`;
      const keys = await redisClient.keys(pattern);
      
      const result = {};
      for (const key of keys) {
        const keyParts = key.split(':');
        const itemKey = keyParts[keyParts.length - 1];
        const data = await redisClient.get(key);
        result[itemKey] = JSON.parse(data);
      }
      
      return result;
    } catch (err) {
      console.error(`Session namespace error: ${err.message}`);
      return {};
    }
  }

  /**
   * Clear ENTIRE namespace for a session
   */
  async clearNamespace(sessionId, namespace) {
    try {
      const pattern = `session:${sessionId}:${namespace}:*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(keys);
        return keys.length;
      }
      return 0;
    } catch (err) {
      console.error(`Session clear namespace error: ${err.message}`);
      return 0;
    }
  }

  /**
   * Increment/Decrement a counter
   */
  async incrementCounter(sessionId, namespace, counter, amount = 1) {
    try {
      const redisKey = `session:${sessionId}:${namespace}:counters:${counter}`;
      const newValue = await redisClient.incrBy(redisKey, amount);
      await redisClient.expire(redisKey, 7 * 24 * 60 * 60);
      return newValue;
    } catch (err) {
      console.error(`Session increment error: ${err.message}`);
      return null;
    }
  }

  /**
   * Get counter value
   */
  async getCounter(sessionId, namespace, counter) {
    try {
      const redisKey = `session:${sessionId}:${namespace}:counters:${counter}`;
      const value = await redisClient.get(redisKey);
      return value ? parseInt(value) : 0;
    } catch (err) {
      console.error(`Session get counter error: ${err.message}`);
      return 0;
    }
  }

  // ============ BULK OPERATIONS ============

  /**
   * Store multiple items in one operation
   */
  async setBulkData(sessionId, namespace, items, ttl = 7 * 24 * 60 * 60) {
    try {
      const pipeline = redisClient.multi();
      
      for (const [key, value] of Object.entries(items)) {
        const redisKey = `session:${sessionId}:${namespace}:${key}`;
        pipeline.setEx(redisKey, ttl, JSON.stringify(value));
      }
      
      await pipeline.exec();
      return Object.keys(items).length;
    } catch (err) {
      console.error(`Session bulk set error: ${err.message}`);
      return 0;
    }
  }

  /**
   * Get multiple items in one operation
   */
  async getBulkData(sessionId, namespace, keys) {
    try {
      const pipeline = redisClient.multi();
      
      for (const key of keys) {
        const redisKey = `session:${sessionId}:${namespace}:${key}`;
        pipeline.get(redisKey);
      }
      
      const results = await pipeline.exec();
      const data = {};
      
      results.forEach((result, index) => {
        if (result[1]) {
          data[keys[index]] = JSON.parse(result[1]);
        }
      });
      
      return data;
    } catch (err) {
      console.error(`Session bulk get error: ${err.message}`);
      return {};
    }
  }

  // ============ SESSION CLEANUP ============

  /**
   * Clear ALL session data - NO service-specific code!
   */
  async clearSession(res, sessionId = null) {
    try {
      const sid = sessionId || res.req?.cookies?.sessionId || res.req?.headers['x-session-id'];
      
      if (sid) {
        const pattern = `session:${sid}:*`;
        const keys = await redisClient.keys(pattern);
        
        if (keys.length > 0) {
          await redisClient.del(keys);
          console.log(`🗑️ Cleared ${keys.length} keys for session ${sid}`);
        }
      }
    } catch (err) {
      console.error(`Session clear error: ${err.message}`);
    }
    
    res.clearCookie('sessionId', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
  }

  // ============ SESSION METADATA ============

  async getSessionInfo(sessionId) {
    try {
      const sessionKey = `session:${sessionId}:meta`;
      const data = await redisClient.get(sessionKey);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`Get session info error: ${err.message}`);
      return null;
    }
  }

  async isValidSession(sessionId) {
    try {
      const sessionKey = `session:${sessionId}:meta`;
      const exists = await redisClient.exists(sessionKey);
      return exists === 1;
    } catch (err) {
      return false;
    }
  }

  async getActiveSessionCount() {
    try {
      const keys = await redisClient.keys('session:*:meta');
      return keys.length;
    } catch (err) {
      console.error(`Get session count error: ${err.message}`);
      return 0;
    }
  }
}

export default new SessionService();