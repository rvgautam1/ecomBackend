import { DataTypes } from "sequelize";
import sequelize from "../../config/sequelize.js";

const ReviewImage = sequelize.define('ReviewImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  review_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Reviews',
      key: 'id'
    }
  },
  image_url: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'review_images',
  updatedAt: false
});

export default ReviewImage;
