const { body, param, query } = require("express-validator");

const playerListQueryRules = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search must be at most 100 characters"),

  query("status")
    .optional()
    .isIn(["active", "blocked", "suspended"])
    .withMessage("Status must be active, blocked, or suspended"),
];

const playerIdParamRules = [
  param("id")
    .isMongoId()
    .withMessage("Valid player id is required"),
];

const updatePlayerStatusRules = [
  ...playerIdParamRules,
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["active", "blocked", "suspended"])
    .withMessage("Status must be active, blocked, or suspended"),
];

const updatePlayerChipsRules = [
  ...playerIdParamRules,
  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["add", "subtract", "set"])
    .withMessage("Action must be add, subtract, or set"),

  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0 })
    .withMessage("Amount must be a valid positive number"),
];

module.exports = {
  playerListQueryRules,
  playerIdParamRules,
  updatePlayerStatusRules,
  updatePlayerChipsRules,
};