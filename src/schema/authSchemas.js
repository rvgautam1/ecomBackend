//  Register Schema
export const registerSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 100,
      pattern: '^[a-zA-Z ]+$',
      errorMessage: 'Name must be 3-100 characters, letters only'
    },
    email: {
      type: 'string',
      format: 'email',
      errorMessage: 'Valid email required'
    },
    password: {
      type: 'string',
      minLength: 6,
      maxLength: 50,
      errorMessage: 'Password must be 6-50 characters'
    },
    role: {
      type: 'string',
      enum: ['user', 'vendor','admin'],
      default: 'user'
    },
    phone: {
      type: 'string',
      pattern: '^\\+?[0-9]{10,15}$',
      errorMessage: 'Valid phone number required (10-15 digits)'
    }
  },
  required: ['name', 'email', 'password'],
  additionalProperties: false
};

//  Login Schema
export const loginSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email'
    },
    password: {
      type: 'string',
      minLength: 6
    }
  },
  required: ['email', 'password'],
  additionalProperties: false
};


