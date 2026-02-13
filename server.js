import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

// Infrastructure
import sequelize from "./src/config/sequelize.js";
import redisClient from "./src/config/redis.js";

// Middleware
import errorHandler from "./src/middleware/errorHandler.js";
import { authenticateOptional } from "./src/middleware/authOptional.js";
import { cacheMiddleware } from "./src/cache/cacheMiddleware.js";

// Session
import sessionService from "./src/utils/sessionService.js";

// Sockets
import { initSocket } from "./src/socket/socketServer.js";

// Routes
import authRoutes from "./src/routes/authRoutes.js";
import vendorRoutes from "./src/routes/vendorRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import wishlistRoutes from "./src/routes/wishlistRoutes.js";
import cartRoutes from "./src/routes/cartRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import walletRoutes from "./src/routes/walletRoutes.js";
import giftCardRoutes from "./src/routes/giftCardRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

//foundation middleware

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cookieParser());

//authentication

app.use(authenticateOptional);

// session guest only

app.use(async (req, res, next) => {
  if (!req.user) {
    req.sessionId = await sessionService.getOrCreateSessionId(req, res);
    req.isGuest = true;
  } else {
    req.isGuest = false;
  }
  next();
});

app.use(
  "/api/categories",
  cacheMiddleware({
    ttl: 3600,
    keyPrefix: "public",
    includeUser: false,
    includeSession: false,
  }),
  categoryRoutes,
);

/* Vendor listing */
app.use(
  "/api/vendor",
  cacheMiddleware({
    ttl: 300,
    keyPrefix: "vendor",
    includeUser: false,
    includeSession: false,
  }),
  vendorRoutes,
);

/* Cart - user/session aware */
app.use(
  "/api/cart",
  cacheMiddleware({
    ttl: 300,
    keyPrefix: "cart",
    includeUser: true,
    includeSession: true,
  }),
  cartRoutes,
);

/* Wishlist */
app.use(
  "/api/wishlist",
  cacheMiddleware({
    ttl: 300,
    keyPrefix: "wishlist",
    includeUser: true,
    includeSession: true,
  }),
  wishlistRoutes,
);

/* Orders */
app.use(
  "/api/orders",
  cacheMiddleware({
    ttl: 120,
    keyPrefix: "orders",
    includeUser: true,
    includeSession: false,
  }),
  orderRoutes,
);

/* Reviews */
app.use(
  "/api/reviews",
  cacheMiddleware({
    ttl: 300,
    keyPrefix: "reviews",
    includeUser: false,
    includeSession: false,
  }),
  reviewRoutes,
);

/* Analytics - very short cache */
app.use(
  "/api/analytics",
  cacheMiddleware({
    ttl: 30,
    keyPrefix: "analytics",
    includeUser: true,
    includeSession: false,
  }),
  analyticsRoutes,
);

/* Wallet - short private cache */
app.use(
  "/api/wallet",
  cacheMiddleware({
    ttl: 60,
    keyPrefix: "wallet",
    includeUser: true,
    includeSession: false,
  }),
  walletRoutes,
);

/* Gift Cards */
app.use(
  "/api/gift-cards",
  cacheMiddleware({
    ttl: 300,
    keyPrefix: "giftcards",
    includeUser: true,
    includeSession: false,
  }),
  giftCardRoutes,
);

/* Auth routes - no caching */
app.use("/api/auth", authRoutes);


app.get("/api/session", async (req, res) => {
  const sessionId = req.sessionId || req.cookies?.sessionId;

  if (req.user) {
    return res.json({
      isGuest: false,
      userId: req.user.id,
      role: req.user.role,
    });
  }

  const sessionInfo = sessionId
    ? await sessionService.getSessionInfo(sessionId)
    : null;

  res.json({
    isGuest: true,
    sessionId,
    sessionInfo,
  });
});



initSocket(httpServer);



const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    console.log("Redis connected");

    const sessionCount = await sessionService.getActiveSessionCount();
    console.log(`Active sessions: ${sessionCount}`);
  } catch (err) {
    console.error("Redis connection failed:", err.message);
    if (process.env.RUNNING_IN_DOCKER === "true") {
      setTimeout(connectRedis, 5000);
    }
  }
};
connectRedis();

const testDatabaseConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};


app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();

    res.json({
      status: "healthy",
      environment: process.env.NODE_ENV,
      database: "connected",
      redis: redisClient.isOpen ? "connected" : "disconnected",
      caching: "enabled",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});



app.use(errorHandler);



const startServer = async () => {
  try {
    await testDatabaseConnection();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Session debug: http://localhost:${PORT}/api/session`);
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
};

startServer();
