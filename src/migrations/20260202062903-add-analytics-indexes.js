'use strict';

export async function up(queryInterface, Sequelize) {
  //  Orders - for time-based queries
  await queryInterface.addIndex('orders', ['created_at'], {
    name: 'idx_orders_created_at'
  });

  //  Orders - composite index for sales by payment status and date
  await queryInterface.addIndex('orders', ['payment_status', 'created_at'], {
    name: 'idx_orders_payment_status_date'
  });

  //  Order Items - for product sales analysis
  await queryInterface.addIndex('order_items', ['product_id', 'created_at'], {
    name: 'idx_order_items_product_date'
  });

  //  Products - for search and filtering
  await queryInterface.addIndex('Products', ['name'], {
    name: 'idx_products_name',
    type: 'BTREE'
  });

  //  Products - for price-based queries
  await queryInterface.addIndex('Products', ['price'], {
    name: 'idx_products_price'
  });
}
export async function down(queryInterface, Sequelize) {
  await queryInterface.removeIndex('orders', 'idx_orders_created_at');
  await queryInterface.removeIndex('orders', 'idx_orders_payment_status_date');
  await queryInterface.removeIndex('order_items', 'idx_order_items_product_date');
  await queryInterface.removeIndex('Products', 'idx_products_name');
  await queryInterface.removeIndex('Products', 'idx_products_price');
}
