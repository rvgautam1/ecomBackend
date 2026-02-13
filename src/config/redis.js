import { createClient } from "redis";

const redisUrl =
  process.env.REDIS_URL ||
  (process.env.RUNNING_IN_DOCKER === "true"
    ? "redis://redis:6379"
    : "redis://localhost:6379");

const redisClient = createClient({
  url: redisUrl,
  socket: {
    family: 4,
    connectTimeout: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 3) return new Error("Max retries reached");
      return Math.min(retries * 200, 2000);
    },
  },
});

redisClient.on("connect", () => {
  console.log("Redis connected ", redisUrl);
});

redisClient.on("ready", () => {
  console.log("Redis ready");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err.message);
});

export default redisClient;
