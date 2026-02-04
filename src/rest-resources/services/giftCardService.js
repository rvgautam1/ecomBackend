import { GiftCard, sequelize } from "../../db/models/index.js";
import walletService from "./walletService.js";
import CustomError from "../../utils/customError.js";
import crypto from "crypto";

class GiftCardService {
  // generate the unique giftcard code
  generateCode() {
    return `GC${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  }

  //create giftcard (only admin)
  async createGiftCard(adminId, amount, expiresInDaye = 365) {
    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDaye);

    const giftCard = await GiftCard.create({
      code,
      amount: parseFloat(amount),
      balance: parseFloat(amount),
      currency: "INR",
      status: "active",
      issued_by: adminId,
      expires_at: expiresAt,
    });

    return giftCard;
  }

  // bulk create gift cards
  async bulkCreateGiftCards(adminId, count, amount, expiresInDays = 365) {
    const giftCards = [];
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
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

    const created = await GiftCard.bulkCreate(giftCards);

    return created;
  }

  // redeem gift card to wallet

async redeemGiftCard(userId, code) {
    const transaction = await sequelize.transaction();
    try {
      const giftCard = await GiftCard.findOne({
        where: { code },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!giftCard) {
        throw CustomError.notFound("Gift card is not found");
      }

      if (giftCard.status !== "active") {
        throw CustomError.badRequest(`Gift card is ${giftCard.status}`);
      }

      if (giftCard.balance <= 0) {  
        throw CustomError.badRequest("Gift card balance is zero");
      }

      if (giftCard.expires_at && new Date() > giftCard.expires_at) {
        await giftCard.update({ status: "expired" }, { transaction });
        throw CustomError.badRequest("Gift card has expired");
      }

      const redeemAmount = parseFloat(giftCard.balance);

      // credit to wallet
      await walletService.creaditWallet(  
        userId,
        redeemAmount,
        "gift_card",
        `Gift card redemption: ${code}`,
        {
          reference_type: "gift_card",
          reference_id: giftCard.id,
        }
      );

      
      await giftCard.update({
        balance: 0,
        status: 'used',
        redeemed_by: userId, 
        redeemed_at: new Date()  
      }, { transaction });

      await transaction.commit();
      return {
        gift_card_code: code,
        amount_credited: redeemAmount,
        message: `${redeemAmount} credited to your wallet`
      }

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // check the gift card balance 
  async checkGiftCard(code){
    const giftCard = await GiftCard.findOne({where : {code}});
    if(!giftCard){
        throw CustomError.notFound('Gift card not found')
    }

    return {
        code: giftCard.code,
        balance : parseFloat(giftCard.balance),
        status : giftCard.status ,
        expires_at : giftCard.expires_at
    }
  }

  // get all gift cards(only admin)

  async getAllGiftCards(filter ={}){
    const {page =1 , limit =50 , status} = filter;
    const offset = (page -1)*limit;


    // buil dynamic clause is status is provided then use othervise not used because it is optional

    const where = {};
    if(status) where.status =status ;

    const {count , rows} = await GiftCard.findAndCountAll({
        where,
        limit : parseInt(limit),
        offset : parseInt(offset),
        Order : [['created_at', 'DESC']]
    })
return{
    total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(count / limit),
      gift_cards: rows
}

  }
}



export default new GiftCardService();
