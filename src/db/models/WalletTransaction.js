import { DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  wallet_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  transaction_type: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  balance_before: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  balance_after: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  transaction_source: {
    type: DataTypes.ENUM(
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
    type: DataTypes.STRING(50),
    allowNull: true
  },
  reference_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'reversed'),
    defaultValue: 'completed'
  }
}, {
  tableName: 'wallet_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default WalletTransaction;
