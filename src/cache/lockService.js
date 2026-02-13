import redisClient from '../config/redis.js';

/**
 * Service responsible for distributed locking using Redis
 * Prevents multiple processes from performing the same critical operation
 */
class LockService {

 
  async acquire(key, ttl = 5) {
    return await redisClient.set(key, '1', {
      NX: true,   // Only set if key does not already exist
      EX: ttl    // Automatically expire lock after TTL seconds
    });
  }

  async release(key) {
    // Deletes the lock key to free the critical section
    await redisClient.del(key);
  }
}


export default new LockService();
