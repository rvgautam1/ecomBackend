// const pool = require("../config/database");

// class WishlistService {
    
//   async addToWishlist(userId, productId) {
//     const exists = await pool.query(
//       "SELECT *FROM wishlist WHERE user_id = $1 AND product_id = $2",
//       [userId, productId],
//     )

//     if(exists.rows.length>0){
//         throw new Error('product already in the wishlist !')
//     }

//     const productExists = await pool.query(
//         'SELECT id FROM products WHERE id =$1',
//         [productId]
//     )

//     if(productExists.rows.length === 0){
//         throw new Error('Product not found ');
//     }

//     const wishlist = await pool.query(
//         'INSERT INTO wishlist (user_id , product_id) VALUES ($1 ,$2) RETURNING *',
//         [userId , productId]
//     )


//     return wishlist.rows[0];
//   }



//   async getWishlist(userId){
//     const wishlist = await pool.query(
//         `SELECT w.id as wishlist_id , p.*,  json_agg(DISTINCT jsonb_build_object('id', pi.id, 'url', pi.image_url)) 
//         FILTER (WHERE pi.id IS NOT NULL) as images FROM wishlist w 
//         JOIN products p ON w.product_id = p.id 
//         LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary  = true 
//         WHERE w.user_id = $1
//         GROUP BY w.id , p.id 
//         ORDER BY w.created_at DESC`,
//         [userId]
        
//     )

//     return wishlist.rows ;
//   }


//   async removefrmWishlist (wishlistId , userId){

// const  result = await pool.query(
//     'DELETE FROM wishlist WHERE ID = $1 AND user_id =$2 RETURNING id',
//     [wishlistId, userId]
// )

// if(result.rows.length ===0){
//     throw new Error('wishlist item not found in wishlist ')
// }
// return {message : 'product remove from the wishlist '}
//   }



//   async checkInWishlist(userId , productId){
//     const result = await pool.query(
//         'SELECT * FROM wishlist WHERE user_id = $1 AND product_id = $2',
//         [userId , productId]
//     )

//     return result.rows.length >0 ;
//   }


//   async clearWishlist (userId){
//     await pool.query('DELETE FROM wishlist WHERE user_id =$1 ' ,[userId])

//     return {message : 'product cleared succesfully '}
//   }
// }

// export default new WishlistService();




import { Wishlist, Product, ProductImage, User } from "../../db/models/index.js";

class WishlistService {

  async addToWishlist(userId, productId) {
    const exists = await Wishlist.findOne({
      where: { user_id: userId, product_id: productId }
    });

    if (exists) {
      throw new Error('Product is already in the  wishlist ');
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      throw new Error('Product not found  ');
    }

    return await Wishlist.create({ user_id: userId, product_id: productId });
  }

async getWishlist(userId) {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: Product,
        as: 'wishlistProducts',
        include: [
          {
            model: ProductImage,
            as: 'images',
            where: { is_primary: true },
            required: false
          }
        ],
        through: { attributes: [] } // hides Wishlist table
      }
    ]
  });

  return user.wishlistProducts;
}


  async removeFromWishlist(wishlistId, userId) {

    const item = await Wishlist.findOne({

      where: { id: wishlistId, user_id: userId }
    });

    if (!item) {

      throw new Error('Item not found in  the wishlist');
    }

    await item.destroy();

    return { message: 'Product  is removed from the  wishlist' };
  }
}


    export default new WishlistService();

