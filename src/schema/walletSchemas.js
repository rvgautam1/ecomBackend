//  Add Money to Wallet (Admin only)
export const addMoneySchema = {
  type: 'object',
  properties: {
    amount: {
      type: 'number',
      minimum: 1,
      maximum: 100000,
      errorMessage: 'Amount must be between ₹1 and ₹100,000'
    },
    description: {
      type: 'string',
      minLength: 5,
      maxLength: 200
    }
  },
  required: ['amount', 'description'],
  additionalProperties: false
};

//  Transaction History Query
export const transactionHistorySchema = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      default: 1
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    type: {
      type: 'string',
      enum: ['credit', 'debit']
    },
    source: {
      type: 'string',
      enum: ['order_payment', 'refund', 'cashback', 'gift_card', 'admin_credit', 'admin_debit', 'withdrawal']
    }
  },
  additionalProperties: false
};
