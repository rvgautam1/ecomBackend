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

// Cancel order (User)
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

// === VENDOR ORDER MANAGEMENT ===

// Get vendor orders
export const getVendorOrders = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { status, start_date, end_date } = req.query;

    const orders = await orderService.getVendorOrders(vendorId, {
      status,
      start_date,
      end_date
    });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// Confirm order (Vendor)
export const confirmOrder = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;

    const order = await orderService.confirmOrder(orderId, vendorId);

    res.json({
      success: true,
      message: "Order confirmed successfully",
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Process order (Vendor)
export const processOrder = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;

    const order = await orderService.processOrder(orderId, vendorId);

    res.json({
      success: true,
      message: "Order is now being processed",
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Ship order (Vendor)
export const shipOrder = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;
    const { tracking_number, shipping_carrier } = req.body;

    const order = await orderService.shipOrder(orderId, {
      tracking_number,
      shipping_carrier
    }, vendorId);

    res.json({
      success: true,
      message: "Order shipped successfully",
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Deliver order (Vendor)
export const deliverOrder = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;

    const order = await orderService.deliverOrder(orderId, vendorId);

    res.json({
      success: true,
      message: "Order delivered successfully",
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order by vendor
export const vendorCancelOrder = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;

    const order = await orderService.adminCancelOrder(orderId, vendorId);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (Vendor - generic)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await orderService.updateOrderStatus(orderId, status, vendorId);

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (error) {
    next(error);
  }
};
