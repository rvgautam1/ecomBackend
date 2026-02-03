'use strict';

export default {
  up: async (queryInterface, Sequelize) => {

    await queryInterface.addColumn('orders', 'payment_method', {

      type: Sequelize.ENUM('cod', 'card', 'upi', 'netbanking', 'wallet'),

      defaultValue: 'cod',

      allowNull: false
    });

    await queryInterface.addColumn('orders', 'payment_status', {

      type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending',
      allowNull: false
    });

    await queryInterface.addColumn('orders', 'transaction_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
      unique: true
    });

    // index for faster queries and history 
    await queryInterface.addIndex('orders', ['payment_status']);
    await queryInterface.addIndex('orders', ['transaction_id']);
  },

  // remove from db 
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('orders', 'payment_method');

    await queryInterface.removeColumn('orders', 'payment_status');

    await queryInterface.removeColumn('orders', 'transaction_id');
  }
};
