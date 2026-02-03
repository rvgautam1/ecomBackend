// const pool = require("../config/database");

// class ProductService {
//   async getAllProducts(filters) {
//     const { category, vendor, search, limit = 20, offset = 0 } = filters;

//     let query = `
//       SELECT p.*, c.name as category_name, u.name as vendor_name,
//       COALESCE(AVG(r.rating), 0) as avg_rating,
//       COUNT(DISTINCT r.id) as review_count,
//       json_agg(DISTINCT jsonb_build_object('id', pi.id, 'url', pi.image_url, 'is_primary', pi.is_primary))
//       FILTER (WHERE pi.id IS NOT NULL) as images
//       FROM products p
//       LEFT JOIN categories c ON p.category_id = c.id
//       LEFT JOIN users u ON p.vendor_id = u.id
//       LEFT JOIN reviews r ON p.id = r.product_id
//       LEFT JOIN product_images pi ON p.id = pi.product_id
//       WHERE 1=1
//     `;

//     const params = [];
//     let paramIndex = 1;

//     if (category) {
//       query += ` AND p.category_id = $${paramIndex}`;

//       params.push(category);
//       paramIndex++;
//     }

//     if (vendor) {
//       query += ` AND p.vendor_id = $${paramIndex}`;
//       params.push(vendor);

//       paramIndex++;
//     }

//     if (search) {
//       query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`; //ILIKE => case sensitive serch in postgres
//       params.push(`%${search}%`);
//       paramIndex++;
//     }

//     query += ` GROUP BY p.id, c.name, u.name ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//     params.push(limit, offset);

//     const products = await pool.query(query, params);
//     return products.rows;
//   }

//   async getProductById(productId) {
//     const product = await pool.query(
//       `SELECT p.*, c.name as category_name, u.name as vendor_name, u.email as vendor_email,

//       COALESCE(AVG(r.rating), 0) as avg_rating,

//       COUNT(DISTINCT r.id) as review_count,

//       json_agg(DISTINCT jsonb_build_object('id', pi.id, 'url', pi.image_url, 'is_primary', pi.is_primary))

//       FILTER (WHERE pi.id IS NOT NULL) as images
//       FROM products p

//       LEFT JOIN categories c ON p.category_id = c.id

//       LEFT JOIN users u ON p.vendor_id = u.id

//       LEFT JOIN reviews r ON p.id = r.product_id

//       LEFT JOIN product_images pi ON p.id = pi.product_id

//       WHERE p.id = $1

//       GROUP BY p.id, c.name, u.name, u.email`,
//       [productId],
//     );

//     if (product.rows.length === 0) {
//       throw new Error("Product not found");
//     }

//     return product.rows[0];
//   }

//   async createProduct(productData, vendorId, imageFiles) {
//     const { name, description, price, stock, category_id } = productData;

//     const product = await pool.query(
//       "INSERT INTO products (name, description, price, stock, category_id, vendor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
//       [name, description, price, stock || 0, category_id, vendorId],
//     );

//     if (imageFiles && imageFiles.length > 0) {
//       for (let i = 0; i < imageFiles.length; i++) {
//         await pool.query(
//           "INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1, $2, $3)",
//           [
//             product.rows[0].id,

//             `/uploads/products/${imageFiles[i].filename}`,
//             i === 0,
//           ],
//         );
//       }
//     }

//     return product.rows[0];
//   }

//   async updateProduct(productId, vendorId, updates) {
//     const { name, description, price, stock, category_id } = updates;

//     const productExists = await pool.query(
//       "SELECT * FROM products WHERE id = $1 AND vendor_id = $2",
//       [productId, vendorId],
//     );

//     if (productExists.rows.length === 0) {
//       throw new Error("Product not found or you do not have permission");
//     }

//     const updated = await pool.query(
//       `UPDATE products SET
//         name = COALESCE($1, name),
//         description = COALESCE($2, description),
//         price = COALESCE($3, price),
//         stock = COALESCE($4, stock),
//         category_id = COALESCE($5, category_id),
//         updated_at = CURRENT_TIMESTAMP
//       WHERE id = $6 AND vendor_id = $7
//       RETURNING *`,
//       [name, description, price, stock, category_id, productId, vendorId],
//     );

//     return updated.rows[0];
//   }

//   async deleteProduct(productId, vendorId) {
//     const result = await pool.query(
//       "DELETE FROM products WHERE id = $1 AND vendor_id = $2 RETURNING id",
//       [productId, vendorId],
//     );

//     if (result.rows.length === 0) {
//       throw new Error("product not found or not have permission ");
//     }

//     return { message: "Product deleted successfully" };
//   }

