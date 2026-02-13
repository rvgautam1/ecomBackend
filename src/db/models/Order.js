import { DataTypes } from "sequelize";
import sequelize from "../../config/sequelize.js";

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },

    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ),
      defaultValue: "pending",
    },

    payment_method: {
      type: DataTypes.ENUM("cod", "card", "upi", "netbanking", "wallet"),
      defaultValue: "cod",
      allowNull: false,
    },

    payment_status: {
      type: DataTypes.ENUM("pending", "completed", "failed", "refunded"),
      defaultValue: "pending",
      allowNull: false,
    },
    transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },

    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

   // for order tracking 
    tracking_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    shipping_carrier: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    shipped_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    processing_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Order;