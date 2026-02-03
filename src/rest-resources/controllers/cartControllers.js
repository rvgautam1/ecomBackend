import cartService from "../services/cartService.js";

// Add to cart
export const addToCart = async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "Product id is required"
      });
    }

    const cart = await cartService.addToCart(
      req.user.id,
      product_id,
      quantity
    );

    res.status(201).json({
      success: true,
      message: "Product added to cart",
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// Get cart
export const getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.id);

    res.status(200).json({
      success: true,
      count: cart.itemCount,
      totalAmount: cart.totalAmount,
      data: cart.items
    });
  } catch (error) {
    next(error);
  }
};

// Update cart item
export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required"
      });
    }

    const cart = await cartService.updateCartItem(
      req.params.id,
      req.user.id,
      quantity
    );

    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// Remove from cart
export const removeFromCart = async (req, res, next) => {
  try {
    const result = await cartService.removeFromCart(
      req.params.id,
      req.user.id
    );

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

// Clear cart
export const clearCart = async (req, res, next) => {
  try {
    const result = await cartService.clearCart(req.user.id);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};
