"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "Wishlist",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Users",
            key: "id",
          },
        },
        product_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Products",
            key: "id",
          },
        },
      },
      {
        tableName: "Wishlist",
        updatedAt: false,
        indexes: [
          {
            unique: true,
            fields: ["user_id", "product_id"],
          },
        ],
      },
    );
  },

  async down(queryInterface, Sequelize) {
await queryInterface.dropTable('Wishlist');

  },
};
