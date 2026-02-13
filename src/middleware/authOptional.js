import { verifyToken } from "../config/jwt.js";

export const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token && token !== 'null' && token !== 'undefined') {
        try {
          const decoded = verifyToken(token);
          req.user = decoded;
          // console.log(`User ${decoded.id} authenticated via optional middleware`);
        } catch (error) {
          req.user = null;
        }
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};