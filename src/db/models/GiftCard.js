import { DataTypes } from 'sequelize';
import sequelize from '../../config/sequelize.js';

const GiftCard = sequelize.define('GiftCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR'
  },
  status: {
    type: DataTypes.ENUM('active', 'used', 'expired', 'cancelled'),
    defaultValue: 'active'
  },
  issued_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  redeemed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  redeemed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'gift_cards',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default GiftCard;
