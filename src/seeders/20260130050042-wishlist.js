'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Wishlist', [
     
      {
        user_id: 9,
        product_id: 9, 
        
      },
      {
        user_id: 10,
        product_id: 8, 
        
      },
     
     
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Wishlist', null, {});
  }
};
