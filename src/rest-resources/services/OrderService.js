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
  // Create order from user's cart items
  // Handles multiple payment methods: COD, card, UPI, netbanking, wallet
  // Uses atomic transaction to ensure data consistency
  async createOrderFromCart(userId, orderData) {
    const { shipping_address, phone, payment_method = "cod" } = orderData;

    // Validate required shipping information
    if (!shipping_address || !phone) {
      throw CustomError.badRequest("Shipping address and phone are required");
    }

    // Validate payment method against allowed options
    const validMethods = ["cod", "card", "upi", "netbanking", "wallet"];
    if (!validMethods.includes(payment_method)) {
      throw CustomError.badRequest("Invalid payment method");
    }

    // Fetch all cart items with product details
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

    // Ensure cart is not empty before proceeding
    if (cartItems.length === 0) {
      throw CustomError.badRequest("Cart is empty");
    }

    // Check if sufficient stock is available for each product
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        throw CustomError.badRequest(
          `Insufficient stock for ${item.product.name}. Only ${item.product.stock} available`,
        );
      }
    }

    // Calculate total order amount from cart items
    let totalAmount = 0;
    cartItems.forEach((item) => {
      totalAmount += parseFloat(item.product.price) * item.quantity;
    });

    // Generate transaction ID and set payment status based on method
    let transactionId = null;
    let paymentStatus = "pending";

    if (payment_method === "cod") {
      paymentStatus = "pending"; // Payment collected on delivery
    } else {
      // Generate unique transaction ID for online payments
      transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      // In production: integrate with payment gateway API
      paymentStatus = "completed"; // Auto-complete for demo
    }

    // Start database transaction for atomicity
    const transaction = await sequelize.transaction();
    try {
      // For wallet payment: verify sufficient balance before proceeding
      if (payment_method == "wallet") {
        const walletBalance = await walletService.getWalletBalance(userId);
        if (walletBalance.available_balance < totalAmount) {
          throw CustomError.badRequest(
            `Insufficient wallet balance. Available: ${walletBalance.available_balance}, Required: ${totalAmount}`,
          );
        }
      }

      // Create order record with initial status
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

      // Create order items from cart (snapshot of products at order time)
      const orderItemsData = cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.product.price, // Lock price at order time
      }));
      await OrderItem.bulkCreate(orderItemsData, { transaction });

      // Reduce product stock for ordered items
      for (const item of cartItems) {
        await Product.decrement("stock", {
          by: item.quantity,
          where: { id: item.product_id },
          transaction,
        });
      }

      // Process wallet payment and create transaction record
      if (payment_method === "wallet") {
        await walletService.processOrderPayment(userId, order.id, totalAmount);
      }

      // Clear user's cart after successful order creation
      await Cart.destroy({ where: { user_id: userId }, transaction });

      // Commit all changes atomically
      await transaction.commit();

      // Send real-time notification to user about order placement
      sendToUser(userId, "order_placed", {
        message: `Order #${order.id} placed successfully`,
        orderId: order.id,
      });

      // Notify all admin users about new order
      sendToAdmins("new_order", {
        orderId: order.id,
        userId,
        amount: order.total_amount,
      });

      // Return complete order details with items
      return await this.getOrderById(order.id, userId);
    } catch (error) {
      // Rollback all changes on any failure
      await transaction.rollback();
      throw error;
    }
  }

  // Update payment status for an order (called by payment gateway webhooks)
  async updatePaymentStatus(orderId, paymentData) {
    const { payment_status, transaction_id } = paymentData;

    const order = await Order.findByPk(orderId);
    if (!order) {
      throw CustomError.notFound("Order not found");
    }

    // Validate payment status value
    const validStatuses = ["pending", "completed", "failed", "refunded"];
    if (!validStatuses.includes(payment_status)) {
      throw CustomError.badRequest("Invalid payment status");
    }

    // Update order payment details
    await order.update({
      payment_status,
      transaction_id: transaction_id || order.transaction_id,
    });

    // Notify user about payment status change
    sendToUser(order.user_id, "order_updated", {
      message: `Payment status updated to ${payment_status}`,
      orderId,
    });

    return order;
  }

  // Retrieve single order by ID
  // If userId is null (admin), fetch any order
  // If userId is provided, restrict to user's own orders
  async getOrderById(orderId, userId) {
    const where = { id: orderId };

    // Apply user restriction for non-admin requests
    if (userId !== null) {
      where.user_id = userId;
    }

    //eager load order items and product details in one query
    const order = await Order.findOne({
      where,
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

  // Get all orders for a specific user
  // Ordered by most recent first
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
      order: [["created_at", "DESC"]], // Most recent first
    });
  }

  // Cancel order by customer (only pending orders)
  // Restores product stock and processes refund if payment completed
  async cancelOrder(orderId, userId) {
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
    });

    if (!order) {
      throw CustomError.notFound("Order not found");
    }

    // Only pending orders can be cancelled by customers
    if (order.status !== "pending") {
      throw CustomError.badRequest("Only pending orders can be cancelled");
    }

    const transaction = await sequelize.transaction();
    try {
      // Fetch all items in the order
      const orderItems = await OrderItem.findAll({
        where: { order_id: orderId },
      });

      // Restore product stock for each cancelled item
      for (const item of orderItems) {
        await Product.increment("stock", {
          by: item.quantity,
          where: { id: item.product_id },
          transaction,
        });
      }

      // Process refund for completed wallet payments
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

      // Update order status and payment status
      await order.update(
        {
          status: "cancelled",
          payment_status:
            order.payment_status === "completed" ? "refunded" : "failed",
          cancelled_at: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      // Notify user about cancellation
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

  // Confirm order (Admin or Vendor operation)
  // Moves order from pending to confirmed state
  async confirmOrder(orderId, vendorId = null) {
    const order = await this.getOrderWithVendorCheck(orderId, vendorId);

    // Only pending or processing orders can be confirmed
    if (!["pending", "processing"].includes(order.status)) {
      throw CustomError.badRequest(
        "Only pending or processing orders can be confirmed",
      );
    }

    await order.update({
      status: "confirmed",
      confirmed_at: new Date(),
    });

    // Notify customer about order confirmation
    sendToUser(order.user_id, "order_updated", {
      orderId,
      message: `Order #${orderId} has been confirmed`,
    });

    return order;
  }

  // Process order (Admin or Vendor operation)
  // Moves order from confirmed to processing state
  async processOrder(orderId, vendorId = null) {
    const order = await this.getOrderWithVendorCheck(orderId, vendorId);

    // Only confirmed orders can be processed
    if (order.status !== "confirmed") {
      throw CustomError.badRequest("Only confirmed orders can be processed");
    }

    await order.update({
      status: "processing",
      processing_at: new Date(),
    });

    // Notify customer that order is being prepared
    sendToUser(order.user_id, "order_updated", {
      orderId,
      message: `Order #${orderId} is now being processed`,
    });

    return order;
  }

  // Ship order with tracking information (Admin or Vendor operation)
  async shipOrder(orderId, shippingData, vendorId = null) {
    const { tracking_number, shipping_carrier } = shippingData;
    const order = await this.getOrderWithVendorCheck(orderId, vendorId);

    // Only processing orders can be shipped
    if (order.status !== "processing") {
      throw CustomError.badRequest("Only processing orders can be shipped");
    }

    await order.update({
      status: "shipped",
      tracking_number,
      shipping_carrier,
      shipped_at: new Date(),
    });

    // Notify customer with tracking details
    sendToUser(order.user_id, "order_updated", {
      orderId,
      message: `Order #${orderId} has been shipped. Tracking: ${tracking_number}`,
      tracking_number,
      shipping_carrier,
    });

    return order;
  }

  // Mark order as delivered (Admin or Vendor operation)
  // Adds 5% cashback for wallet payments
  async deliverOrder(orderId, vendorId = null) {
    const order = await this.getOrderWithVendorCheck(orderId, vendorId);

    // Only shipped orders can be marked delivered
    if (order.status !== "shipped") {
      throw CustomError.badRequest("Only shipped orders can be delivered");
    }

    const transaction = await sequelize.transaction();
    try {
      await order.update(
        {
          status: "delivered",
          delivered_at: new Date(),
        },
        { transaction },
      );

      // Reward wallet users with 5% cashback on delivery
      if (order.payment_method === "wallet") {
        const cashback = parseFloat(order.total_amount) * 0.05; // 5% cashback
        await walletService.addCashBack(
          order.user_id,
          order.id,
          cashback,
          "5% cashback on order delivery",
        );
      }

      await transaction.commit();

      // Notify customer about successful delivery
      sendToUser(order.user_id, "order_updated", {
        orderId,
        message: `Order #${orderId} has been delivered`,
      });

      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Cancel order by Admin or Vendor
  // Restores stock and processes refunds
  async adminCancelOrder(orderId, vendorId = null) {
    const order = await this.getOrderWithVendorCheck(orderId, vendorId);

    // Check if order is in cancellable state
    if (!["pending", "confirmed", "processing"].includes(order.status)) {
      throw CustomError.badRequest(
        "Only pending, confirmed or processing orders can be cancelled",
      );
    }

    const transaction = await sequelize.transaction();
    try {
      // Restore product stock for all items in the order
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
          order.user_id,
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
          cancelled_at: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      // Notify customer about admin cancellation
      sendToUser(order.user_id, "order_updated", {
        orderId,
        message: `Order #${orderId} has been cancelled by admin/vendor`,
      });

      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Helper: Get order and verify vendor has products in it
  // If vendorId is null (admin), no permission check needed
  // If vendorId provided, ensure vendor owns at least one product in order
  async getOrderWithVendorCheck(orderId, vendorId = null) {
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "vendor_id"],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw CustomError.notFound("Order not found");
    }

    // If vendorId provided, verify vendor owns products in this order
    if (vendorId) {
      const vendorItems = order.items.filter(
        (item) => item.product.vendor_id === vendorId,
      );

      // Vendor must have at least one product in the order
      if (vendorItems.length === 0) {
        throw CustomError.forbidden(
          "You do not have permission to modify this order",
        );
      }
    }

    return order;
  }

  // Get all orders containing vendor's products
  // Supports filtering by status and date range
  async getVendorOrders(vendorId, filters = {}) {
    const { status, start_date, end_date } = filters;
    const where = {};

    // Apply status filter if provided
    if (status) where.status = status;

    // Apply date range filters if provided
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.$gte = new Date(start_date);
      if (end_date) where.created_at.$lte = new Date(end_date);
    }

    // Find all order IDs that contain this vendor's products
    const orderIds = await OrderItem.findAll({
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("order_id")), "order_id"],
      ],
      include: [
        {
          model: Product,
          as: "product",
          attributes: [],
          where: { vendor_id: vendorId },
        },
      ],
      raw: true,
    }).then((results) => results.map((r) => r.order_id));

    // Return empty array if vendor has no orders
    if (orderIds.length === 0) {
      return [];
    }

    // Fetch complete order details for vendor's orders
    return await Order.findAll({
      where: {
        id: { [sequelize.Op.in]: orderIds },
        ...where,
      },
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "price", "vendor_id"],
              where: { vendor_id: vendorId }, // Only vendor's products
            },
          ],
        },
        {
          model: User,
          attributes: ["id", "name", "email"], // Customer details
        },
      ],
      order: [["created_at", "DESC"]], // Most recent first
    });
  }

  // Generic method to update order status
  // Automatically sets appropriate timestamp based on status
  async updateOrderStatus(orderId, status, vendorId = null) {
    const order = await this.getOrderWithVendorCheck(orderId, vendorId);

    // Validate status value
    const validStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      throw CustomError.badRequest("Invalid order status");
    }

    const updateData = { status };

    // Set timestamp field based on new status
    switch (status) {
      case "confirmed":
        updateData.confirmed_at = new Date();
        break;
      case "processing":
        updateData.processing_at = new Date();
        break;
      case "shipped":
        updateData.shipped_at = new Date();
        break;
      case "delivered":
        updateData.delivered_at = new Date();
        break;
      case "cancelled":
        updateData.cancelled_at = new Date();
        break;
    }

    await order.update(updateData);

    // Notify customer about status change
    sendToUser(order.user_id, "order_updated", {
      orderId,
      message: `Order #${orderId} status updated to ${status}`,
    });

    return order;
  }
}

export default new OrderService();
