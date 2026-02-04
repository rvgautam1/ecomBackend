'use strict';

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('wallets', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: true
    },

    balance: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },

    currency: {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'INR'
    },

    is_active: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    locked_balance: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },

    version: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Sequelize optimistic locking version'
    },

    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },

    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.addIndex('wallets', ['user_id'], { unique: true });
  await queryInterface.addIndex('wallets', ['is_active']);
  await queryInterface.addIndex('wallets', ['version']);
}
export async function down(queryInterface) {
  await queryInterface.dropTable('wallets');
}
