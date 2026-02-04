'use strict';

export async function up(queryInterface, Sequelize) {
  // For PostgreSQL - Add 'admin' to existing ENUM
  await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'admin';
    `);
}
export async function down(queryInterface, Sequelize) {
  // Removing ENUM values is complex in PostgreSQL
  // Usually not recommended in production
  console.log('Downgrade not supported for ENUM values');
}
