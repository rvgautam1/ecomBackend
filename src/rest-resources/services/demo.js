// const pool =  require('../config/database');


// class CartService{

//     async addToCart(userId , productId , quantity =1){
//         const productExists = await pool.query(
//             'SELECT id , stock FROM products WHERE id =$1',
//             [productId]
//         )

//         if(  productExists.rows.length ===0){
//             throw new Error('Product not found or there ');
//         }

//         if(productExists.rows[0].stock < quantity){
//             throw new Error('Insufficieant stock ')
//         }
//       const exists =  await pool.query(
//         'SELECT * FROM cart WHERE   user_id = $1  AND product_id = $2',
//         [userId , productId]
//       )


//       let cart ;

//       if(exists.rows.length>0){
//      const newQuantity = exists.rows[0].quantity + quantity ;
                           
//      if(productExists.rows[0].stock.quantity<quantity)
//     if (productExists.rows[0].stock < newQuantity) {
//   throw new Error('Insufficient stock available');
// }



//      cart = await pool.query(
//         'UPDATE cart SET quantity = $1 , updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND product_id = $3 RETURNING *',
//         [newQuantity , userId , productId]
//      )

                                              
//       }else{
//         cart = await pool.query(
//             'INSERT INTO cart (user_id , product_id , quantity) VALUES ($1 , $2 , $3) RETURNING *',
//             [userId , productId , quantity]
//         )
//       }

//       return cart.rows[0];
        
//     }



//       async getCart(userId) {
//     const cart = await pool.query(
//       `SELECT c.id as cart_id, c.quantity, p.*, 
//       (p.price * c.quantity) as total_price,


//       json_agg(DISTINCT jsonb_build_object('id', pi.id, 'url', pi.image_url)) 
//       FILTER (WHERE pi.id IS NOT NULL) as images
//       FROM cart c

//       JOIN products p ON c.product_id = p.id
//       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
//       WHERE c.user_id = $1
//       GROUP BY c.id, c.quantity, p.id
//       ORDER BY c.created_at DESC`,
//       [userId]
//     );


//     const totalAmount = cart.rows.reduce((sum , item )=> sum + parseFloat(item.total_price),0);
// return{
//     items: cart.rows ,
//     totalAmount : totalAmount.toFixed(2),
//     itemCount : cart.rows.length
// }

// }

// async updateCartItem(cartId , userId , quantity){
//     if(quantity<1){
//         throw new Error('Quantity must be at least one')
//     }

//     const cartItem = await pool.query(
//         'SELECT c.* , p.stock FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = $1 AND c.user_id = $2',
//         [cartId , userId]
//     )

//     if(cartItem.rows.length ===0){
//         throw new Error('Cart item not found ')
//     }

//     if(cartItem.rows[0].stock<quantity){
//      throw new Error('Insufficient stock available');
//     }

//     const updated = await pool.query(
//         'UPDATE cart SET quantity =$1 , updated_at = CURRENT_TIMESTAMP WHERE  id = $2 AND user_id = $3 RETURNING *',
//         [quantity ,cartItem ,userId]
//     )

//     return updated.rows[0];
// }

// async removeFromCart(cartId , userId){
//     const result = await pool.query(
//         'DELETE FROM cart WHERE id =$1 AND  user_id = $2 RETURNING id',
//         [cartId , userId]
//     );

//     if(result.rows.length ===0){
//  throw new Error('Cart item not found ')
//     }
//     return{message : "product removed from cart "}
// }

// async clearCart(userId) {
//     await pool.query('DELETE FROM cart WHERE user_id = $1', [userId]);
//     return { message: 'Cart cleared successfully' };
//   }

//   async getCartItemCount(userId) {
//     const result = await pool.query(
//       'SELECT COUNT(*) as count FROM cart WHERE user_id = $1',
//       [userId]
//     );

//     return parseInt(result.rows[0].count);
//   }
// }

// export default new CartService();

import { Cart, Product, ProductImage } from "../../db/models/index.js";
import CustomError from "../../utils/customError.js";

