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
  if (!key) return;
  await redisClient.del(key);
}



async delByPattern(pattern) {
  const iterator = redisClient.scanIterator({
    MATCH: pattern,
    COUNT: 100,
  });

  let keysToDelete = [];

  for await (const keys of iterator) {
    if (!keys) continue;

    if (Array.isArray(keys)) {
      keysToDelete.push(...keys);
    } else {
      keysToDelete.push(keys);
    }
  }

  if (keysToDelete.length) {
    await redisClient.del(keysToDelete);
  }
}



  async exists(key) {
    return await redisClient.exists(key);
  }
}

export default new CacheManager();
