'use strict';

export default {
  
  up: async (queryInterface, Sequelize) => {

    await queryInterface.bulkInsert('Categories', [
      {
        name: 'Electronics',
        description: 'Electronic devices and gadgets',
        vendor_id: 1, 
        created_at: new Date()
      },
      {
        name: 'Mobile Phones',
        description: 'Smartphones and accessories',
        vendor_id: 1,
        created_at: new Date()
      },
     
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('categories', null, {});
  }
};
