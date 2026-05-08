const { param, query } = require("express-validator");

const handHistoryListQueryRules = [
  query("tableId")
    .optional()
    .isMongoId()
    .withMessage("Valid tableId is required"),

  query("userId")
    .optional()
    .isMongoId()
    .withMessage("Valid userId is required"),

  query("gameType")
    .optional()
    .isIn(["7/27", "55 Little Red", "357"])
    .withMessage("Invalid game type"),

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

const handHistoryIdParamRules = [
  param("id")
    .isMongoId()
    .withMessage("Valid hand history id is required"),
];

module.exports = {
  handHistoryListQueryRules,
  handHistoryIdParamRules,
};