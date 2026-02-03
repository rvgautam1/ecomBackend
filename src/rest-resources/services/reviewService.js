// const pool = require('../config/database');

// class ReviewService {

//   async createReview(reviewData, userId, imageFiles) {
//     const { product_id, rating, comment } = reviewData;

//     if (rating < 1 || rating > 5) {

        
//       throw new Error('Rating must be between 1 and 5');
//     }

//     const existingReview = await pool.query(


//       'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2',
//       [product_id, userId]
//     );

//     if (existingReview.rows.length > 0) {

//       throw new Error('You have already reviewed this product');
//     }

//     const reviewResult = await pool.query(

//       `INSERT INTO reviews (product_id, user_id, rating, comment)
//        VALUES ($1, $2, $3, $4)
//        RETURNING *`,
//       [product_id, userId, rating, comment]
//     );

//     const review = reviewResult.rows[0];

//     if (imageFiles?.length) {
//       for (const file of imageFiles) {
//         await pool.query(
//           'INSERT INTO review_images (review_id, image_url) VALUES ($1, $2)',

//           [review.id, `/uploads/reviews/${file.filename}`]
//         );
//       }
//     }

//     return review;
//   }

//   async getProductReviews(productId) {
//     const { rows } = await pool.query(
//       `
//       SELECT
//         r.id,
//         r.rating,

//         r.comment,
//         r.created_at,


//         u.name AS user_name,
//         COALESCE(

//           json_agg(
          
//             jsonb_build_object(
//               'id', ri.id,
//               'url', ri.image_url
//             )
//           ) FILTER (WHERE ri.id IS NOT NULL),
//           '[]'
//         ) AS images
//       FROM reviews r

//       JOIN users u ON r.user_id = u.id
//       LEFT JOIN review_images ri ON r.id = ri.review_id
      
//       WHERE r.product_id = $1
//       GROUP BY r.id, u.name
//       ORDER BY r.created_at DESC
//       `,
//       [productId]
//     );

//     return rows;
//   }

// // Function,Purpose
// // jsonb_build_object,"Creates a JSON object for each image (e.g., {""id"": 1, ""url"": ""...""})."
// // json_agg(...),Collects all those individual JSON objects and puts them into a single JSON array.
// // FILTER (WHERE ri.id IS NOT NULL),"This is crucial. Without this, if a review has no images, json_agg would return [null]. This ensures we only aggregate actual image data."
// // "COALESCE(..., '[]')","If the entire result is null, this forces it to return an empty array [] instead of null. This prevents your JavaScript frontend from crashing when it tries to .map() over the images."

//   async updateReview(reviewId, userId, updates) {
//     const { rating, comment } = updates;

//     if (rating && (rating < 1 || rating > 5)) {
//       throw new Error('Rating must be between 1 and 5');
//     }

//     const { rows } = await pool.query(
//       `
//       UPDATE reviews SET
//         rating = COALESCE($1, rating),
//         comment = COALESCE($2, comment),
//         updated_at = CURRENT_TIMESTAMP
//       WHERE id = $3 AND user_id = $4
//       RETURNING *
//       `,
//       [rating, comment, reviewId, userId]
//     );

//     if (!rows.length) {
//       throw new Error('Review not found or permission denied');
//     }

//     return rows[0];
//   }

//   async deleteReview(reviewId, userId) {
//     const { rows } = await pool.query(
//       'DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id',
//       [reviewId, userId]
//     );

//     if (!rows.length) {
//       throw new Error('Review not found or permission denied');
//     }

//     return { message: 'Review deleted successfully' };
//   }
// }

// export default new ReviewService();



import { Review, User, ReviewImage } from "../../db/models/index.js";


class ReviewService{
  async createReview(reviewData , userId , imageFiles){
    const {product_id , rating , comment} = reviewData;

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be b/w 1 and 5');
    }


     const existingReview = await Review.findOne({
      where: { product_id, user_id: userId }
    });

    if(existingReview){
      throw new Error('you have allready reviewed this product ')
    }

    const review = await Review.create({
      product_id,
      user_id: userId,
      rating,
      comment
    });

if (imageFiles && imageFiles.length > 0) {
      const images = imageFiles.map(file => ({
        review_id: review.id,
        image_url: `/uploads/reviews/${file.filename}`
      }));
      await ReviewImage.bulkCreate(images);
    }
return review ;
  }


  async getProductReviews(productId) {
    return await Review.findAll({
      where: { product_id: productId },
      include: [
        { model: User, as: 'user', attributes: ['name'] },
        { model: ReviewImage, as: 'images' }
      ],
      order: [['created_at', 'DESC']]
    });
  }


  async updateReview(reviewId, userId, updates) {
    const review = await Review.findOne({
      where: { id: reviewId, user_id: userId }
    });

    if (!review) {
      throw new Error('Review not found or not have permission');
    }

    await review.update(updates);
    return review;
  }
  


  async deleteReview(reviewId, userId) {
    const review = await Review.findOne({
      where: { id: reviewId, user_id: userId }
    });

    if (!review) {
      throw new Error('Review not found or not have permission');
    }

    await review.destroy();
    return { message: 'Review deleted successfully !!!' };
  }
}


export default new ReviewService();