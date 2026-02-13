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

// Foundation middleware
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

// Authentication middleware (sets req.user if authenticated)
app.use(authenticateOptional);

/**
 *  Guest Session Middleware
 * This creates a session for guest users and attaches it to req
 * Must come after authenticateOptional but before routes
 */
app.use(async (req, res, next) => {
  try {
    // If user is not authenticated, create/get guest session
    if (!req.user) {
      req.sessionId = await sessionService.getOrCreateSessionId(req, res);
      req.isGuest = true;
    } else {
      // For authenticated users, we still might have a session from before login
      // This will be used for cart merging
      req.sessionId = req.cookies?.sessionId || req.headers["x-session-id"];
      req.isGuest = false;
    }
    next();
  } catch (error) {
    console.error("Session middleware error:", error);
    // Continue even if session creation fails
    req.isGuest = true;
    next();
  }
});

// Routes with caching configuration
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

// Cart routes - NO CACHING for cart operations (real-time data)
app.use("/api/cart", cartRoutes);

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

// Auth routes - no caching
app.use("/api/auth", authRoutes);

// Session debug endpoint
app.get("/api/session", async (req, res) => {
  const sessionId = req.sessionId || req.cookies?.sessionId;

  if (req.user) {
    return res.json({
      isGuest: false,
      userId: req.user.id,
      role: req.user.role,
      sessionId: sessionId || null,
    });
  }

  const sessionInfo = sessionId
    ? await sessionService.getSessionInfo(sessionId)
    : null;

  res.json({
    isGuest: true,
    sessionId,
    sessionInfo,
    cartExists: sessionId
      ? (await sessionService.getData(sessionId, "cart", "items")) !== null
      : false,
  });
});

initSocket(httpServer);

// Redis connection
const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    console.log("Redis connected");

    const sessionCount = await sessionService.getActiveSessionCount();
    console.log(`Active sessions: ${sessionCount}`);
  } catch (err) {
    console.error(" Redis connection failed:", err.message);
    if (process.env.RUNNING_IN_DOCKER === "true") {
      setTimeout(connectRedis, 5000);
    }
  }
};
connectRedis();

// Database connection
const testDatabaseConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();

    res.json({
      status: "healthy",
      environment: process.env.NODE_ENV,
      database: "connected",
      redis: redisClient.isOpen ? "connected" : "disconnected",
      caching: "enabled",
      guestSessions: "enabled",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// Error handler - MUST be last
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await testDatabaseConnection();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Session debug: http://localhost:${PORT}/api/session`);
      console.log(`  Guest cart: Enabled`);
    });
  } catch (error) {
    console.error("❌ Startup failed:", error);
    process.exit(1);
  }
};

startServer();
