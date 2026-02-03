class CustomError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Helper functions for the custom error
CustomError.badRequest = (message = 'Bad Request') => {
    
  return new CustomError(400, message);
};

CustomError.unauthorized = (message = 'Unauthorized') => {

  return new CustomError(401, message);
};


CustomError.forbidden = (message = 'Forbidden') => {

  return new CustomError(403, message);
};

CustomError.notFound = (message = 'Resource not found') => {

  return new CustomError(404, message);
};

CustomError.conflict = (message = 'Conflict') => {

  return new CustomError(409, message);
};

CustomError.internal = (message = 'Internal Server Error') => {

  return new CustomError(500, message);
};

export default CustomError;
