// const pool = require('../config/database');

// class CategoryService {
//   async getAllCategories() {
//     const categories = await pool.query(
//       `SELECT c.*, u.name as vendor_name, COUNT(p.id) as product_count
//       FROM categories c
//       LEFT JOIN users u ON c.vendor_id = u.id
//       LEFT JOIN products p ON c.id = p.category_id
//       GROUP BY c.id, u.name
//       ORDER BY c.created_at DESC`
//     );

//     return categories.rows;
//   }

//   async getCategoryById(categoryId) {
//     const category = await pool.query(
//       `SELECT c.*, u.name as vendor_name, COUNT(p.id) as product_count
//       FROM categories c
//       LEFT JOIN users u ON c.vendor_id = u.id
//       LEFT JOIN products p ON c.id = p.category_id
//       WHERE c.id = $1
//       GROUP BY c.id, u.name`,
//       [categoryId]
//     );

//     if (category.rows.length === 0) {
//       throw new Error('Category not found');
//     }

//     return category.rows[0];
//   }

//   async createCategory(categoryData, vendorId) {
//     const { name, description } = categoryData;

//     const category = await pool.query(
//       'INSERT INTO categories (name, description, vendor_id) VALUES ($1, $2, $3) RETURNING *',
//       [name, description, vendorId]
//     );

//     return category.rows[0];
//   }

//   async updateCategory(categoryId, vendorId, updates) {
//     const { name, description } = updates;

//     const updated = await pool.query(
//       `UPDATE categories SET 
//         name = COALESCE($1, name),
//         description = COALESCE($2, description)
//       WHERE id = $3 AND vendor_id = $4
//       RETURNING *`,
//       [name, description, categoryId, vendorId]
//     );

//     if (updated.rows.length === 0) {
//       throw new Error('Category not found or you do not have permission');
//     }

//     return updated.rows[0];
//   }

//   async deleteCategory(categoryId, vendorId) {
//     const result = await pool.query(
//       'DELETE FROM categories WHERE id = $1 AND vendor_id = $2 RETURNING id',
//       [categoryId, vendorId]
//     );

//     if (result.rows.length === 0) {
//       throw new Error('Category not found or you do not have permission');
//     }

//     return { message: 'Category deleted successfully' };
//   }
// }

// module.exports = new CategoryService();


import { Category, User} from "../../db/models/index.js";
import CustomError from "../../utils/customError.js";

class CategoryService {
  async getVendorCategories(vendorId) {
    return await Category.findAll({
      where: { vendor_id: vendorId },
      attributes: ['id', 'name', 'description', 'created_at']
    });
  }

  async getAllCategories() {
    return await Category.findAll({
      include: [
        { model: User, as: 'vendor', attributes: ['id', 'name'] }
      ],
      order: [['name', 'ASC']]
    });
  }

  async createCategory(categoryData, vendorId) {
    const { name, description } = categoryData;

    if (!name) {
      throw CustomError.badRequest('Category name is required');
    }

    return await Category.create({
      name,
      description,
      vendor_id: vendorId
    });
  }

  async getCategoryById(categoryId) {
    const category = await Category.findByPk(categoryId, {
      include: [
        { model: User, as: 'vendor', attributes: ['id', 'name'] }
      ]
    });

    if (!category) {
      throw CustomError.notFound('Category not found');
    }
    return category;
  }
}

export default new CategoryService();
