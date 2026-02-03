import express, { Router } from 'express'
import {
   createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  updatePaymentStatus
} from '../rest-resources/controllers/orderController.js'
import { authenticateUser } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateUser);

router.post('/' , createOrder);

router.get('/' , getUserOrders);
router.get("/:orderId" , getOrderById)
router.put("/:orderId/cancel", cancelOrder)

router.put('/:orderId/payment' , updatePaymentStatus)

export default router ;