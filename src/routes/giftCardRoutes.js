import express from 'express';

import { createGiftCard,
  bulkCreateGiftCards,
  redeemGiftCard,
  checkGiftCard,
  getAllGiftCards}from '../rest-resources/controllers/giftCardController.js'

  import { authenticateUser , isAdmin } from '../middleware/auth.js';

 import validate from '../middleware/validate.js';

 import {
     createGiftCardSchema,
  bulkCreateGiftCardSchema,
  redeemGiftCardSchema,
  checkGiftCardSchema
 } from '../schema/giftCardSchemas.js'


 const router = express.Router();

 router.use(authenticateUser);

 // user routes 
router.post('/redeem', validate(redeemGiftCardSchema), redeemGiftCard);
router.get('/check', validate(checkGiftCardSchema), checkGiftCard)


// admin routes 

router.post('/' , isAdmin , validate(createGiftCardSchema), createGiftCard);
router.post('/bulk' , isAdmin , validate(bulkCreateGiftCardSchema), bulkCreateGiftCards)
router.get('/all' , isAdmin , getAllGiftCards);


export default router ;