'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.ENUM('cod', 'card', 'upi', 'netbanking', 'wallet'),
        defaultValue: 'cod',
        allowNull: false
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending',
        allowNull: false
      },
      transaction_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      shipping_address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
     
      tracking_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      shipping_carrier: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      shipped_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      processing_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('orders', ['user_id']);
    await queryInterface.addIndex('orders', ['status']);
    await queryInterface.addIndex('orders', ['payment_status']);
    await queryInterface.addIndex('orders', ['payment_method']);
    await queryInterface.addIndex('orders', ['transaction_id']);
    await queryInterface.addIndex('orders', ['created_at']);
    await queryInterface.addIndex('orders', ['shipped_at']);
    await queryInterface.addIndex('orders', ['delivered_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('orders');
  }
};