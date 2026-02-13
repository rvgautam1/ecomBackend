import redisClient from "../config/redis.js";

class CacheManager {
  async get(key) {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key, value, ttl) {
    const jitter = Math.floor(Math.random() * 30); // Prevent stampede
    await redisClient.setEx(key, ttl + jitter, JSON.stringify(value));
  }

  async del(key) {
    await redisClient.del(key);
  }

  async delByPattern(pattern) {
    const iterator = redisClient.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    });

    for await (const key of iterator) {
      await redisClient.del(key);
    }
  }

  async exists(key) {
    return await redisClient.exists(key);
  }
}

export default new CacheManager();
