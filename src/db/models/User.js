import { DataTypes } from "sequelize";
import sequelize from "../../config/sequelize.js";
import bcrypt from "bcrypt";

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
  type: DataTypes.STRING(100),
  allowNull: false,
  unique: true,
  validate: {
    isEmail: true
  },
  set(value) {
    this.setDataValue('email', value.toLowerCase());
  }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('user', 'vendor'),
      defaultValue: 'user'
    },
    phone: {
      type: DataTypes.STRING(20)
    }
  },
  {
    tableName: 'Users',      
    timestamps: true,        
    underscored: true, // created_at / updated_at


    // hooks=> Hash password before saving or updating user to ensure secure storage

    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  }
);

export default User;
