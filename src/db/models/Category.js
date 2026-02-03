import { DataTypes } from "sequelize";
import sequelize from "../../config/sequelize.js";

const Category = sequelize.define(
  'Category',
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
    description: {
      type: DataTypes.TEXT
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Users',
        key: 'id'
      }
    }
  },
  {
    tableName: 'Categories',
    freezeTableName: true,

  
    timestamps: true,
    createdAt: 'created_at', 
    updatedAt: false      
  }
);

export default Category;
