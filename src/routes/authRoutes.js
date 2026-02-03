import express from "express";
import { register, login, getProfile } from "../rest-resources/controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  registerSchema,
  loginSchema,
} from "../schema/authSchemas.js";

import validate from "../middleware/validate.js";

const router = express.Router();

// Public routes
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

// Protected route
router.get("/profile", authenticateUser, getProfile);

export default router;
