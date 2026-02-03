import { DataTypes } from "sequelize";
import sequelize from "../../config/sequelize.js";

// Order model storing user orders, payment details, shipping snapshots,

// and lifecycle status with snake_case timestamps mapping

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
  },
  {
    tableName: "orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Order;
