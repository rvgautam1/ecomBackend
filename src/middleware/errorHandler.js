const errorHandler = (err, req, res, next) => {
  console.error(' ERROR:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      statusCode,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

export default errorHandler;
