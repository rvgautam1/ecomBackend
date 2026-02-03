'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('cart', [
    
      {
        user_id: 9,
        product_id: 9, 
        quantity: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        user_id: 10,
        product_id: 8, 
        quantity: 2,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('cart', null, {});
  }
};
