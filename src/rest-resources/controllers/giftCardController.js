
import giftCardService from "../services/giftCardService.js";


// create gift card (only admin)

const createGiftCard = async (req , res , next)=>{
    try{
        const{amount , expiresInDays} = req.body;
        const adminId = req.user.id ;
        const giftCard = await giftCardService.createGiftCard(
            adminId , amount , expiresInDays
        )

        res.status(201).json({
            success: true ,
            message:'Gift card created successfully',
            data:{
                code: giftCard.code,
        amount: parseFloat(giftCard.amount),
        balance: parseFloat(giftCard.balance),
        expires_at: giftCard.expires_at
            }
        })

    }catch(error){
   next(error);

    }
}

// only admin can create the 
    const bulkCreateGiftCards = async(req , res , next)=>{
        try{
      const { count , amount , expiresInDays} = req.body;
      const adminId = req.user.id;
      const giftCard = await giftCardService.bulkCreateGiftCards(adminId , count , amount , expiresInDays);
      res.status(201).json({
        success : true ,
        message : `${count} gift cards created successfully!`,
        data: giftCard.map(gc =>({
            code : gc.code ,
            amount : gc.amount,
            expires_at : gc.expires_at
        }))
      })
        }catch(error){
   next(error)
        }
    }


    // redeem gift card 

    const redeemGiftCard = async (req , res , next) =>{
        try{
            const{code} = req.body;
            const userId = req.user.id;
            const result = await giftCardService.redeemGiftCard(userId , code);
            res.json({
                success: true,
      message: result.message,
      data: result
            })

        }
        catch(error){
            next(error)
        }
    }
    // check gift card balance
    const checkGiftCard = async (req , res , next)=>{
        try{

            const {code} = req.query;
            const giftcard = await giftCardService.checkGiftCard(code);
            res.json({
                success :true,
                data :giftcard
            })

        }catch(error){
            next(error)
        }
    }


    // get all gift cards (admin only)

    const getAllGiftCards  = async (req , res , next)=>{
        try{
 const {page , limit , status} = req.query;
        const result = await giftCardService.getAllGiftCards(
            {
                page ,
                limit ,
                status
            }
        )


        res.json({
            success :true,
            data :result
        })
        }catch(error){
            next(error)
        }
       
    }


   export{
  createGiftCard,
  bulkCreateGiftCards,
  redeemGiftCard,
  checkGiftCard,
  getAllGiftCards
};