'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Product_images', [
    
      {
        product_id: 8,
        image_url: '/uploads/products/iphone-15-pro-1.jpg',
        is_primary: true,
        created_at: new Date()
      },
      {
        product_id: 9,
        image_url: '/uploads/products/iphone-15-pro-2.jpg',
        is_primary: false,
        created_at: new Date()
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Product_images', null, {});
  }
};
