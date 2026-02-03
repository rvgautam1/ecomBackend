import Ajv from "ajv";               
import addFormats from "ajv-formats"; 
import addErrors from "ajv-errors";   
import CustomError from "../utils/customError.js"; 

//  AJV instance
const ajv = new Ajv({
  allErrors: true,        // Return all validation errors
  removeAdditional: true, // Remove extra properties from request body
  coerceTypes: true       // Convert types automatically (string -> number)
});

// Register formats and error extensions
addFormats(ajv);
addErrors(ajv);

// Validation middleware factory
const validate = (schema) => {
  const validateFn = ajv.compile(schema); // Compile schema once

  return (req, res, next) => {
    const valid = validateFn(req.body); // Validate request body

    if (!valid) {
      // Format validation errors
      const errors = validateFn.errors.map(err => ({
        field: err.instancePath.replace("/", "") || err.params.missingProperty,
        message: err.message
      }));

      // Throw standardized validation error
      throw CustomError.badRequest(
        `Validation failed: ${errors.map(e => `${e.field} ${e.message}`).join(", ")}`
      );
    }

    next();
  };
};

export default validate;
