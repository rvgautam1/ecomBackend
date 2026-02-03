import express from "express";
import {
  addToCart,
  removeFromCart,
  getCart,
  updateCartItem,
  clearCart
} from "../rest-resources/controllers/cartControllers.js";
import { authenticateUser } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateUser);

router.post("/", addToCart);
router.get("/", getCart);
router.put("/:id", updateCartItem);
router.delete("/:id", removeFromCart);
router.post("/clear", clearCart);

export default router;
