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
import { sendToUser } from "../../socket/socketServer.js";

class WalletService {
  // Create a new wallet for a user
  // If wallet already exists, return the existing one
  // Parameters:
  // - userId: ID of the user for whom to create wallet
  // Returns: Wallet object with initial zero balance
  async createWallet(userId) {
    const existingWallet = await Wallet.findOne({ where: { user_id: userId } });

    if (existingWallet) {
      return existingWallet;
    }

    const wallet = await Wallet.create({
      user_id: userId,
      balance: 0.0,
      currency: "INR",
      version: 0, // Used for optimistic locking to prevent race conditions
    });

    return wallet;
  }

  // Get current wallet balance and details for a user
  // Automatically creates wallet if it doesn't exist
  // Parameters:
  // - userId: ID of the user
  // Returns: Object with wallet details including available balance
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

    // Auto-create wallet if it doesn't exist
    if (!wallet) {
      wallet = await this.createWallet(userId);
    }

    return {
      wallet_id: wallet.id,
      user_id: wallet.user_id,
      balance: parseFloat(wallet.balance),
      locked_balance: parseFloat(wallet.locked_balance),
      // Available balance is total minus locked amount
      available_balance:
        parseFloat(wallet.balance) - parseFloat(wallet.locked_balance),
      currency: wallet.currency,
      is_active: wallet.is_active,
      version: wallet.version,
    };
  }

  // Add money to wallet with atomic transaction and version control
  // Uses optimistic locking with retry mechanism to handle concurrent updates
  // Parameters:
  // - userId: ID of the user
  // - amount: Amount to credit
  // - source: Source of credit (e.g., 'gift_card', 'refund', 'cashback')
  // - description: Human-readable description
  // - metadata: Additional data (reference_type, reference_id, etc.)
  // - maxRetries: Maximum retry attempts on version conflicts (default: 3)
  // Returns: Transaction details with updated balance
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
      // Start transaction with SERIALIZABLE isolation to prevent phantom reads
      const transaction = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      });

      try {
        // Lock the wallet row to prevent concurrent modifications
        let wallet = await Wallet.findOne({
          where: { user_id: userId },
          lock: transaction.LOCK.UPDATE, // Pessimistic lock for this transaction
          transaction,
        });

        // Create wallet if it doesn't exist
        if (!wallet) {
          wallet = await this.createWallet(userId);
          wallet = await Wallet.findOne({
            where: { user_id: userId },
            lock: transaction.LOCK.UPDATE,
            transaction,
          });
        }

        // Validate wallet is active
        if (!wallet.is_active) {
          throw CustomError.badRequest("Wallet is inactive");
        }

        // Store current version for optimistic lock check
        const currentVersion = wallet.version;
        const balanceBefore = parseFloat(wallet.balance);
        const creditAmount = parseFloat(amount);
        const balanceAfter = balanceBefore + creditAmount;

        // Update balance with version check (optimistic locking)
        // This ensures no other transaction modified the wallet between read and write
        const [updatedRows] = await Wallet.update(
          {
            balance: balanceAfter,
            version: currentVersion + 1, // Increment version on each update
          },
          {
            where: {
              id: wallet.id,
              version: currentVersion, // Only update if version matches
            },
            transaction,
          },
        );

        // If version mismatch (another transaction updated first), retry
        if (updatedRows === 0) {
          await transaction.rollback();
          attempt++;
          console.log(
            `Version conflict on credit attempt ${attempt}. Retrying...`,
          );

          // Exponential backoff before retry
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          continue;
        }

        // Create immutable transaction record (audit trail)
        // This ledger entry should never be deleted or modified
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

        // Commit all changes atomically
        await transaction.commit();
        sendToUser(userId, "wallet_updated", {
          type: "credit",
          amount,
          balance: balanceAfter,
          message: `${amount} added to wallet`,
        });

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

        // If max retries reached, throw error
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

  // Deduct money from wallet with atomic transaction and version control
  // Validates sufficient available balance before deduction
  // Parameters:
  // - userId: ID of the user
  // - amount: Amount to debit
  // - source: Source of debit (e.g., 'order_payment', 'withdrawal')
  // - description: Human-readable description
  // - metadata: Additional data (reference_type, reference_id, etc.)
  // - maxRetries: Maximum retry attempts on version conflicts (default: 3)
  // Returns: Transaction details with updated balance
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
      // Start transaction with SERIALIZABLE isolation
      const transaction = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      });

      try {
        // Lock the wallet row for update
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

        // Calculate available balance (total minus locked)
        const availableBalance =
          balanceBefore - parseFloat(wallet.locked_balance);

        // Validate sufficient balance
        if (availableBalance < debitAmount) {
          throw CustomError.badRequest(
            `Insufficient balance. Available: ${availableBalance}`,
          );
        }

        const balanceAfter = balanceBefore - debitAmount;

        // Update balance with version check (optimistic locking)
        const [updatedRows] = await Wallet.update(
          {
            balance: balanceAfter,
            version: currentVersion + 1,
          },
          {
            where: {
              id: wallet.id,
              version: currentVersion, // Version must match
            },
            transaction,
          },
        );

        // If version mismatch, retry
        if (updatedRows === 0) {
          await transaction.rollback();
          attempt++;
          console.log(
            `Version conflict on debit attempt ${attempt}. Retrying...`,
          );

          // Exponential backoff before retry
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          continue;
        }

        // Create immutable transaction record (audit trail)
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

        // websocekt notification
        sendToUser(userId, "wallet_updated", {
          type: "debit",
          amount,
          balance: balanceAfter,
          message: `${amount} deducted from wallet`,
        });

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

  // Retrieve paginated transaction history for a user's wallet
  // Supports filtering by transaction type and source
  // Parameters:
  // - userId: ID of the user
  // - filter: Object containing page, limit, type, and source filters
  // Returns: Paginated list of transactions with metadata
  async getTransactionHistory(userId, filter = {}) {
    const wallet = await Wallet.findOne({ where: { user_id: userId } });

    // Return empty result if wallet doesn't exist
    if (!wallet) {
      return { total: 0, transactions: [] };
    }

    const { page = 1, limit = 20, type, source } = filter;
    const offset = (page - 1) * limit;

    // Build dynamic where clause based on filters
    const where = { wallet_id: wallet.id };
    if (type) where.transaction_type = type; // Filter by credit or debit
    if (source) where.transaction_source = source; // Filter by source

    const { count, rows: transaction } =
      await WalletTransaction.findAndCountAll({
        where,
        order: [["created_at", "DESC"]], // Most recent first
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(count / limit), // Round up to get total pages
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

  // Lock a portion of wallet balance temporarily
  // Used when order is placed but payment not yet confirmed
  // Locked balance cannot be used for other transactions
  // Parameters:
  // - userId: ID of the user
  // - amount: Amount to lock
  // - metadata: Additional context data
  // - maxRetries: Maximum retry attempts (default: 3)
  // Returns: True if successful
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
          throw CustomError.notFound("Wallet not found");
        }

        const currentVersion = wallet.version;

        // Calculate available balance (not locked)
        const availableBalance =
          parseFloat(wallet.balance) - parseFloat(wallet.locked_balance);

        // Validate sufficient available balance
        if (availableBalance < parseFloat(amount)) {
          throw CustomError.badRequest("Insufficient available balance");
        }

        // Increment locked balance with version check
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

        // Retry on version conflict
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

  // Release locked balance back to available balance
  // Called when order is cancelled or payment is confirmed
  // Parameters:
  // - userId: ID of the user
  // - amount: Amount to unlock
  // - maxRetries: Maximum retry attempts (default: 3)
  // Returns: True if successful
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

        // Decrease locked balance with version check
        // Math.max ensures locked balance never goes below zero
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

        // Retry on version conflict
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
      "Failed to unlock balance after multiple retries",
    );
  }

  // Process refund by crediting amount back to wallet
  // Wrapper around creaditWallet specifically for refunds
  // Parameters:
  // - userId: ID of the user
  // - orderId: ID of the order being refunded
  // - amount: Refund amount
  // - description: Optional custom description
  // Returns: Transaction details
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

  // Add cashback rewards to wallet
  // Wrapper around creaditWallet specifically for cashback
  // Parameters:
  // - userId: ID of the user
  // - orderId: ID of the order earning cashback
  // - amount: Cashback amount
  // - description: Optional custom description
  // Returns: Transaction details
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

  // Process order payment by debiting from wallet
  // Wrapper around debitWallet specifically for order payments
  // Parameters:
  // - userId: ID of the user
  // - orderId: ID of the order being paid
  // - amount: Payment amount
  // Returns: Transaction details
  async processOrderPayment(userId, orderId, amount) {
    return await this.debitWallet(
      userId,
      amount,
      "order_payment",
      `Payment for order #${orderId}`,
      {
        reference_type: "orders",
        reference_id: orderId,
      },
    );
  }
}

export default new WalletService();
