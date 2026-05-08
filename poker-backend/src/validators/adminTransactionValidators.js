const { body, param, query } = require("express-validator");

const transactionListQueryRules = [
  query("type")
    .optional()
    .isIn(["deposit", "withdrawal", "adjustment"])
    .withMessage("Type must be deposit, withdrawal, or adjustment"),

  query("status")
    .optional()
    .isIn(["pending", "success", "failed", "approved", "rejected"])
    .withMessage("Invalid transaction status"),

  query("userId")
    .optional()
    .isMongoId()
    .withMessage("Valid userId is required"),

  query("fromDate")
    .optional()
    .isISO8601()
    .withMessage("fromDate must be a valid date"),

  query("toDate")
    .optional()
    .isISO8601()
    .withMessage("toDate must be a valid date"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be at least 1"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
];

const withdrawalListQueryRules = [
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected", "success", "failed"])
    .withMessage("Invalid withdrawal status"),

  query("userId")
    .optional()
    .isMongoId()
    .withMessage("Valid userId is required"),

  query("fromDate")
    .optional()
    .isISO8601()
    .withMessage("fromDate must be a valid date"),

  query("toDate")
    .optional()
    .isISO8601()
    .withMessage("toDate must be a valid date"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be at least 1"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
];

const withdrawalIdParamRules = [
  param("id")
    .isMongoId()
    .withMessage("Valid withdrawal id is required"),
];

const approveWithdrawalRules = [
  ...withdrawalIdParamRules,
  body("adminNote")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("adminNote must be at most 300 characters"),
];

const rejectWithdrawalRules = [
  ...withdrawalIdParamRules,
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Reason is required")
    .isLength({ min: 3, max: 300 })
    .withMessage("Reason must be between 3 and 300 characters"),
];

module.exports = {
  transactionListQueryRules,
  withdrawalListQueryRules,
  withdrawalIdParamRules,
  approveWithdrawalRules,
  rejectWithdrawalRules,
};