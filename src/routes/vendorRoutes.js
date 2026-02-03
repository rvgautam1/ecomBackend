import express from "express";
import { authenticateUser, isVendor } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  createCategory
} from "../rest-resources/controllers/vendorController.js";


const router = express.Router();

router.use(authenticateUser);

router.use(isVendor);


router.post('/products', upload.array('images', 5), createProduct);

router.put('/products/:id', updateProduct);

router.delete('/products/:id', deleteProduct);

router.get('/products', getVendorProducts);


router.post('/categories', createCategory);

export default router;
