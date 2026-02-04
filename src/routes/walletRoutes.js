import express from "express";
import { authenticateUser, isAdmin } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  addMoneySchema,
  transactionHistorySchema,
} from "../schema/walletSchemas.js";
import {
  getBalance,
  getTransactions,
  addMoney,
  deductMoney,
} from "../rest-resources/controllers/walletController.js";

const router = express.Router();

// authenticate the user
router.use(authenticateUser);

// user routes 
router.get('/balance', getBalance);
router.get('/transactions', validate(transactionHistorySchema),getTransactions);

// admin routes 

router.post('/:userId/credit' , isAdmin , validate(addMoneySchema), addMoney);
router.post('/:userId/debit', isAdmin , validate(addMoneySchema), deductMoney)



export default router;