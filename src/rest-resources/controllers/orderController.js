import orderService from "../services/OrderService.js";

// Create order from cart
export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { shipping_address, phone, payment_method } = req.body;

    const order = await orderService.createOrderFromCart(userId, {
      shipping_address,
      phone,
      payment_method: payment_method || "cod"
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Update payment status
export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { payment_status, transaction_id } = req.body;

    const order = await orderService.updatePaymentStatus(orderId, {
      payment_status,
      transaction_id
    });

    res.json({
      success: true,
      message: "Payment status updated",
      data: order
    });
  } catch (error) {
    next(error);
  }
};




// Get user orders
export const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orders = await orderService.getUserOrders(userId);

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// Get single order
export const getOrderById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const order = await orderService.getOrderById(orderId, userId);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
export const cancelOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const order = await orderService.cancelOrder(orderId, userId);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order
    });
  } catch (error) {
    next(error);
  }
};
