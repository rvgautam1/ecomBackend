import express from "express";
import {
  addToCart,
  removeFromCart,
  getCart,
  updateCartItem,
  clearCart,
  mergeGuestCart,
  getCartCount,
} from "../rest-resources/controllers/cartControllers.js";
import { authenticateUser } from "../middleware/auth.js";

const router = express.Router();

// Public routes (with optional auth)
router.post("/", addToCart); // Works for both guest and authenticated
router.get("/", getCart); // Works for both guest and authenticated
router.get("/count", getCartCount); // Cart count for navbar
router.put("/:id", updateCartItem); // Works for both
router.delete("/:id", removeFromCart); // Works for both
router.post("/clear", clearCart); // Works for both

// Protected routes (require authentication)
router.post("/merge", authenticateUser, mergeGuestCart); // Merge guest cart after login

export default router;
