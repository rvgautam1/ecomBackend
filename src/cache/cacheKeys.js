export const cacheKeys = {
  route: (prefix, path, identifier, query = null) => {
    const base = `${prefix}:${path}:${identifier}`;
    return query ? `${base}:${JSON.stringify(query)}` : base;
  },

  userFeature: (userId, feature) => `user:${userId}:${feature}`,

  sessionFeature: (sessionId, feature) => `session:${sessionId}:${feature}`,

  lock: (key) => `lock:${key}`, // distributed locking
};
