import express from "express";
import { authenticateUser } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview
} from "../rest-resources/controllers/reviewController.js";

const router = express.Router();

// public
router.get("/product/:productId", getProductReviews);

// protected
router.post("/", authenticateUser, upload.array("images", 3), createReview);
router.put("/:id", authenticateUser, updateReview);
router.delete("/:id", authenticateUser, deleteReview);

export default router;
