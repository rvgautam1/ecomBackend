import cartService from "../services/cartService.js";
import CustomError from "../../utils/customError.js";

// Add to cart - supports both authenticated and guest users
export const addToCart = async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "Product id is required"
      });
    }

    // req.sessionId is set by middleware in server.js
    const cart = await cartService.addToCart(
      req.user?.id,
      product_id,
      quantity,
      req.sessionId // Guest users will have sessionId
    );

    res.status(201).json({
      success: true,
      message: "Product added to cart",
      data: cart,
      isGuest: req.isGuest || false
    });
  } catch (error) {
    next(error);
  }
};

// Get cart - supports both authenticated and guest users
export const getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(
      req.user?.id,
      req.sessionId // Guest users will have sessionId
    );

    res.status(200).json({
      success: true,
      count: cart.itemCount,
      uniqueItemCount: cart.uniqueItemCount,
      totalAmount: cart.totalAmount,
      isGuest: cart.isGuest,
      data: cart.items
    });
  } catch (error) {
    next(error);
  }
};

// Get cart count for navbar badge
export const getCartCount = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(
      req.user?.id,
      req.sessionId
    );

    res.status(200).json({
      success: true,
      count: cart.itemCount,
      uniqueCount: cart.uniqueItemCount,
      isGuest: cart.isGuest
    });
  } catch (error) {
    next(error);
  }
};

// Update cart item - supports both authenticated and guest users
export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required (minimum 1)"
      });
    }

    const cart = await cartService.updateCartItem(
      req.params.id,
      req.user?.id,
      quantity,
      req.sessionId
    );

    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart,
      isGuest: req.isGuest || false
    });
  } catch (error) {
    next(error);
  }
};

// Remove from cart - supports both authenticated and guest users
export const removeFromCart = async (req, res, next) => {
  try {
    const result = await cartService.removeFromCart(
      req.params.id,
      req.user?.id,
      req.sessionId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      isGuest: req.isGuest || false
    });
  } catch (error) {
    next(error);
  }
};

// Clear cart - supports both authenticated and guest users
export const clearCart = async (req, res, next) => {
  try {
    const result = await cartService.clearCart(
      req.user?.id,
      req.sessionId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      isGuest: req.isGuest || false
    });
  } catch (error) {
    next(error);
  }
};

// Merge guest cart with user cart (protected route)
export const mergeGuestCart = async (req, res, next) => {
  try {
    if (!req.user) {
      throw CustomError.unauthorized("Authentication required");
    }

    const result = await cartService.mergeCarts(
      req.user.id,
      req.sessionId // Current session that might have guest cart
    );

    res.status(200).json({
      success: true,
      message: result.message,
      merged: result.merged,
      skipped: result.skipped
    });
  } catch (error) {
    next(error);
  }
};