class CartService {
  // Add product to user's cart or increment quantity if already exists
  // Automatically validates stock availability before adding
  async addToCart(userId, productId, quantity = 1) {
    // Fetch product to validate existence and stock
    const product = await Product.findByPk(productId);

    if (!product) {
      throw CustomError.notFound("Product not found");
    }

    // Check if enough stock available for initial quantity
    if (product.stock < quantity) {
      throw CustomError.badRequest("Insufficient stock available");
    }

    // Try to find existing cart item OR create new one
    // findOrCreate returns [instance, created(boolean)]
    const [cartItem, created] = await Cart.findOrCreate({
      where: { user_id: userId, product_id: productId },
      defaults: { quantity } // Use provided quantity if creating new
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

    // Return cart item (either newly created or updated)
    return cartItem;
  }

  // Get complete cart details for a user
  // Includes product details and primary images
  // Calculates total cart value and item count
  async getCart(userId) {
    // Fetch all cart items with nested product and primary image data
    const items = await Cart.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          // Nested include: get primary image for each product
          include: [
            {
              model: ProductImage,
              as: "images",
              where: { is_primary: true }, // Only primary image for cart display
              required: false, // Products without images still included
            },
          ],
        },
      ],
    });

    // Calculate total cart amount
    const totalAmount = items.reduce((sum, item) => {
      return sum + Number(item.Product.price) * item.quantity;
    }, 0);

    // Return structured cart summary
    return {
      items, // Array of cart items with product details
      totalAmount: totalAmount.toFixed(2), // Formatted to 2 decimal places
      itemCount: items.length, // Total number of unique items
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


import express from "express";
import {
  addToCart,
  removeFromCart,
  getCart,
  updateCartItem,
  clearCart
} from "../rest-resources/controllers/cartControllers.js";
import { authenticateUser } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateUser);

router.post("/", addToCart);
router.get("/", getCart);
router.put("/:id", updateCartItem);
router.delete("/:id", removeFromCart);
router.post("/clear", clearCart);

export default router;


import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Database & Config

import redisClient from "./src/config/redis.js";

// Middleware
import errorHandler from "./src/middleware/errorHandler.js";
import { cacheMiddleware } from "./src/middleware/redisCache.js";

// Socket
import { initSocket } from "./src/socket/socketServer.js";

// Routes
import authRoutes from "./src/routes/authRoutes.js";
import vendorRoutes from "./src/routes/vendorRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import wishlistRoutes from "./src/routes/wishlistRoutes.js";
import cartRoutes from "./src/routes/cartRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import walletRoutes from "./src/routes/walletRoutes.js";
import giftCardRoutes from "./src/routes/giftCardRoutes.js";

// Load env variables
dotenv.config();

// __dirname setup for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// App & Server
const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------- SOCKET.IO -------------------- */
initSocket(httpServer);

/* -------------------- REDIS INIT -------------------- */
const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("Redis connected successfully");
    return true;
  } catch (err) {
    console.error(" Redis connection failed:", err.message);
    
    // In Docker, Redis is required - retry
    if (process.env.RUNNING_IN_DOCKER === "true") {
      console.log("Retrying Redis connection in 5 seconds...");
      setTimeout(connectRedis, 5000);
    }
    return false;
  }
};

// Start Redis connection
connectRedis();

/* -------------------- ROUTES -------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/vendor", vendorRoutes);

// Cached routes (only if Redis is connected)
app.use("/api/categories", cacheMiddleware(600), categoryRoutes);
app.use("/api/wishlist", cacheMiddleware(300), wishlistRoutes);
app.use("/api/analytics", cacheMiddleware(1800), analyticsRoutes);

// Non-cached routes
app.use("/api/reviews", reviewRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/gift-cards", giftCardRoutes);

/* -------------------- HEALTH CHECK -------------------- */
app.get("/health", async (req, res) => {
  try {
    const dbCheck = await sequelize.authenticate();
    let redisCheck = "disconnected";
    
    if (redisClient.isOpen) {
      redisCheck = await redisClient.ping();
    }
    
    res.json({
      status: "healthy",
      environment: process.env.NODE_ENV,
      docker: process.env.RUNNING_IN_DOCKER === "true" ? "yes" : "no",
      database: "connected",
      redis: redisCheck,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      environment: process.env.NODE_ENV,
      docker: process.env.RUNNING_IN_DOCKER === "true" ? "yes" : "no",
    });
  }
});

/* -------------------- DEFAULT ROUTE -------------------- */
app.get("/", (req, res) => {
  res.json({
    message: "E-commerce API is up and running",
    environment: process.env.NODE_ENV,
    docker: process.env.RUNNING_IN_DOCKER === "true" ? "yes" : "no",
    docs: "/api-docs (if implemented)",
    health: "/health"
  });
});

/* -------------------- ERROR HANDLER -------------------- */
app.use(errorHandler);

/* -------------------- SERVER START -------------------- */
const startServer = async () => {
  try {
    console.log("Starting server in Docker environment...");
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Running in Docker: ${process.env.RUNNING_IN_DOCKER === "true" ? "YES" : "NO"}`);
    console.log(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(` Redis: ${process.env.REDIS_URL}`);
    
   
    
    httpServer.listen(PORT, () => {
      console.log(`Server + Redis + WebSocket running on port ${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log(` Redis Commander: http://localhost:8081`);
    });
  } catch (error) {
    console.error(" Server failed to start");
    console.error(error);
    process.exit(1);
  }
};

startServer(); 