//  Sales Summary Schema
export const salesSummarySchema = {
  type: 'object',
  properties: {
    period: {
      type: 'string',
      enum: ['24h', '7d', '30d'],
      default: '24h',
      errorMessage: 'Period must be 24h, 7d or 30d'
    }
  },
  additionalProperties: false
};

//  Top Products Schema
export const topProductsSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
      errorMessage: 'Limit must be between 1-100'
    },
    period: {
      type: 'string',
      enum: ['24h', '7d', '30d', 'all'],
      default: '30d',
      errorMessage: 'Period must be 24h, 7d, 30d or all'
    }
  },
  additionalProperties: false
};

//  Daily Sales Schema
export const dailySalesSchema = {
  type: 'object',
  properties: {
    days: {
      type: 'integer',
      minimum: 1,
      maximum: 365,
      default: 7,
      errorMessage: 'Days must be between 1-365'
    }
  },
  additionalProperties: false
};

//  Payment Methods Schema
export const paymentMethodsSchema = {
  type: 'object',
  properties: {
    period: {
      type: 'string',
      enum: ['24h', '7d', '30d'],
      default: '30d',
      errorMessage: 'Period must be 24h, 7d or 30d'
    }
  },
  additionalProperties: false
};
