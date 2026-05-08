const { body, param, query } = require("express-validator");

const createTableRules = [
  body("tableName")
    .trim()
    .notEmpty()
    .withMessage("Table name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Table name must be between 2 and 100 characters"),

  body("gameType")
    .notEmpty()
    .withMessage("Game type is required")
    .isIn(["7/27", "55 Little Red", "357"])
    .withMessage("Invalid game type"),

  body("maxPlayers")
    .optional()
    .isInt({ min: 2, max: 10 })
    .withMessage("maxPlayers must be between 2 and 10"),

  body("ante")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Ante must be 0 or more"),

  body("smallBlind")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Small blind must be 0 or more"),

  body("bigBlind")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Big blind must be 0 or more"),

  body("notes")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Notes must be at most 300 characters"),
];

const tableListQueryRules = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search must be at most 100 characters"),

  query("status")
    .optional()
    .isIn(["waiting", "active", "paused", "closed"])
    .withMessage("Invalid table status"),

  query("gameType")
    .optional()
    .isIn(["7/27", "55 Little Red", "357"])
    .withMessage("Invalid game type"),
];

const tableIdParamRules = [
  param("id")
    .isMongoId()
    .withMessage("Valid table id is required"),
];

const updateTableStatusRules = [
  ...tableIdParamRules,
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["waiting", "active", "paused", "closed"])
    .withMessage("Invalid table status"),
];

const updateTableConfigRules = [
  ...tableIdParamRules,

  body("tableName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Table name must be between 2 and 100 characters"),

  body("gameType")
    .optional()
    .isIn(["7/27", "55 Little Red", "357"])
    .withMessage("Invalid game type"),

  body("maxPlayers")
    .optional()
    .isInt({ min: 2, max: 10 })
    .withMessage("maxPlayers must be between 2 and 10"),

  body("ante")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Ante must be 0 or more"),

  body("smallBlind")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Small blind must be 0 or more"),

  body("bigBlind")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Big blind must be 0 or more"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Notes must be at most 300 characters"),
];

const removePlayerFromTableRules = [
  ...tableIdParamRules,
  body("userId")
    .notEmpty()
    .withMessage("userId is required")
    .isMongoId()
    .withMessage("Valid userId is required"),
];

module.exports = {
  createTableRules,
  tableListQueryRules,
  tableIdParamRules,
  updateTableStatusRules,
  updateTableConfigRules,
  removePlayerFromTableRules,
};