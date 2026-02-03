'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Reviews', [
      
      {
        product_id: 9,
        user_id: 9, 
        rating: 5,
        comment: 'Excellent phone! Camera quality is amazing and battery life is great.',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        product_id: 8,
        user_id: 10, 
        rating: 4,
        comment: 'Good phone but a bit expensive. Worth it for the features.',
        created_at: new Date(),
        updated_at: new Date()
      },

    
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Reviews', null, {});
  }
};
