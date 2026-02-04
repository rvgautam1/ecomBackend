import { where } from "sequelize";
import {
  Wallet,
  WalletTransaction,
  User,
  sequelize,
  Order,
} from "../../db/models/index.js";
import CustomError from "../../utils/customError.js";
import { Transaction } from "sequelize";

class WalletService {
  // create wallet for user

  async createWallet(userId) {
    const existingWallet = await Wallet.findOne({ where: { user_id: userId } });

    if (existingWallet) {
      return existingWallet;
    }

    const wallet = await Wallet.create({
      user_id: userId,
      balance: 0.0,
      currency: "INR",
      version: 0,
    });

    return wallet;
  }

  // get wallet balance
  async getWalletBalance(userId) {
    let wallet = await Wallet.findOne({
      where: { user_id: userId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!wallet) {
      wallet = await this.createWallet(userId);
    }

    return {
      wallet_id: wallet.id,
      user_id: wallet.user_id,
      balance: parseFloat(wallet.balance),
      locked_balance: parseFloat(wallet.locked_balance),
      available_balance:
        parseFloat(wallet.balance) - parseFloat(wallet.locked_balance),
      currency: wallet.currency,
      is_active: wallet.is_active,
      version: wallet.version,
    };
  }

  //atomic credit with the version control

  async creaditWallet(
    userId,
    amount,
    source,
    description,
    metadata = {},
    maxRetries = 3,
  ) {
    let attempt = 0;
    while (attempt < maxRetries) {
      const transaction = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      });

      try {
        // read current wallet state 
        let wallet = await Wallet.findOne({
          where: { user_id: userId },
          lock: transaction.LOCK.UPDATE, // lock the transaction for perticular process 
          transaction,
        });

        if (!wallet) {
          wallet = await this.createWallet(userId);
          wallet = await Wallet.findOne({
            where: { user_id: userId },
            lock: transaction.LOCK.UPDATE,
            transaction,
          });
        }

        if (!wallet.is_active) {
          throw CustomError.badRequest("Wallet is inactive");
        }

          // version check + calculate new balance
        const currentVersion = wallet.version;
        const balanceBefore = parseFloat(wallet.balance);
        const creditAmount = parseFloat(amount);
        const balanceAfter = balanceBefore + creditAmount;

        // update with version check
        const [updatedRows] = await Wallet.update(
          {
            balance: balanceAfter,
            version: currentVersion + 1,
          },
          {
            where: {
              id: wallet.id,
              version: currentVersion, // version should be match
            },
            transaction,
          },
        );

        // if version not match then retrying
        if (updatedRows === 0) {
          await transaction.rollback();
          attempt++;
          console.log(
            `Version conflict on credit attempt ${attempt}. Retrying...`,
          );

          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          continue;
        }

        // Create transaction record(ledger-> never delete or update the transaction)
        const walletTxn = await WalletTransaction.create(
          {
            wallet_id: wallet.id,
            transaction_type: "credit",
            amount: creditAmount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            transaction_source: source,
            reference_type: metadata.reference_type || null,
            reference_id: metadata.reference_id || null,
            description,
            metadata,
            status: "completed",
          },
          { transaction },
        );

        await transaction.commit();
        return {
          transaction_id: walletTxn.id,
          wallet_id: wallet.id,
          amount: creditAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_type: "credit",
          source,
          description,
          version: currentVersion + 1,
        };
      } catch (error) {
        await transaction.rollback();
        if (attempt >= maxRetries - 1) {
          throw error;
        }
        attempt++;
      }
    }

    throw CustomError.serverError(
      "Failed to credit wallet after multiple retries",
    );
  }
  // Atomic Debit with version control

  async debitWallet(
    userId,
    amount,
    source,
    description,
    metadata = {},
    maxRetries = 3,
  ) {
    let attempt = 0;
    while (attempt < maxRetries) {
      const transaction = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      });

