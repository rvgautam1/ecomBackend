import { Cart, Product, ProductImage } from "../../db/models/index.js";
import CustomError from "../../utils/customError.js";
import sessionService from "../../utils/sessionService.js";
import invalidationService from "../../cache/invalidationService.js";
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
            `product_${product_id}`,
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

      return{
         items: enhancedItems,
        totalAmount: totalAmount.toFixed(2),
        itemCount: enhancedItems.length,
        isGuest: true
      }
    }

    //no user or session - empty cart 
     return {
      items: [],
      totalAmount: '0.00',
      itemCount: 0,
      isGuest: true
    };
  }


  
  // Update quantity of specific cart item
  // Validates stock availability before updating
  async updateCartItem(cartId, userId, quantity) {
    // Prevent invalid quantities
    if (quantity < 1) {
      throw CustomError.badRequest("Quantity must be at least 1");
    }

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
    return cartItem; // Return updated cart item
  }

  // Remove specific item from user's cart
  // Only user who owns the cart item can remove it
  async removeFromCart(cartId, userId) {
    // Find and verify cart item belongs to user
    const item = await Cart.findOne({
      where: { id: cartId, user_id: userId },
    });

    if (!item) {
      throw CustomError.notFound("Cart item not found");
    }

    // Delete cart item
    await item.destroy();

    return { message: "Product removed from cart" };
  }

  // Clear all items from user's cart
  // Used after successful order placement
  async clearCart(userId) {
    // Delete all cart records for user in single operation
    await Cart.destroy({ where: { user_id: userId } });

    return { message: "Cart cleared successfully" };
  }
}

export default new CartService();
