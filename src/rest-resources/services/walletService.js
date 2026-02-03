import { Wallet, WalletTransaction, User , sequelize } from "../../db/models/index.js";
import CustomError from "../../utils/customError.js";
import { Op, where } from "sequelize";


class WalletService{


    // create wallet for user 

    async createWallet(userId){
        const existingWallet = await Wallet.findOne({where :{user_id :userId}});

        if(existingWallet){
            return existingWallet ;
        }
    }
}