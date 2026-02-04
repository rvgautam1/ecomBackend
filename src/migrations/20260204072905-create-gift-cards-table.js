"use strict";

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("gift_cards", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: Sequelize.STRING(20),
      allowNull: false,
      unique: true,
    },
    amount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    balance: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: Sequelize.STRING(3),
      defaultValue: "INR",
    },
    status: {
      type: Sequelize.ENUM("active", "used", "expired", "cancelled"),
      defaultValue: "active",
    },
    issued_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      comment: "Admin who issued the card",
    },
    redeemed_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    },
    redeemed_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  });

  await queryInterface.addIndex("gift_cards", ["code"], { unique: true });
  await queryInterface.addIndex("gift_cards", ["status"]);
  await queryInterface.addIndex("gift_cards", ["redeemed_by"]);
}
export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable("gift_cards");
}
