'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Products', [
    
      {
        name: 'iPhone 15 Pro',
        description: 'Latest Apple iPhone with A17 Pro chip, 256GB storage',
        price: 134900.00,
        stock: 50,
        category_id: 30, 
        vendor_id: 10,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Flagship Samsung phone with S Pen, 512GB',
        price: 129999.00,
        stock: 30,
        category_id: 30,
        vendor_id: 10,
        created_at: new Date(),
        updated_at: new Date()
      },
      
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Products', null, {});
  }
};
