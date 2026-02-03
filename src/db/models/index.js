// 'use strict';

// const fs = require('fs');
// const path = require('path');
// const Sequelize = require('sequelize');
// const process = require('process');
// const basename = path.basename(__filename);
// const env = process.env.NODE_ENV || 'development';
// const config = require(__dirname + '/../config/config.json')[env];
// const db = {};

// let sequelize;
// if (config.use_env_variable) {
//   sequelize = new Sequelize(process.env[config.use_env_variable], config);
// } else {
//   sequelize = new Sequelize(config.database, config.username, config.password, config);
// }

// fs
//   .readdirSync(__dirname)
//   .filter(file => {
//     return (
//       file.indexOf('.') !== 0 &&
//       file !== basename &&
//       file.slice(-3) === '.js' &&
//       file.indexOf('.test.js') === -1
//     );
//   })
//   .forEach(file => {
//     const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
//     db[model.name] = model;
//   });

// Object.keys(db).forEach(modelName => {
//   if (db[modelName].associate) {
//     db[modelName].associate(db);
//   }
// });

// db.sequelize = sequelize;
// db.Sequelize = Sequelize;

// export default db;


import sequelize from "../../config/sequelize.js";

import User from "./User.js";
import Category from "./Category.js";
import Product from "./Product.js";
import ProductImage from "./ProductImage.js";
import Review from "./Review.js";
import ReviewImage from "./ReviewImage.js";
import Wishlist from "./Wishlist.js";
import Cart from "./Cart.js";
import Order from "./Order.js";
import OrderItem from "./OrderItem.js";
import Wallet from "./Wallet.js";
import WalletTransaction from "./WalletTransaction.js";
/* =======================
   ASSOCIATIONS
======================= */

// User -> Products
User.hasMany(Product, { foreignKey: "vendor_id", as: "products" });
Product.belongsTo(User, { foreignKey: "vendor_id", as: "vendor" });

// User -> Categories
User.hasMany(Category, { foreignKey: "vendor_id" });
Category.belongsTo(User, { foreignKey: "vendor_id", as: "vendor" });

// Category -> Products
Category.hasMany(Product, { foreignKey: "category_id" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });

// Product -> Images
Product.hasMany(ProductImage, {
  foreignKey: "product_id",
  as: "images"
});
ProductImage.belongsTo(Product, { foreignKey: "product_id" });

// Product -> Reviews
Product.hasMany(Review, {
  foreignKey: "product_id",
  as: "reviews"
});
Review.belongsTo(Product, { foreignKey: "product_id" });

// User -> Reviews
User.hasMany(Review, { foreignKey: "user_id" });
Review.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Review -> Images
Review.hasMany(ReviewImage, {
  foreignKey: "review_id",
  as: "images"
});
ReviewImage.belongsTo(Review, { foreignKey: "review_id" });

// User <-> Wishlist
User.belongsToMany(Product, {
  through: Wishlist,
  foreignKey: "user_id",
  as: "wishlistProducts"
});
Product.belongsToMany(User, {
  through: Wishlist,
  foreignKey: "product_id"
});

// User <-> Cart
User.belongsToMany(Product, {
  through: Cart,
  foreignKey: "user_id",
  as: "cartProducts"
});
Product.belongsToMany(User, {
  through: Cart,
  foreignKey: "product_id"
});



Order.hasMany(OrderItem, {
  foreignKey: "order_id",
  as: "items"
});

OrderItem.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order"
});

Product.hasMany(OrderItem, {
  foreignKey: "product_id",
  as: "order_items"
});

OrderItem.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product"
});


// Cart → Product 
Cart.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product"
});

// Cart → User (consistency)
Cart.belongsTo(User, {
  foreignKey: "user_id",
  as: "user"
});


// Wallet associations
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });

export {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
  Review,
  ReviewImage,
  Wishlist,
  Cart,
  Order,
  OrderItem,Wallet,WalletTransaction
};
