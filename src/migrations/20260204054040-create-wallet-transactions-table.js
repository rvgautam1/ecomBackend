'use strict';

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('wallet_transactions', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    wallet_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'wallets',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },

    transaction_type: {
      type: Sequelize.ENUM('credit', 'debit'),
      allowNull: false
    },

    amount: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false
    },

    balance_before: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false
    },

    balance_after: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false
    },

    transaction_source: {
      type: Sequelize.ENUM(
        'order_payment',
        'refund',
        'cashback',
        'gift_card',
        'admin_credit',
        'admin_debit',
        'withdrawal'
      ),
      allowNull: false
    },

    reference_type: {
      type: Sequelize.STRING(50),
      allowNull: true
    },

    reference_id: {
      type: Sequelize.INTEGER,
      allowNull: true
    },

    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },

    metadata: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    },

    status: {
      type: Sequelize.ENUM('pending', 'completed', 'failed', 'reversed'),
      allowNull: false,
      defaultValue: 'completed'
    },

    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.addIndex('wallet_transactions', ['wallet_id']);
  await queryInterface.addIndex('wallet_transactions', ['transaction_type']);
  await queryInterface.addIndex('wallet_transactions', ['transaction_source']);
  await queryInterface.addIndex('wallet_transactions', ['reference_type', 'reference_id']);
  await queryInterface.addIndex('wallet_transactions', ['status']);
  await queryInterface.addIndex('wallet_transactions', ['created_at']);
}
export async function down(queryInterface) {
  await queryInterface.dropTable('wallet_transactions');

  // PostgreSQL ENUM cleanup
  await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_wallet_transactions_transaction_type";
      DROP TYPE IF EXISTS "enum_wallet_transactions_transaction_source";
      DROP TYPE IF EXISTS "enum_wallet_transactions_status";
    `);
}
