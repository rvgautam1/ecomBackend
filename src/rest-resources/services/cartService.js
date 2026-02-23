import { Cart, Product, ProductImage } from "../../db/models/index.js";
import CustomError from "../../utils/customError.js";
import sessionService from "../../utils/sessionService.js";
import invalidationService from "../../cache/invalidationService.js";
import redisClient from "../../config/redis.js";
class CartService {
  // Add product to user's cart or increment quantity if already exists
  // Automatically validates stock availability before adding

  async addToCart(userId, productId, quantity = 1, sessionId = null) {
    // Fetch product to validate existence and stock
    const product = await Product.findByPk(productId);

    if (!product) {
      throw CustomError.notFound("Product not found");
    }

    // Check if enough stock available for initial quantity
    if (product.stock < quantity) {
      throw CustomError.badRequest("Insufficient stock available");
    }

    if (userId) {
      // Try to find existing cart item OR create new one
      // findOrCreate returns [instance, created(boolean)]
      const [cartItem, created] = await Cart.findOrCreate({
        where: { user_id: userId, product_id: productId },
        defaults: { quantity }, // Use provided quantity if creating new
      });

      // If cart item already existed, increment quantity
      if (!created) {
        const newQuantity = cartItem.quantity + quantity;

        // Check if enough stock after incrementing
        if (product.stock < newQuantity) {
          throw CustomError.badRequest("Insufficient stock available");
        }

        // Update existing cart item with new total quantity
        await cartItem.update({ quantity: newQuantity });
      }

      // invalidate cach for this user's cart
      await invalidationService.invalidateUser(userId);

      // Return cart item (either newly created or updated)
      return cartItem;
    } else if (sessionId) {
      // Get current guest cart
      const guestCart =
        (await sessionService.getData(sessionId, "cart", "items")) || [];

      // Check if product already exists in guest cart
      const existingItemIndex = guestCart.findIndex(
        (item) => item.product_id === productId,
      );

      if (existingItemIndex >= 0) {
        // Update quantity
        const newQuantity = guestCart[existingItemIndex].quantity + quantity;

        if (product.stock < newQuantity) {
          throw CustomError.badRequest("Insufficient stock available");
        }
        guestCart[existingItemIndex].quantity = newQuantity;
      } else {
        // Add new item
        guestCart.push({
          id: `guest_${Date.now()}_${productId}`, // Temporary ID
          product_id: productId,
          quantity,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            stock: product.stock,
            // Include minimal product data for display
            images: product.images || [],
          },
          added_at: new Date().toISOString(),
        });
      }
      // Save updated cart to session
      await sessionService.setData(sessionId, "cart", "items", guestCart);

      // Also store product details separately for better performance
      await sessionService.setData(
        sessionId,
        "cart",
        `product_${productId}`,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
        },
        3600,
      ); // 1 hour TTL for product data
      // Return the added/updated item
      return {
        id:
          existingItemIndex >= 0
            ? guestCart[existingItemIndex].id
            : `guest_${Date.now()}_${productId}`,
        product_id: productId,
        quantity:
          existingItemIndex >= 0
            ? guestCart[existingItemIndex].quantity
            : quantity,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
        },
      };
    } else {
      throw CustomError.badRequest("User identification required");
    }
  }

  // Get complete cart details for a user
  // Includes product details and primary images
  // Calculates total cart value and item count
  async getCart(userId, sessionId = null) {
    if (userId) {
      const items = await Cart.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Product,
            as: "product",
            include: [
              {
                model: ProductImage,
                as: "images",
                where: { is_primary: true },
                required: false,
              },
            ],
          },
        ],
      });

      const totalAmount = items.reduce((sum, item) => {
        if (!item.product) return sum;
        return sum + Number(item.product.price) * item.quantity;
      }, 0);

      return {
        items,
        totalAmount: totalAmount.toFixed(2),
        itemCount: items.length,
        isGuest: false,
      };
    } else if (sessionId) {
      const guestCart =
        (await sessionService.getData(sessionId, "cart", "items")) || [];
      // fetch fresh product data for guest cart items
      const enhancedItems = await Promise.all(
        guestCart.map(async (item) => {
          // try to get cached product data
          let productdata = await sessionService.getData(
            sessionId,
            "cart",
            `product_${Product}`,
          );

          // if not caches , fetch data from db
          if (!productdata) {
            const product = await Product.findByPk(item.product_id, {
              include: [
                {
                  model: ProductImage,
                  as: "images",
                  where: { is_primary: true },
                  required: false,
                  limit: 1,
                },
              ],
            });
            if (product) {
              productdata = {
                id: product.id,
                name: product.name,
                price: product.price,
                stock: product.stock,
                images: product.images || [],
              };
              // cache for next time
              await sessionService.setData(
                sessionId,
                "cart",
                `product_${item.product_id}`,
                productdata,
                3600,
              );
            }
          }

          return {
            ...item,
            product: productdata || item.product,
          };
        }),
      );

      const totalAmount = enhancedItems.reduce((sum, item) => {
        if (!item.product) return sum;
        return sum + Number(item.product.price) * item.quantity;
      }, 0);

      return {
        items: enhancedItems,
        totalAmount: totalAmount.toFixed(2),
        itemCount: enhancedItems.length,
        isGuest: true,
      };
    }

    //no user or session - empty cart
    return {
      items: [],
      totalAmount: "0.00",
      itemCount: 0,
      isGuest: true,
    };
  }

  // Update quantity of specific cart item
  // Validates stock availability before updating
  async updateCartItem(cartId, userId, quantity, sessionId = null) {
    // Prevent invalid quantities
    if (quantity < 1) {
      throw CustomError.badRequest("Quantity must be at least 1");
    }

    if (userId) {
      // Fetch cart item with product details and verify ownership
      const cartItem = await Cart.findOne({
        where: { id: cartId, user_id: userId },
        include: [Product], // Need product stock info
      });
      if (!cartItem) {
        throw CustomError.notFound("Cart item not found");
      }

      // Verify sufficient stock for new quantity
      if (cartItem.Product.stock < quantity) {
        throw CustomError.badRequest("Insufficient stock available");
      }

      // Update cart item quantity
      await cartItem.update({ quantity });

      // Invalidate cache
      await invalidationService.invalidateUser(userId);

      return cartItem; // Return updated cart item
    } else if (sessionId) {
      const guestCart =
        (await sessionService.getData(sessionId, "cart", "items")) || [];

      const itemIndex = guestCart.findIndex((item) => item.id === cartId);
      if (itemIndex === -1) {
        throw CustomError.notFound("Cart item not found");
      }

      // check stock
      const product = await Product.findByPk(guestCart[itemIndex].product_id);
      if (!product || product.stock < quantity) {
        throw CustomError.badRequest("Insufficient stock available");
      }

      guestCart[itemIndex].quantity = quantity;
      await sessionService.setData(sessionId, "cart", "items", guestCart);
      return guestCart[itemIndex];
    }

    throw CustomError.badRequest("User identification required");
  }

  // Remove specific item from user's cart
  // Only user who owns the cart item can remove it
  async removeFromCart(cartId, userId, sessionId = null) {
    if (userId) {
      // Find and verify cart item belongs to user
      const item = await Cart.findOne({
        where: { id: cartId, user_id: userId },
      });

      if (!item) {
        throw CustomError.notFound("Cart item not found");
      }

      // Delete cart item
      await item.destroy();

      // invalidate the cache
      await invalidationService.invalidateUser(userId);

      return { message: "Product removed from cart" };
    } // Guest user
    else if (sessionId) {
      const guestCart =
        (await sessionService.getData(sessionId, "cart", "items")) || [];
      const filteredCart = guestCart.filter((item) => item.id !== cartId);

      if (filteredCart.length === guestCart.length) {
        throw CustomError.notFound("Cart item not found");
      }

      await sessionService.setData(sessionId, "cart", "items", filteredCart);
      return { message: "Product removed from cart" };
    }

    throw CustomError.badRequest("User identification required");
  }

  // Clear all items from user's cart
  // Used after successful order placement
  async clearCart(userId, sessionId = null) {
    // Authenticated user
    if (userId) {
      await Cart.destroy({ where: { user_id: userId } });

      // Invalidate cache
      await invalidationService.invalidateUser(userId);

      return { message: "Cart cleared successfully" };
    }

    // Guest user
    else if (sessionId) {
      await sessionService.deleteData(sessionId, "cart", "items");
      return { message: "Cart cleared successfully" };
    }

    throw CustomError.badRequest("User identification required");
  }

  // merge guest cart with user cart after login

  async mergeCarts(userId, sessionId) {
    if (!userId || !sessionId) {
      throw CustomError.badRequest("User ID and Session Id are required");
    }
    // Get guest cart
    const guestCart =
      (await sessionService.getData(sessionId, "cart", "items")) || [];
    if (guestCart.length === 0) {
      return { message: "No guest cart to merge", merged: 0 };
    }
    let mergeCount = 0;
    let skippedCount = 0;
    // process each guest cart item
    for (const guestItem of guestCart) {
      try {
        const product = await Product.findByPk(guestItem.product_id);

        if (!product) {
          skippedCount++;
          continue;
        }
        // Check if product already exists in user's cart
        const [cartItem, created] = await Cart.findOrCreate({
          where: { user_id: userId, product_id: guestItem.product_id },
          defaults: { quantity: guestItem.quantity },
        });

        if (!created) {
          // Merge quantities, but don't exceed stock
          const mergedQuantity = Math.min(
            cartItem.quantity + guestItem.quantity,
            product.stock,
          );
          await cartItem.update({ quantity: mergedQuantity });
        }
        mergeCount++;
      } catch (error) {
        console.error(`Failed to merge item ${guestItem.product_id}:`, error);
        skippedCount++;
      }
    }
    // Clear guest cart after successful merge
    await sessionService.deleteData(sessionId, "cart", "items");

    // also cache clear
    const productKeys = await redisClient.keys(
      `session:${sessionId}:cart:product_*`,
    );
    if (productKeys.length > 0) {
      await redisClient.del(productKeys);
    }

    // Invalidate user cache
    await invalidationService.invalidateUser(userId);

    return {
      message: "Cart merged successfully",
      merged: mergeCount,
      skipped: skippedCount,
    };
  }

  // get cart count for nav/badge
  async getCartCount(userId = null, sessionId = null) {
    if (userId) {
      const count = await Cart.count({ where: { user_id: userId } });
      return count;
    } else if (sessionId) {
      const guestCart =
        (await sessionService.getData(sessionId, "cart", "items")) || [];
      return guestCart.length;
    }
    return 0;
  }
}

export default new CartService();
