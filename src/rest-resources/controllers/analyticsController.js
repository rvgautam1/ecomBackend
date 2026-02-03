import analyticsService from "../services/analyticsService.js";


// get sales summary
 export   const getSalesSummary = async (req, res, next) => {
  try {
    const vendorId = req.user.role === "vendor" ? req.user.id : null;
    const { period = "24h" } = req.query; // it can be 7d, 30d

    const summary = await analyticsService.getSalesSummary(vendorId, period);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

// top selling products
 export const getTopProducts = async (req, res, next) => {
  try {
    const vendorId = req.user.role === "vendor" ? req.user.id : null;
    const { limit = 10, period = "30d" } = req.query;

    const products = await analyticsService.getTopSellingProducts(
      vendorId,
      limit,
      period,
    );

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/// get daily sales
 export const getDailySales = async (req, res, next) => {
  try {
    const vendorId = req.user.role === "vendor" ? req.user.id : null;
    const { days = 7 } = req.query;

    const sales = await analyticsService.getDailySales(vendorId, days);

    res.json({
      success: true,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

/// get totoalsales
 export const getTotalSales = async (req, res, next) => {
  try {
    const vendorId = req.user.role === "vendor" ? req.user.id : null;

    const total = await analyticsService.getTotalSales(vendorId);

    res.json({
      success: true,
      data: total,
    });
  } catch (error) {
    next(error);
  }
};

/// get sales by payment method
export const getSalesByPayment = async (req, res, next) => {
  try {
    const vendorId = req.user.role === "vendor" ? req.user.id : null;
    const { period = "30d" } = req.query;

    const stats = await analyticsService.getSalesByPaymentMethod(
      vendorId,
      period,
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

