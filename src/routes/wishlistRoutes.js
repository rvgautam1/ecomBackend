import express from "express";
import { authenticateUser } from "../middleware/auth.js";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist
} from "../rest-resources/controllers/wishlistController.js";


const router = express.Router();

router.use(authenticateUser); // all wishlist routes authenticated

router.post('/', addToWishlist);
router.get('/' ,getWishlist);
router.delete('/:id', removeFromWishlist)

export default router;
