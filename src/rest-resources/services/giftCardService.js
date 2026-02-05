import { GiftCard, sequelize } from "../../db/models/index.js";
import walletService from "./walletService.js";
import CustomError from "../../utils/customError.js";
import crypto from "crypto";

class GiftCardService {
  // Generate a unique gift card code using cryptographic random bytes
  // Format: GC + 16 uppercase hexadecimal characters
  // Example: GC4F2A8B3C1D5E6F7A
  generateCode() {
    return `GC${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  }

  // Create a single gift card (admin only operation)
  // Parameters:
  // - adminId: ID of the admin creating the gift card
  // - amount: Monetary value of the gift card
  // - expiresInDays: Number of days until expiration (default: 365)
  // Returns: Newly created gift card object
  async createGiftCard(adminId, amount, expiresInDays = 365) {
    const code = this.generateCode();

    // Calculate expiration date by adding days to current date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const giftCard = await GiftCard.create({
      code,
      amount: parseFloat(amount),
      balance: parseFloat(amount), // Initially balance equals full amount
      currency: "INR",
      status: "active",
      issued_by: adminId,
      expires_at: expiresAt,
    });

    return giftCard;
  }

  // Create multiple gift cards at once (bulk operation)
  // Parameters:
  // - adminId: ID of the admin creating the gift cards
  // - count: Number of gift cards to create
  // - amount: Value for each gift card
  // - expiresInDays: Days until expiration for all cards (default: 365)
  // Returns: Array of created gift card objects
  async bulkCreateGiftCards(adminId, count, amount, expiresInDays = 365) {
    const giftCards = [];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Build array of gift card objects to insert
    for (let i = 0; i < count; i++) {
      giftCards.push({
        code: this.generateCode(),
        amount: parseFloat(amount),
        balance: parseFloat(amount),
        currency: "INR",
        status: "active",
        issued_by: adminId,
        expires_at: expiresAt,
      });
    }

    // Insert all gift cards in one database operation for efficiency
    const created = await GiftCard.bulkCreate(giftCards);
    return created;
  }

  // Redeem a gift card and credit the balance to user's wallet
  // This is a transaction-safe operation to prevent race conditions
  // Parameters:
  // - userId: ID of the user redeeming the gift card
  // - code: Gift card code to redeem
  // Returns: Object with redemption details (code, amount, message)
  async redeemGiftCard(userId, code) {
    // Start database transaction to ensure data consistency
    const transaction = await sequelize.transaction();

    try {
      // Find and lock the gift card row to prevent concurrent redemptions
      const giftCard = await GiftCard.findOne({
        where: { code },
        lock: transaction.LOCK.UPDATE, // Pessimistic locking
        transaction,
      });

      // Validation: Check if gift card exists
      if (!giftCard) {
        throw CustomError.notFound("Gift card is not found");
      }

      // Validation: Check if gift card is active
      if (giftCard.status !== "active") {
        throw CustomError.badRequest(`Gift card is ${giftCard.status}`);
      }

      // Validation: Check if gift card has remaining balance
      if (giftCard.balance <= 0) {
        throw CustomError.badRequest("Gift card balance is zero");
      }

      // Validation: Check if gift card has expired
      if (giftCard.expires_at && new Date() > giftCard.expires_at) {
        // Update status to expired if not already marked
        await giftCard.update({ status: "expired" }, { transaction });
        throw CustomError.badRequest("Gift card has expired");
      }

      // Get the amount to credit (current balance)
      const redeemAmount = parseFloat(giftCard.balance);

      // Credit the gift card amount to user's wallet
      // This creates a wallet transaction record
      await walletService.creditWallet(
        userId,
        redeemAmount,
        "gift_card",
        `Gift card redemption: ${code}`,
        {
          reference_type: "gift_card",
          reference_id: giftCard.id,
        },
      );

      // Mark gift card as fully used
      // Update balance to zero, status to used, and record redemption details
      await giftCard.update(
        {
          balance: 0,
          status: "used",
          redeemed_by: userId,
          redeemed_at: new Date(),
        },
        { transaction },
      );

      // Commit transaction - all operations successful
      await transaction.commit();

      // Return success response with redemption details
      return {
        gift_card_code: code,
        amount_credited: redeemAmount,
        message: `${redeemAmount} credited to your wallet`,
      };
    } catch (error) {
      // If any error occurs, rollback all database changes
      await transaction.rollback();
      throw error;
    }
  }

  // Check gift card balance and status without redeeming it
  // Allows users to verify gift card details before redemption
  // Parameters:
  // - code: Gift card code to check
  // Returns: Object with code, balance, status, and expiration date
  async checkGiftCard(code) {
    const giftCard = await GiftCard.findOne({ where: { code } });

    if (!giftCard) {
      throw CustomError.notFound("Gift card not found");
    }

    return {
      code: giftCard.code,
      balance: parseFloat(giftCard.balance),
      status: giftCard.status,
      expires_at: giftCard.expires_at,
    };
  }

  // Retrieve all gift cards with pagination and optional filtering (admin only)
  // Parameters:
  // - filter: Object containing page, limit, and optional status filter
  // Returns: Paginated list of gift cards with metadata
  async getAllGiftCards(filter = {}) {
    const { page = 1, limit = 50, status } = filter;

    // Calculate how many records to skip based on current page
    const offset = (page - 1) * limit;

    // Build dynamic where clause
    // Only add status filter if it was provided in the request
    const where = {};
    if (status) where.status = status;

    // Fetch gift cards with count for pagination
    const { count, rows } = await GiftCard.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]], // Most recent first
    });

    // Return paginated response with metadata
    return {
      total: count, // Total number of matching records
      page: parseInt(page), // Current page number
      limit: parseInt(limit), // Records per page
      total_pages: Math.ceil(count / limit), // Total pages available
      gift_cards: rows, // Array of gift card objects
    };
  }
}

// Export singleton instance for use across the application
export default new GiftCardService();
