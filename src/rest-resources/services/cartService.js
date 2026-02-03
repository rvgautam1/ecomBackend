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

  async addToCart(userId, productId, quantity = 1) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw CustomError.notFound("Product not found");
    }

    if (product.stock < quantity) {
      throw CustomError.badRequest("Insufficient stock available");
    }

    const [cartItem, created] = await Cart.findOrCreate({
      where: { user_id: userId, product_id: productId },
      defaults: { quantity }
    });

    if (!created) {
      const newQuantity = cartItem.quantity + quantity;

      if (product.stock < newQuantity) {
        throw CustomError.badRequest("Insufficient stock available");
      }

      await cartItem.update({ quantity: newQuantity });
    }

    return cartItem;
  }

  async getCart(userId) {
    const items = await Cart.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          include: [
            {
              model: ProductImage,
              as: "images",
              where: { is_primary: true },
              required: false
            }
          ]
        }
      ]
    });

    const totalAmount = items.reduce((sum, item) => {
      return sum + Number(item.Product.price) * item.quantity;
    }, 0);

    return {
      items,
      totalAmount: totalAmount.toFixed(2),
      itemCount: items.length
    };
  }

  async updateCartItem(cartId, userId, quantity) {
    if (quantity < 1) {
      throw CustomError.badRequest("Quantity must be at least 1");
    }

    const cartItem = await Cart.findOne({
      where: { id: cartId, user_id: userId },
      include: [Product]
    });

    if (!cartItem) {
      throw CustomError.notFound("Cart item not found");
    }

    if (cartItem.Product.stock < quantity) {
      throw CustomError.badRequest("Insufficient stock available");
    }

    await cartItem.update({ quantity });
    return cartItem;
  }

  async removeFromCart(cartId, userId) {
    const item = await Cart.findOne({
      where: { id: cartId, user_id: userId }
    });

    if (!item) {
      throw CustomError.notFound("Cart item not found");
    }

    await item.destroy();

    return { message: "Product removed from cart" };
  }

  async clearCart(userId) {
    await Cart.destroy({ where: { user_id: userId } });

    return { message: "Cart cleared successfully" };
  }
}

export default new CartService();
