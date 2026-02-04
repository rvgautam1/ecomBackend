import walletService from '../services/walletService.js';

// Get wallet balance
const getBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const balance = await walletService.getWalletBalance(userId);

    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    next(error);
  }
};

// Get transaction history
const getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, type, source } = req.query;

    const history = await walletService.getTransactionHistory(userId, {
      page,
      limit,
      type,
      source
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

// Add money to wallet (Admin only)
const addMoney = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, description } = req.body;

    const result = await walletService.creaditWallet(
      parseInt(userId),
      amount,
      'admin_credit',
      description,
      {
        admin_id: req.user.id,
        admin_name: req.user.name
      }
    );

    res.json({
      success: true,
      message: `₹${amount} credited successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Deduct money from wallet (Admin only)
const deductMoney = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, description } = req.body;

    const result = await walletService.debitWallet(
      parseInt(userId),
      amount,
      'admin_debit',
      description,
      {
        admin_id: req.user.id,
        admin_name: req.user.name
      }
    );

    res.json({
      success: true,
      message: `₹${amount} debited successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export {
  getBalance,
  getTransactions,
  addMoney,
  deductMoney
};
