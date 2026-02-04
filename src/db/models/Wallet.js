import { DataTypes } from 'sequelize';
import sequelize from '../../config/sequelize.js';

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  locked_balance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'wallets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  version: true //  Sequelize's built-in versioning
});

export default Wallet;
