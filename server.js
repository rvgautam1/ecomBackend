import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import sequelize from "./src/config/sequelize.js";
import errorHandler from "./src/middleware/errorHandler.js";

import authRoutes from "./src/routes/authRoutes.js";
import vendorRoutes from "./src/routes/vendorRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import wishlistRoutes from "./src/routes/wishlistRoutes.js";
import cartRoutes from "./src/routes/cartRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";

import analyticsRoutes from "./src/routes/analyticsRoutes.js"

import walletRoutes from "./src/routes/walletRoutes.js"
import giftCardRoutes from "./src/routes/giftCardRoutes.js"

// Load env variables
dotenv.config();

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/gift-cards', giftCardRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("E-commerce API is up and running 🚀");
});

// Error handle
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server failed to start");
    console.error(error);
  }
};

startServer();
