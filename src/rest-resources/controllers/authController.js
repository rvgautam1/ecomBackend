import AuthService from "../services/authService.js";
import cartService from "../services/cartService.js";
import sessionService from "../../utils/sessionService.js";

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const result = await AuthService.registerUser({
      name,
      email,
      password,
      role,
      phone
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required"
      });
    }

    const result = await AuthService.loginUser({ email, password });

    // Get session ID from request (guest cart identifier)
    const sessionId = req.sessionId || req.cookies?.sessionId;
    
    // Merge guest cart with user's cart after successful login
    if (sessionId && result.user) {
      try {
        await cartService.mergeCarts(result.user.id, sessionId);
        console.log(` Guest cart merged for user ${result.user.id}`);
      } catch (mergeError) {
        console.error(' Cart merge failed:', mergeError.message);
        // Don't fail login if cart merge fails
      }
    }

    res.status(200).json({
      success: true,
      message: "User logged in",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await AuthService.getUserById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// O Logout endpoint to clear session 
export const logout = async (req, res, next) => {
  try {
    // Clear session cookie
    res.clearCookie('sessionId', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    next(error);
  }
};