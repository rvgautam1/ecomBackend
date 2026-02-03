'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('review_images', [
  
      {
        review_id: 13,
        image_url: '/uploads/reviews/iphone-review-1.jpg',
        created_at: new Date()
      },
      {
        review_id: 14,
        image_url: '/uploads/reviews/iphone-review-2.jpg',
        created_at: new Date()
      },

  
    


    
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('review_images', null, {});
  }
};
