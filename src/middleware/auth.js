import { verifyToken } from "../config/jwt.js";


export const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided"
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};


export const isVendor = (req, res, next) => {
  if (req.user.role !== "vendor") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Vendor role required"
    });
  }
  next();
};


export const isUser = (req, res, next) => {
  if (req.user.role !== "user") {
    return res.status(403).json({
      success: false,
      message: "Access denied. User role required"
    });
  }
  next();
};



export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    throw CustomError.forbidden('Admin access required');
  }
  next();
};
