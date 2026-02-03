import { DataTypes } from "sequelize";
import sequelize from "../../config/sequelize.js";

const OrderItem = sequelize.define('OrderItem', {


  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  order_id: {
    type: DataTypes.INTEGER,

    allowNull: false,
    
    references: {
      model: 'orders',
      key: 'id'
    }
  },

  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'id'
    }
  },
  
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  tableName: 'order_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default OrderItem;
