import express, { Router } from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  updatePaymentStatus,
  // Vendor routes
  getVendorOrders,
  confirmOrder,
  processOrder,
  shipOrder,
  deliverOrder,
  vendorCancelOrder,
  updateOrderStatus,
  
} from "../rest-resources/controllers/orderController.js";
import {
  authenticateUser,
  isVendor,
  isAdmin,
  isUser,
} from "../middleware/auth.js";

const router = express.Router();

// user 
router.post("/", authenticateUser, isUser, createOrder);
router.get("/", authenticateUser, isUser, getUserOrders);
router.get("/:orderId", authenticateUser, isUser, getOrderById);
router.put("/:orderId/cancel", authenticateUser, isUser, cancelOrder);
router.put("/:orderId/payment", authenticateUser, isUser, updatePaymentStatus);

// vendor routes 
router.get("/vendor/orders", authenticateUser, isVendor, getVendorOrders);
router.put(
  "/vendor/:orderId/confirm",
  authenticateUser,
  isVendor,
  confirmOrder,
);
router.put(
  "/vendor/:orderId/process",
  authenticateUser,
  isVendor,
  processOrder,
);
router.put("/vendor/:orderId/ship", authenticateUser, isVendor, shipOrder);
router.put(
  "/vendor/:orderId/deliver",
  authenticateUser,
  isVendor,
  deliverOrder,
);
router.put(
  "/vendor/:orderId/cancel",
  authenticateUser,
  isVendor,
  vendorCancelOrder,
);
router.put(
  "/vendor/:orderId/status",
  authenticateUser,
  isVendor,
  updateOrderStatus,
);

export default router;
