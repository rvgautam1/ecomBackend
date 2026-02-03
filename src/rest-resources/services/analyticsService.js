import {
  Order,
  OrderItem,
  Product,
  sequelize,
} from "../../db/models/index.js";
import { Op } from "sequelize";

class AnalyticsService {
  //  Get sales summary by time period
  async getSalesSummary(vendorId, period = "24h") {
    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const startDate = new Date(Date.now() - timeRanges[period]);

    const sales = await Order.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("Order.id")), "total_orders"],
        [
          sequelize.fn("SUM", sequelize.col("Order.total_amount")),
          "total_revenue",
        ], //
        [
          sequelize.fn("AVG", sequelize.col("Order.total_amount")),
          "average_order_value",
        ], //
      ],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [],
          include: [
            {
              model: Product,
              as: "product",
              attributes: [],
              where: vendorId ? { vendor_id: vendorId } : {},
              required: true,
            },
          ],
        },
      ],
      where: {
        created_at: { [Op.gte]: startDate },
        payment_status: "completed",
      },
      raw: true,
    });

    return {
      period,
      start_date: startDate,
      end_date: new Date(),

      total_orders: parseInt(sales[0].total_orders) || 0,

      total_revenue: parseFloat(sales[0].total_revenue) || 0,
      average_order_value: parseFloat(sales[0].average_order_value) || 0,
    };
  }

  //  Get top selling products

  async getTopSellingProducts(vendorId, limitValue = 10, period = "30d") {
    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      all: null,
    };

    const whereConditions = { payment_status: "completed" };

    if (timeRanges[period]) {
      const startDate = new Date(Date.now() - timeRanges[period]);
      whereConditions.created_at = { [Op.gte]: startDate };
    }

    const productWhere = vendorId ? { vendor_id: vendorId } : {};

    const topProducts = await OrderItem.findAll({
      attributes: [
        "product_id",
        [
          sequelize.fn("SUM", sequelize.col("OrderItem.quantity")),
          "total_quantity",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal('"OrderItem"."quantity" * "OrderItem"."price"'),
          ),
          "total_revenue",
        ],
        [
          sequelize.fn(
            "COUNT",
            sequelize.fn("DISTINCT", sequelize.col("OrderItem.order_id")),
          ),
          "order_count",
        ],
      ],
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "price", "stock"],
          where: productWhere,
        },
        {
          model: Order,
          as: "order",
          attributes: [],
          where: whereConditions,
        },
      ],
      group: [
        "OrderItem.product_id",
        "product.id",
        "product.name",
        "product.price",
        "product.stock",
      ], //  : Include ALL non-aggregated columns
      order: [[sequelize.literal("total_quantity"), "DESC"]],
      limit: Number(limitValue),
      subQuery: false,
    });

    return topProducts.map((item) => ({
      product_id: item.product_id,
      product_name: item.product.name,
      current_price: parseFloat(item.product.price),
      current_stock: item.product.stock,
      total_quantity_sold: parseInt(item.get("total_quantity")),
      total_revenue: parseFloat(item.get("total_revenue")),
      number_of_orders: parseInt(item.get("order_count")),
    }));
  }

  //  Get daily sales breakdown
  async getDailySales(vendorId, daysCount = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    startDate.setHours(0, 0, 0, 0);

    const productWhere = vendorId ? { vendor_id: vendorId } : {};

    const dailySales = await Order.findAll({
      attributes: [
        [sequelize.fn("DATE", sequelize.col("Order.created_at")), "date"],
        [sequelize.fn("COUNT", sequelize.col("Order.id")), "orders"],
        [sequelize.fn("SUM", sequelize.col("Order.total_amount")), "revenue"],
      ],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [],
          include: [
            {
              model: Product,
              as: "product",
              attributes: [],
              where: productWhere,
              required: true,
            },
          ],
        },
      ],
      where: {
        created_at: { [Op.gte]: startDate },
        payment_status: "completed",
      },
      group: [sequelize.fn("DATE", sequelize.col("Order.created_at"))],
      order: [[sequelize.fn("DATE", sequelize.col("Order.created_at")), "ASC"]],
      raw: true,
    });

    return dailySales.map((day) => ({
      date: day.date,
      orders: parseInt(day.orders),
      revenue: parseFloat(day.revenue),
    }));
  }

  //  Get total sales
  async getTotalSales(vendorId) {
    const productWhere = vendorId ? { vendor_id: vendorId } : {};

    const total = await Order.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("Order.id")), "total_orders"],
        [
          sequelize.fn("SUM", sequelize.col("Order.total_amount")),
          "total_revenue",
        ],
      ],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [],
          include: [
            {
              model: Product,
              as: "product",
              attributes: [],
              where: productWhere,
              required: true,
            },
          ],
        },
      ],
      where: {
        payment_status: "completed",
      },
      raw: true,
    });

    return {
      total_orders: parseInt(total[0].total_orders) || 0,
      total_revenue: parseFloat(total[0].total_revenue) || 0,
    };
  }

  //  Get sales by payment method
  async getSalesByPaymentMethod(vendorId, period = "30d") {
    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const startDate = new Date(Date.now() - timeRanges[period]);
    const productWhere = vendorId ? { vendor_id: vendorId } : {};

    const paymentStats = await Order.findAll({
      attributes: [
        "payment_method",
        [sequelize.fn("COUNT", sequelize.col("Order.id")), "count"],
        [sequelize.fn("SUM", sequelize.col("Order.total_amount")), "revenue"],
      ],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [],
          include: [
            {
              model: Product,
              as: "product",
              attributes: [],
              where: productWhere,
              required: true,
            },
          ],
        },
      ],
      where: {
        created_at: { [Op.gte]: startDate },
        payment_status: "completed",
      },
      group: ["payment_method"],
      raw: true,
    });

    return paymentStats.map((stat) => ({
      payment_method: stat.payment_method,
      orders: parseInt(stat.count),
      revenue: parseFloat(stat.revenue),
    }));
  }
}

export default new AnalyticsService();