      try {
        const wallet = await Wallet.findOne({
          where: { user_id: userId },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });

        if (!wallet) {
          throw CustomError.notFound("Wallet not found");
        }

        if (!wallet.is_active) {
          throw CustomError.badRequest("Wallet is inactive");
        }

        const currentVersion = wallet.version;
        const balanceBefore = parseFloat(wallet.balance);
        const debitAmount = parseFloat(amount);
        const availableBalance =
          balanceBefore - parseFloat(wallet.locked_balance);

        if (availableBalance < debitAmount) {
          throw CustomError.badRequest(
            `Insufficient balance. Available: ${availableBalance}`,
          );
        }

        const balanceAfter = balanceBefore - debitAmount;

        // update with version check(optimistic locking )
        const [updatedRows] = await Wallet.update(
          {
            balance: balanceAfter,
            version: currentVersion + 1,
          },
          {
            where: {
              id: wallet.id,
              version: currentVersion, // version must be match
            },
            transaction,
          },
        );

        // if version mismatched , retry
        if (updatedRows === 0) {
          await transaction.rollback();
          attempt++;
          console.log(
            `Version conflict on debit attempt ${attempt}. Retrying....`,
          );

          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          continue;
        }

        // Create immutable(never change ) transaction record
        const walletTxn = await WalletTransaction.create(
          {
            wallet_id: wallet.id,
            transaction_type: "debit",
            amount: debitAmount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            transaction_source: source,
            reference_type: metadata.reference_type || null,
            reference_id: metadata.reference_id || null,
            description,
            metadata,
            status: "completed",
          },
          { transaction },
        );

        await transaction.commit();

        return {
          transaction_id: walletTxn.id,
          wallet_id: wallet.id,
          amount: debitAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_type: "debit",
          source,
          description,
          version: currentVersion + 1,
        };
      } catch (error) {
        await transaction.rollback();
        if (attempt >= maxRetries - 1) {
          throw error;
        }
        attempt++;
      }
    }

    throw CustomError.serverError(
      "Failed to debit wallet after multiple retries",
    );
  }

  // get transaction history
  async getTransactionHistory(userId, filter = {}) {
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return { total: 0, transaction: [] };
    }

    const { page = 1, limit = 20, type, source } = filter;
    const offset = (page - 1) * limit;

    const where = { wallet_id: wallet.id };
    if (type) where.transaction_type = type;
    if (source) where.transaction_source = source;

    const { count, rows: transaction } =
      await WalletTransaction.findAndCountAll({
        where,
        Order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(count / limit), // give total page and ceil -> rounds up to nearest whole number
      transactions: transaction.map((txn) => ({
        id: txn.id,
        type: txn.transaction_type,
        amount: parseFloat(txn.amount),
        balance_before: parseFloat(txn.balance_before),
        balance_after: parseFloat(txn.balance_after),
        source: txn.transaction_source,
        description: txn.description,
        status: txn.status,
        created_at: txn.created_at,
      })),
    };
  }

  // lock balance with version control

  async lockBalance(userId, amount, metadata = {}, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
      const transaction = await sequelize.transaction();

      try {
        const wallet = await Wallet.findOne({
          where: { user_id: userId },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });
        if (!wallet) {
          throw CustomError.notFound("Wallet not found ");
        }

        const currentVersion = wallet.version;
        const availableBalance =
          parseFloat(wallet.balance) - parseFloat(wallet.locked_balance);
        if (availableBalance < parseFloat(amount)) {
          throw CustomError.badRequest("Insufficient available balance");
        }

        const [updatedRows] = await Wallet.update(
          {
            locked_balance:
              parseFloat(wallet.locked_balance) + parseFloat(amount),
            version: currentVersion + 1,
          },
          {
            where: {
              id: wallet.id,
              version: currentVersion,
            },
            transaction,
          },
        );

        if (updatedRows === 0) {
          await transaction.rollback();
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          continue;
        }

        await transaction.commit();
        return true;
      } catch (error) {
        await transaction.rollback();
        if (attempt >= maxRetries - 1) {
          throw error;
        }

        attempt++;
      }
    }

    throw CustomError.serverError(
      "Failed to lock balance after multiple retries",
    );
  }

  // unlock with the version control

  async unlockBalance(userId, amount, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
      const transaction = await sequelize.transaction();

      try {
        const wallet = await Wallet.findOne({
          where: { user_id: userId },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });

        if (!wallet) {
          throw CustomError.notFound("Wallet not found");
        }

        const currentVersion = wallet.version;
        const [updatedRows] = await Wallet.update(
          {
            locked_balance: Math.max(
              0,
              parseFloat(wallet.locked_balance) - parseFloat(amount),
            ),
            version: currentVersion + 1,
          },
          {
            where: {
              id: wallet.id,
              version: currentVersion,
            },
            transaction,
          },
        );

        if (updatedRows === 0) {
          await transaction.rollback();
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          continue;
        }

        await transaction.commit();
        return true;
      } catch (error) {
        await transaction.rollback();
        if (attempt >= maxRetries - 1) {
          throw error;
        }
        attempt++;
      }
    }

    throw CustomError.serverError(
      "Failed to unlock balance after the multiple retries!",
    );
  }

  // refund to wallet

  async refundToWallet(userId, orderId, amount, description) {
    return await this.creaditWallet(
      userId,
      amount,
      "refund",
      description || `Refund for order #${orderId}`,
      {
        reference_type: "orders",
        reference_id: orderId,
      },
    );
  }

  // Add Cashback

  async addCashBack(userId, orderId, amount, description) {
    return await this.creaditWallet(
      userId,
      amount,
      "cashback",
      description || `Cashback for order #${orderId}`,
      {
        reference_type: "orders",
        reference_id: orderId,
      },
    );
  }

  // Process order payment from wallet
  async processOrderPayment(userId, orderId, amount) {
    return await this.debitWallet(
      userId,
      amount,
      "Order_payment",
      `Payment for order #${orderId}`,
      {
        reference_type: "orders",
        reference_id: orderId,
      },
    );
  }
}

export default new WalletService();
