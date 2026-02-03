import express from "express";

import { getAllCategories, getCategoryById ,createCategory, getVendorCategories} from '../rest-resources/controllers/categoryController.js';
import { authenticateUser } from "../middleware/auth.js";
import { isVendor } from "../middleware/auth.js";
const router = express.Router();


router.get('/', getAllCategories);

router.get('/:id', getCategoryById);

// Vendor routes
router.post('/', authenticateUser, isVendor, createCategory);
router.get('/vendor/my-categories', authenticateUser, isVendor,getVendorCategories);

export default router;