//   async getVendorProducts(vendorId) {
//     const products = await pool.query(
//       `SELECT p.*, c.name as category_name,
//       COALESCE(AVG(r.rating), 0) as avg_rating,
//       COUNT(DISTINCT r.id) as review_count
//       FROM products p
//       LEFT JOIN categories c ON p.category_id = c.id

//       LEFT JOIN reviews r ON p.id = r.product_id

//       WHERE p.vendor_id = $1
//       GROUP BY p.id, c.name
//       ORDER BY p.created_at DESC`,
//       [vendorId],
//     );

//     return products.rows;
//   }

//   async checkProductAvailability(productId, quantity) {
//     const product = await pool.query(
//       "SELECT stock FROM products WHERE id = $1",
//       [productId],
//     );

//     if (product.rows.length === 0) {
//       throw new Error("Product not found");
//     }

//     return product.rows[0].stock >= quantity;
//   }
// }

// export default new ProductService();

import {
  Product,
  User,
  Category,
  ProductImage,
  Review,
} from "../../db/models/index.js";
import { Op } from "sequelize";
import CustomError from "../../utils/customError.js";
import sequelize from "../../config/sequelize.js";

class ProductService {
  async createProduct(productData, vendorId, imageFiles = []) {
    const { name, description, price, stock, category_id } = productData;

    if (!name || !price) {
      throw CustomError.badRequest("Product name and price are required");
    }

    if (price <= 0) {
      throw CustomError.badRequest("Price must be greater than 0");
    }

    // Validate vendor exists
    const vendor = await User.findByPk(vendorId);
    if (!vendor || vendor.role !== "vendor") {
      throw CustomError.forbidden("Valid vendor required");
    }

    // Validate category if provided
    let validatedCategoryId = null;
    if (category_id) {
      const category = await Category.findByPk(category_id);
      if (!category) {
        throw CustomError.badRequest(
          `Category with id ${category_id} does not exist`,
        );
      }

      // Check vendor owns category
      if (category.vendor_id !== vendorId) {
        throw CustomError.forbidden("You can only use your own categories");
      }
      validatedCategoryId = category_id;
    }

    // Use transaction for atomicity
    const transaction = await sequelize.transaction();
    try {
      // Create product (category_id is validated or null)
      const product = await Product.create(
        {
          name,
          description,
          price,
          stock: stock || 0,
          category_id: validatedCategoryId,
          vendor_id: vendorId,
        },
        { transaction },
      );

      // Add images if provided
      if (imageFiles.length > 0) {
        const images = imageFiles.map((file, index) => ({
          product_id: product.id,
          image_url: `/uploads/products/${file.filename}`,
          is_primary: index === 0,
        }));
        await ProductImage.bulkCreate(images, { transaction });
      }

      await transaction.commit();
      return product;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getAllProducts(filters = {}) {
    const { category, vendor, search, limit = 20, offset = 0 } = filters;

    const where = {};
    if (category) where.category_id = category;
    if (vendor) where.vendor_id = vendor;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const products = await Product.findAll({
      where,
      include: [
        {
          model: User,
          as: "vendor",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "image_url", "is_primary"],
          required: false,
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    return products;
  }

  async getProductById(productId) {
    const product = await Product.findByPk(productId, {
      include: [
        {
          model: User,
          as: "vendor",
          attributes: ["id", "name", "email"],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: ProductImage,
          as: "images",
        },
      ],
    });

    if (!product) {
      throw CustomError.notFound("Product not found");
    }
    return product;
  }

  async getVendorProducts(vendorId) {
    return await Product.findAll({
      where: { vendor_id: vendorId },
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: ProductImage,
          as: "images",
          where: { is_primary: true },
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });
  }

  async updateProduct(productId, vendorId, updates) {
    const product = await Product.findOne({
      where: { id: productId, vendor_id: vendorId },
    });

    if (!product) {
      throw CustomError.notFound(
        "Product not found or you do not have permission",
      );
    }

    // Validate category update
    if (updates.category_id) {
      const category = await Category.findByPk(updates.category_id);
      if (!category) {
        throw CustomError.badRequest(
          `Category with id ${updates.category_id} does not exist`,
        );
      }
      if (category.vendor_id !== vendorId) {
        throw CustomError.forbidden("You can only use your own categories");
      }
    }

    await product.update(updates);
    return product;
  }

  async deleteProduct(productId, vendorId) {
    const product = await Product.findOne({
      where: { id: productId, vendor_id: vendorId },
    });

    if (!product) {
      throw CustomError.notFound(
        "Product not found or you do not have permission",
      );
    }

    await product.destroy();
    return { message: "Product deleted successfully" };
  }
}

export default new ProductService();
