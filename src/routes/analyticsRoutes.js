import express from "express";
import {
  getSalesSummary,
  getTopProducts,
  getDailySales,
  getTotalSales,
  getSalesByPayment,
} from "../rest-resources/controllers/analyticsController.js";
import { authenticateUser } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  salesSummarySchema,
  topProductsSchema,
  dailySalesSchema,
  paymentMethodsSchema,
} from "../schema/analyticsSchemas.js";

const router = express.Router();

router.use(authenticateUser);

router.get("/sales/summary", validate(salesSummarySchema), getSalesSummary);
router.get(
  "/products/top-selling",
  validate(topProductsSchema),
  getTopProducts,
);
router.get("/sales/daily", validate(dailySalesSchema), getDailySales);
router.get("/sales/total", getTotalSales);
router.get(
  "/sales/payment-methods",
  validate(paymentMethodsSchema),
  getSalesByPayment,
);

export default router;
