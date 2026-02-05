import {
  Order,
  OrderItem,
  Cart,
  Product,
  User,
} from "../../db/models/index.js";
import CustomError from "../../utils/customError.js";
import sequelize from "../../config/sequelize.js";
import walletService from "./walletService.js";
import { sendToUser, sendToAdmins } from "../../socket/socketServer.js";

class OrderService {
  // Create order from cart
  async createOrderFromCart(userId, orderData) {
    const { shipping_address, phone, payment_method = "cod" } = orderData;

    // Validation
    if (!shipping_address || !phone) {
      throw CustomError.badRequest("Shipping address and phone are required");
    }

    //  Validate payment method
    const validMethods = ["cod", "card", "upi", "netbanking", "wallet"];
    if (!validMethods.includes(payment_method)) {
      throw CustomError.badRequest("Invalid payment method");
    }

    // Get cart items with product details
    const cartItems = await Cart.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "price", "stock"],
        },
      ],
    });

    if (cartItems.length === 0) {
      throw CustomError.badRequest("Cart is empty");
    }

    // Check stock availability
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        throw CustomError.badRequest(
          `Insufficient stock for ${item.product.name}. Only ${item.product.stock} available`,
        );
      }
    }

    // Calculate total
    let totalAmount = 0;
    cartItems.forEach((item) => {
      totalAmount += parseFloat(item.product.price) * item.quantity;
    });

    //  Generate transaction_id if not COD
    let transactionId = null;
    let paymentStatus = "pending";

    if (payment_method === "cod") {
      paymentStatus = "pending"; // Pay on delivery
    } else {
      // Generate unique transaction ID
      transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      // For demo: auto-complete payment (in real app, call payment gateway)
      paymentStatus = "completed";
    }

    // Use transaction for atomicity
    const transaction = await sequelize.transaction();
    try {
      // if payment method is wallet , process payment first
      if (payment_method == "wallet") {
        const walletBalence = await walletService.getWalletBalance(userId);
        if (walletBalence.available_balance < totalAmount) {
          throw CustomError.badRequest(
            `Insufficient wallet balance . Awailable : ${walletBalence.available_balance}, Required : ${totalAmount}`,
          );
        }
      }

      // Create order
      const order = await Order.create(
        {
          user_id: userId,
          total_amount: totalAmount,
          shipping_address,
          phone,
          status: "pending",
          payment_method,
          payment_status: payment_method === "wallet" ? "completed" : "pending",
          transaction_id:
            payment_method === "wallet" ? `WALLET${Date.now()}` : null,
        },
        { transaction },
      );

     

      // Create order items
      const orderItemsData = cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.product.price,
      }));
      await OrderItem.bulkCreate(orderItemsData, { transaction });

      // Reduce product stock
      for (const item of cartItems) {
        await Product.decrement("stock", {
          by: item.quantity,
          where: { id: item.product_id },
          transaction,
        });
      }

      // process wallet payment
      if (payment_method === "wallet") {
        await walletService.processOrderPayment(userId, order.id, totalAmount);
      }

      // Clear cart
      await Cart.destroy({ where: { user_id: userId }, transaction });

      await transaction.commit();

      sendToUser(userId, "order_placed", {
        message: `Order #${order.id} placed successfully`,
      });

      sendToAdmins("new_order", {
        orderId: order.id,
        userId,
        amount: order.total_amount,
      });
      // Return order with items
      return await this.getOrderById(order.id, userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  //  Update payment status
  async updatePaymentStatus(orderId, paymentData) {
    const { payment_status, transaction_id } = paymentData;

    const order = await Order.findByPk(orderId);
    if (!order) {
      throw CustomError.notFound("Order not found");
    }

    const validStatuses = ["pending", "completed", "failed", "refunded"];
    if (!validStatuses.includes(payment_status)) {
      throw CustomError.badRequest("Invalid payment status");
    }

    await order.update({
      payment_status,
      transaction_id: transaction_id || order.transaction_id,
    });
   
    // payment status notifucation
sendToUser(order.user_id, "order_updated", {
      message: `Payment status updated to ${payment_status}`,
    });

    return order;
  }

  // Get order by ID
  async getOrderById(orderId, userId) {
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "price"],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw CustomError.notFound("Order not found");
    }

    return order;
  }

  // Get all user orders
  async getUserOrders(userId) {
    return await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "price"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });
  }

  // Cancel order
  async cancelOrder(orderId, userId) {
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
    });

    if (!order) {
      throw CustomError.notFound("Order not found");
    }

    if (order.status !== "pending") {
      throw CustomError.badRequest("Only pending orders can be cancelled");
    }

    const transaction = await sequelize.transaction();
    try {
      const orderItems = await OrderItem.findAll({
        where: { order_id: orderId },
      });

      for (const item of orderItems) {
        await Product.increment("stock", {
          by: item.quantity,
          where: { id: item.product_id },
          transaction,
        });
      }

      // Process refund if payment was completed
      if (
        order.payment_status === "completed" &&
        order.payment_method === "wallet"
      ) {
        await walletService.refundToWallet(
          userId,
          orderId,
          parseFloat(order.total_amount),
          `Refund for cancelled order #${orderId}`,
        );
      }

      await order.update(
        {
          status: "cancelled",
          payment_status:
            order.payment_status === "completed" ? "refunded" : "failed",
        },
        { transaction },
      );

      await transaction.commit();

      // notification to user
      sendToUser(userId, "order_updated", {
        orderId,
        message: `Order #${orderId} has been cancelled`,
      });
      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default new OrderService();
