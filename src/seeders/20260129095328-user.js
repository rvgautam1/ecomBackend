'use strict';
const bcrypt = require('bcryptjs');

export default {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('passw123', 10);

    await queryInterface.bulkInsert('Users', [
      {
        name: 'John Doe',
        email: 'john@example.com',

        password: hashedPassword,
        role: 'user',
        phone: '+91-9876543210',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',

        password: hashedPassword,
        role: 'user',
        phone: '+91-9876543211',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Tech Vendor',
        email: 'techvendor@example.com',

        password: hashedPassword,
        role: 'vendor',
        phone: '+91-9876543212',
        created_at: new Date(),
        updated_at: new Date()
      },
      
    ], {});
  },

  down: async (queryInterface, Sequelize) => {

    await queryInterface.bulkDelete('Users', null, {});
  }
};
