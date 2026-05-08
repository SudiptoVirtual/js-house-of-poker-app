const { validationResult } = require("express-validator");

const formatErrors = (errors) => {
  return errors.array().map((error) => ({
    field: error.path,
    message: error.msg,
    value: error.value,
  }));
};

const validateRequest = (validations = []) => {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);

      if (errors.isEmpty()) {
        return next();
      }

      return res.status(422).json({
        message: "Validation failed",
        errors: formatErrors(errors),
      });
    },
  ];
};

const validateRequestWithAuth = (authMiddleware, validations = []) => {
  const authStack = Array.isArray(authMiddleware)
    ? authMiddleware
    : [authMiddleware];

  return [
    ...authStack,
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);

      if (errors.isEmpty()) {
        return next();
      }

      return res.status(422).json({
        message: "Validation failed",
        errors: formatErrors(errors),
      });
    },
  ];
};

module.exports = {
  validateRequest,
  validateRequestWithAuth,
};