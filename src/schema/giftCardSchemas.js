// Create Gift Card
export const createGiftCardSchema = {
  type: 'object',
  properties: {
    amount: {
      type: 'number',
      minimum: 100,
      maximum: 50000,
      errorMessage: 'Amount must be between ₹100 and ₹50,000'
    },
    expiresInDays: {
      type: 'integer',
      minimum: 1,
      maximum: 365,
      default: 365
    }
  },
  required: ['amount'],
  additionalProperties: false
};

// Bulk Create Gift Cards
export const bulkCreateGiftCardSchema = {
  type: 'object',
  properties: {
    count: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      errorMessage: 'Count must be between 1 and 100'
    },
    amount: {
      type: 'number',
      minimum: 100,
      maximum: 50000
    },
    expiresInDays: {
      type: 'integer',
      minimum: 1,
      maximum: 365,
      default: 365
    }
  },
  required: ['count', 'amount'],
  additionalProperties: false
};

// Redeem Gift Card
export const redeemGiftCardSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      minLength: 16,
      maxLength: 20,
      pattern: '^GC[A-Z0-9]+$',
      errorMessage: 'Invalid gift card code format'
    }
  },
  required: ['code'],
  additionalProperties: false
};

// Check Gift Card
export const checkGiftCardSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      minLength: 16,
      maxLength: 20,
      pattern: '^GC[A-Z0-9]+$'
    }
  },
  required: ['code'],
  additionalProperties: false
};
